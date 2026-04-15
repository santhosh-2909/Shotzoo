/**
 * ShotZoo API utility
 *
 * In development:
 *   VITE_API_BASE_URL is empty → relative /api/* paths use the Vite proxy
 *   (frontend/vite.config.ts forwards /api → http://localhost:5000)
 *
 * In production (e.g. Vercel multi-service):
 *   Set VITE_API_BASE_URL=/_/backend so all calls hit the backend service.
 */

export const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : '/' + path;
  return API_BASE + p;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

export const DEFAULT_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' fill='%23d5dbc5'/%3E%3Ccircle cx='60' cy='45' r='22' fill='%237a8060'/%3E%3Cellipse cx='60' cy='110' rx='38' ry='35' fill='%237a8060'/%3E%3C/svg%3E";

export function uploadUrl(path: string): string {
  if (!path) return DEFAULT_AVATAR;
  // Inline data URLs (new in-DB storage) → return as-is
  if (path.startsWith('data:')) return path;
  // Absolute URLs → as-is
  if (path.startsWith('http')) return path;
  // Legacy /uploads/* paths → prefix with API_BASE + cache-bust
  const v = localStorage.getItem('shotzoo_photo_v') ?? '0';
  const prefixed = path.startsWith('/') ? API_BASE + path : API_BASE + '/' + path;
  return prefixed + '?v=' + v;
}

export function escapeHtml(str: string): string {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// ─── Core fetch ────────────────────────────────────────────────────────────

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

interface AttemptResult {
  res: Response;
  rawText: string;
}

interface NetworkErrorResult {
  networkError: true;
  message:      string;
}

async function singleAttempt(
  endpoint: string,
  options: RequestInit,
  headers: Record<string, string>,
): Promise<AttemptResult | NetworkErrorResult> {
  const url = apiUrl('/api' + endpoint);
  try {
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
    const rawText = await res.text();
    return { res, rawText };
  } catch (err) {
    // Surface the real reason fetch failed (CORS, DNS, timeout, etc.)
    // so the frontend can show something better than a generic message.
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api] fetch failed for', (options.method ?? 'GET'), url, '→', message);
    return { networkError: true, message };
  }
}

async function request<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem('shotzoo_token');
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) headers['Authorization'] = 'Bearer ' + token;

  // Don't set Content-Type for FormData — browser adds multipart boundary
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  // Retry transient failures: network errors, 502/503/504, and 5xx with
  // empty/non-JSON bodies. We only retry idempotent-ish failures and only
  // GET methods are retried more than once. Writes (POST/PUT/PATCH/DELETE)
  // get exactly one retry to cover backend restarts mid-request.
  const method = (options.method ?? 'GET').toUpperCase();
  const maxRetries = method === 'GET' ? 2 : 1;

  let lastNetworkMsg = '';
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await singleAttempt(endpoint, options, headers);

    if ('networkError' in result) {
      lastNetworkMsg = result.message;
      if (attempt < maxRetries) {
        await sleep(400 * (attempt + 1));
        continue;
      }
      // Include the underlying reason so CORS / timeout / DNS issues are
      // visible instead of hidden behind a generic "cannot reach" string.
      const suffix = lastNetworkMsg ? ' (' + lastNetworkMsg + ')' : '';
      throw new Error('Cannot reach the server. Please check your connection and try again.' + suffix);
    }

    const { res, rawText } = result;
    const transient = res.status >= 502 && res.status <= 504;

    // Try to JSON-parse first so we can distinguish "real backend 5xx with
    // a useful message" from "proxy returned HTML during a restart"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON shape unknown
    let data: any = null;
    let parseFailed = false;
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        parseFailed = true;
      }
    }

    // Retry conditions:
    //  - 502/503/504 from any layer (gateway hiccup)
    //  - any 5xx with empty body OR HTML body (backend restart caught mid-request)
    if (attempt < maxRetries && (transient || (res.status >= 500 && (parseFailed || !rawText)))) {
      await sleep(400 * (attempt + 1));
      continue;
    }

    if (parseFailed) {
      throw new Error(
        res.ok
          ? 'Server returned an invalid response. Please try again.'
          : 'Server error (HTTP ' + res.status + '). Please try again in a moment.',
      );
    }

    // Expired/invalid token on protected endpoint → force re-login
    if (res.status === 401 && !endpoint.startsWith('/auth/')) {
      localStorage.removeItem('shotzoo_token');
      localStorage.removeItem('shotzoo_user');
      localStorage.removeItem('shotzoo_admin');
      localStorage.removeItem('shotzoo_photo_v');
      globalThis.location.href = '/signin';
      throw new Error('Session expired. Please log in again.');
    }

    if (!res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      throw new Error((data?.message as string | undefined) ?? 'Request failed (HTTP ' + res.status + ')');
    }

    return data as T;
  }

  // Unreachable — the loop always returns or throws.
  throw new Error('Request failed.');
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export const authApi = {
  login:      (email: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register:   (formData: FormData) =>
    request('/auth/register', { method: 'POST', body: formData }),
  me:         () => request('/auth/me'),
  checkSetup: () => request('/auth/check-setup'),
  setup:      (body: unknown) =>
    request('/auth/setup', { method: 'POST', body: JSON.stringify(body) }),
};

// ─── Tasks ─────────────────────────────────────────────────────────────────

export const tasksApi = {
  list:         (params?: string) => request('/tasks' + (params ? '?' + params : '')),
  today:        () => request('/tasks/today'),
  stats:        () => request('/tasks/stats'),
  upcoming:     () => request('/tasks/upcoming'),
  create:       (body: unknown) =>
    request('/tasks', { method: 'POST', body: JSON.stringify(body) }),
  update:       (id: string, body: unknown) =>
    request('/tasks/' + id, { method: 'PUT', body: JSON.stringify(body) }),
  updateStatus: (id: string, status: string, progress?: number) =>
    request('/tasks/' + id + '/status', {
      method: 'PUT',
      body: JSON.stringify({ status, progress }),
    }),
  remove:       (id: string) => request('/tasks/' + id, { method: 'DELETE' }),
};

// ─── Attendance ────────────────────────────────────────────────────────────

export const attendanceApi = {
  startDay:    () => request('/attendance/start-day', { method: 'POST' }),
  checkIn:     () => request('/attendance/checkin',   { method: 'POST' }),
  checkOut:    () => request('/attendance/checkout',  { method: 'POST' }),
  toggleBreak: () => request('/attendance/break',     { method: 'POST' }),
  today:       () => request('/attendance/today'),
  history:     (month?: string) =>
    request('/attendance/history' + (month ? '?month=' + month : '')),
  stats:       () => request('/attendance/stats'),
};

// ─── Daily Reports ─────────────────────────────────────────────────────────

export const reportsApi = {
  submit:  (body: unknown) =>
    request('/daily-reports/submit', { method: 'POST', body: JSON.stringify(body) }),
  today:   () => request('/daily-reports/today'),
  history: (month?: string) =>
    request('/daily-reports/history' + (month ? '?month=' + month : '')),
  stats:   () => request('/daily-reports/stats'),
};

// ─── Notifications ─────────────────────────────────────────────────────────

export const notifApi = {
  list:     (type?: string) => request('/notifications' + (type ? '?type=' + type : '')),
  markRead: (id: string)    => request('/notifications/' + id + '/read', { method: 'PUT' }),
  markAll:  ()              => request('/notifications/read-all',         { method: 'PUT' }),
  dismiss:  (id: string)    => request('/notifications/' + id, { method: 'DELETE' }),
};

// ─── Profile ───────────────────────────────────────────────────────────────

export const profileApi = {
  get:            () => request('/profile'),
  update:         (formData: FormData) =>
    request('/profile', { method: 'PUT', body: formData }),
  changePassword: (body: unknown) =>
    request('/profile/password', { method: 'PUT', body: JSON.stringify(body) }),
  requestOtp:     (channel: string) =>
    request('/profile/password/reset/request', {
      method: 'POST',
      body: JSON.stringify({ channel }),
    }),
  confirmOtp:     (body: unknown) =>
    request('/profile/password/reset/confirm', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  preferences:    (prefs: unknown) =>
    request('/profile/preferences', { method: 'PUT', body: JSON.stringify(prefs) }),
};

// ─── Admin ─────────────────────────────────────────────────────────────────

export const adminApi = {
  stats:            () => request('/admin/stats'),
  activity:         (limit?: number) =>
    request('/admin/activity' + (limit ? '?limit=' + limit : '')),
  tasks:            (params?: string) =>
    request('/admin/tasks' + (params ? '?' + params : '')),
  updateTask:       (id: string, body: unknown) =>
    request('/admin/tasks/' + id, { method: 'PUT', body: JSON.stringify(body) }),
  deleteTask:       (id: string) =>
    request('/admin/tasks/' + id, { method: 'DELETE' }),
  employees:        () => request('/admin/employees'),
  createEmployee:   (body: unknown) =>
    request('/auth/create-employee', { method: 'POST', body: JSON.stringify(body) }),
  deleteEmployee:   (id: string) =>
    request('/admin/employees/' + id, { method: 'DELETE' }),
  attendance:       (date?: string) =>
    request('/admin/attendance' + (date ? '?date=' + date : '')),
  createTask:       (body: unknown) =>
    request('/admin/tasks', { method: 'POST', body: JSON.stringify(body) }),
  notify:           (body: unknown) =>
    request('/admin/notify', { method: 'POST', body: JSON.stringify(body) }),
  notifications:    () => request('/admin/notifications/sent'),
};
