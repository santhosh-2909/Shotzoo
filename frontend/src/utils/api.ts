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
  if (path.startsWith('http')) return path;
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

  const res = await fetch(apiUrl('/api' + endpoint), {
    ...options,
    headers,
    credentials: 'include',
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON shape unknown
  const data = (await res.json()) as any;

  // Expired/invalid token on protected endpoint → force re-login
  if (res.status === 401 && !endpoint.startsWith('/auth/')) {
    localStorage.removeItem('shotzoo_token');
    localStorage.removeItem('shotzoo_user');
    localStorage.removeItem('shotzoo_admin');
    localStorage.removeItem('shotzoo_photo_v');
    window.location.href = '/signin';
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    throw new Error((data?.message as string | undefined) ?? 'Request failed');
  }

  return data as T;
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export const authApi = {
  login:    (email: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (formData: FormData) =>
    request('/auth/register', { method: 'POST', body: formData }),
  me:       () => request('/auth/me'),
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
