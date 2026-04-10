// ShotZoo API Helper
const API_BASE = 'http://localhost:5000/api';
const SERVER_BASE = 'http://localhost:5000';

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
}

const api = {
  getToken() {
    return localStorage.getItem('shotzoo_token');
  },

  setToken(token) {
    localStorage.setItem('shotzoo_token', token);
  },

  setUser(user) {
    localStorage.setItem('shotzoo_user', JSON.stringify(user));
  },

  getUser() {
    try {
      return JSON.parse(localStorage.getItem('shotzoo_user'));
    } catch {
      return null;
    }
  },

  // Resolve a relative upload path to full URL, bust cache with timestamp
  uploadUrl(path) {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return SERVER_BASE + path + '?v=' + (localStorage.getItem('shotzoo_photo_v') || '0');
  },

  // Call after any profile update that might change the photo
  refreshUser(user) {
    if (user) {
      this.setUser(user);
      // Bust photo cache
      if (user.photo) localStorage.setItem('shotzoo_photo_v', Date.now().toString());
      this.updateSidebar();
    }
  },

  logout() {
    localStorage.removeItem('shotzoo_token');
    localStorage.removeItem('shotzoo_user');
    localStorage.removeItem('shotzoo_photo_v');
    globalThis.location.href = '/signin';
  },

  // Show a centered confirmation modal before logging out.
  // Returns void; calls logout() on confirm.
  confirmLogout() {
    if (document.getElementById('shotzoo-logout-modal')) return; // already open
    var overlay = document.createElement('div');
    overlay.id = 'shotzoo-logout-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9999;display:flex;align-items:center;justify-content:center;font-family:Manrope,sans-serif;animation:szFadeIn 0.18s ease;';
    overlay.innerHTML =
      '<style>' +
        '@keyframes szFadeIn{from{opacity:0}to{opacity:1}}' +
        '@keyframes szPop{from{transform:scale(0.92);opacity:0}to{transform:scale(1);opacity:1}}' +
      '</style>' +
      '<div role="dialog" aria-modal="true" aria-labelledby="sz-logout-title" style="background:#fff;border-radius:24px;padding:32px;max-width:420px;width:90%;box-shadow:0 25px 60px rgba(0,0,0,0.25);text-align:center;animation:szPop 0.22s ease;">' +
        '<div style="width:64px;height:64px;border-radius:50%;background:#FEE2E2;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">' +
          '<span class="material-symbols-outlined" style="color:#EF4444;font-size:32px;">logout</span>' +
        '</div>' +
        '<h2 id="sz-logout-title" style="font-family:\'Space Grotesk\',sans-serif;font-size:24px;font-weight:800;color:#151c27;margin:0 0 8px 0;letter-spacing:-0.02em;">Log Out?</h2>' +
        '<p style="color:#6B7280;font-size:14px;margin:0 0 24px 0;line-height:1.5;">Are you sure you want to log out of your account?</p>' +
        '<div style="display:flex;gap:12px;">' +
          '<button id="sz-logout-cancel" type="button" style="flex:1;padding:14px;border:2px solid #E5E7EB;background:#fff;color:#374151;font-weight:700;font-size:14px;border-radius:14px;cursor:pointer;transition:all 0.15s;">Cancel</button>' +
          '<button id="sz-logout-confirm" type="button" style="flex:1;padding:14px;background:#A8CD62;color:#131F00;font-weight:800;font-size:14px;border:none;border-radius:14px;cursor:pointer;transition:all 0.15s;box-shadow:0 4px 12px rgba(168,205,98,0.35);">Yes, Log Out</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    var self = this;
    function close() {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);

    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.getElementById('sz-logout-cancel').addEventListener('click', close);
    document.getElementById('sz-logout-confirm').addEventListener('click', function () {
      close();
      self.logout();
    });

    // Hover affordances
    var cancelBtn = document.getElementById('sz-logout-cancel');
    cancelBtn.addEventListener('mouseenter', function () { cancelBtn.style.background = '#F9FAFB'; });
    cancelBtn.addEventListener('mouseleave', function () { cancelBtn.style.background = '#fff'; });
    var confirmBtn = document.getElementById('sz-logout-confirm');
    confirmBtn.addEventListener('mouseenter', function () { confirmBtn.style.filter = 'brightness(1.08)'; });
    confirmBtn.addEventListener('mouseleave', function () { confirmBtn.style.filter = 'none'; });
  },

  requireAuth() {
    if (!this.getToken()) {
      globalThis.location.href = '/signin';
      return false;
    }
    return true;
  },

  // Update sidebar user info on any protected page (name, ID, photo)
  updateSidebar() {
    // First render from localStorage (instant)
    this._applySidebar(this.getUser());
    // Then fetch fresh data from server to catch any updates
    this.request('/auth/me').then(data => {
      if (data?.user) {
        this.setUser(data.user);
        this._applySidebar(data.user);
      }
    }).catch(() => {});
  },

  // Default avatar as inline SVG data URI (consistent across all pages)
  DEFAULT_AVATAR: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' fill='%23d5dbc5'/%3E%3Ccircle cx='60' cy='45' r='22' fill='%237a8060'/%3E%3Cellipse cx='60' cy='110' rx='38' ry='35' fill='%237a8060'/%3E%3C/svg%3E",

  _applySidebar(user) {
    if (!user) return;
    document.querySelectorAll('[data-user-name]').forEach(el => el.textContent = user.fullName || 'User');
    document.querySelectorAll('[data-user-id]').forEach(el => el.textContent = 'ID: ' + (user.employeeId || 'N/A'));
    const photoSrc = user.photo ? this.uploadUrl(user.photo) : this.DEFAULT_AVATAR;
    document.querySelectorAll('[data-user-photo]').forEach(el => {
      el.src = photoSrc;
    });
  },

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = { ...options.headers };

    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }

    // Don't set Content-Type for FormData (browser sets it with boundary)
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(API_BASE + endpoint, {
      ...options,
      headers,
      credentials: 'include'
    });

    const data = await res.json();

    // If token is invalid/expired on a protected route, force re-login
    // But NOT on auth endpoints (login/register) — those return 401 for bad credentials
    if (res.status === 401 && !endpoint.startsWith('/auth/')) {
      this.logout();
      throw new Error('Session expired. Please log in again.');
    }

    if (!res.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return data;
  },

  // Auth
  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.setToken(data.token);
    this.refreshUser(data.user);
    return data;
  },

  async register(formData) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: formData
    });
    this.setToken(data.token);
    this.refreshUser(data.user);
    return data;
  },

  // Tasks
  getTasks(params) {
    return this.request('/tasks' + (params ? '?' + params : ''));
  },
  getTodayTasks() {
    return this.request('/tasks/today');
  },
  getTaskStats() {
    return this.request('/tasks/stats');
  },
  getUpcomingDeadlines() {
    return this.request('/tasks/upcoming');
  },
  createTask(taskData) {
    return this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData)
    });
  },
  updateTask(id, taskData) {
    return this.request('/tasks/' + id, {
      method: 'PUT',
      body: JSON.stringify(taskData)
    });
  },
  updateTaskStatus(id, status, progress) {
    return this.request('/tasks/' + id + '/status', {
      method: 'PUT',
      body: JSON.stringify({ status, progress })
    });
  },
  deleteTask(id) {
    return this.request('/tasks/' + id, { method: 'DELETE' });
  },

  // Attendance
  startDay() {
    return this.request('/attendance/start-day', { method: 'POST' });
  },
  checkIn() {
    return this.request('/attendance/checkin', { method: 'POST' });
  },
  checkOut() {
    return this.request('/attendance/checkout', { method: 'POST' });
  },
  toggleBreak() {
    return this.request('/attendance/break', { method: 'POST' });
  },
  getAttendanceToday() {
    return this.request('/attendance/today');
  },
  getAttendanceHistory(month) {
    return this.request('/attendance/history' + (month ? '?month=' + month : ''));
  },
  getAttendanceStats() {
    return this.request('/attendance/stats');
  },

  // Daily Reports
  submitReport(data) {
    return this.request('/daily-reports/submit', { method: 'POST', body: JSON.stringify(data) });
  },
  getTodayReports() {
    return this.request('/daily-reports/today');
  },
  getReportHistory(month) {
    return this.request('/daily-reports/history' + (month ? '?month=' + month : ''));
  },
  getReportStats() {
    return this.request('/daily-reports/stats');
  },

  // Notifications
  getNotifications(type) {
    return this.request('/notifications' + (type ? '?type=' + type : ''));
  },
  markNotificationRead(id) {
    return this.request('/notifications/' + id + '/read', { method: 'PUT' });
  },
  markAllRead() {
    return this.request('/notifications/read-all', { method: 'PUT' });
  },
  dismissNotification(id) {
    return this.request('/notifications/' + id, { method: 'DELETE' });
  },

  // Profile
  getProfile() {
    return this.request('/profile');
  },
  async updateProfile(formData) {
    const data = await this.request('/profile', {
      method: 'PUT',
      body: formData
    });
    // Sync updated user globally so photo/name reflect everywhere
    if (data?.user) this.refreshUser(data.user);
    return data;
  },
  changePassword(currentPassword, newPassword, confirmPassword) {
    return this.request('/profile/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
    });
  },
  // Forgot-password reset (replaces the old View Password flow)
  requestPasswordResetOtp(channel) {
    return this.request('/profile/password/reset/request', { method: 'POST', body: JSON.stringify({ channel: channel || 'email' }) });
  },
  resetPasswordWithOtp(code, newPassword, confirmPassword) {
    return this.request('/profile/password/reset/confirm', { method: 'POST', body: JSON.stringify({ code, newPassword, confirmPassword }) });
  },
  updatePreferences(prefs) {
    return this.request('/profile/preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs)
    });
  }
};

// Global capture-phase listener: any click on a [data-logout] element shows
// the confirmation modal. Capture phase + stopImmediatePropagation ensures
// per-page handlers (which call api.logout() directly) never fire.
document.addEventListener('click', function (e) {
  var trigger = e.target.closest('[data-logout]');
  if (!trigger) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  api.confirmLogout();
}, true);

// ----- Live notification bell badge --------------------------------
// Any element with [data-notif-badge] is treated as the bell badge on
// the page. We poll /api/notifications every 60 seconds, write the
// unread count into every matching element, and hide the badge entirely
// when the count is zero. Pages can immediately update the count after
// marking-read locally by calling api.refreshNotifBadge().
api.refreshNotifBadge = function () {
  if (!api.getToken()) return Promise.resolve();
  return api.getNotifications().then(function (d) {
    var n = (d && typeof d.unreadCount === 'number') ? d.unreadCount : 0;
    document.querySelectorAll('[data-notif-badge]').forEach(function (el) {
      if (n > 0) {
        el.textContent = n > 99 ? '99+' : String(n);
        el.style.display = '';
        el.classList.remove('hidden');
      } else {
        el.textContent = '';
        el.style.display = 'none';
      }
    });
  }).catch(function () { /* swallow — bell stays at last known state */ });
};
// Kick off polling on every page that loads api.js, but only if a token exists.
if (typeof globalThis !== 'undefined' && globalThis.localStorage && globalThis.localStorage.getItem('shotzoo_token')) {
  // Defer first poll until DOM is ready so the badges are in the document.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { api.refreshNotifBadge(); });
  } else {
    api.refreshNotifBadge();
  }
  setInterval(function () { api.refreshNotifBadge(); }, 60 * 1000);
}

// ============================================================
// Responsive sidebar drawer (mobile / tablet < 768px)
// ============================================================
// Every employee page uses the same `w-72 fixed left-0` sidebar pattern with
// an `<aside>` element. Below 768px we want it to collapse into an off-canvas
// drawer toggled by a hamburger button. We do this entirely from this shared
// script so individual pages don't need to be edited just to gain the toggle
// behavior — they only need responsive `md:` breakpoint classes on their own
// content grids/tables, which is handled per-page.
(function () {
  if (document.getElementById('sz-responsive-css')) return; // already injected
  var css = document.createElement('style');
  css.id = 'sz-responsive-css';
  css.textContent =
    /* Below 768px: collapse the sidebar into an off-canvas drawer */
    '@media (max-width: 767.98px) {' +
    '  body aside.fixed.left-0,' +
    '  body nav.fixed.left-0 {' +
    '    transform: translateX(-100%);' +
    '    transition: transform 0.25s ease;' +
    '    width: 17rem !important;' +
    '  }' +
    '  body.sz-drawer-open aside.fixed.left-0,' +
    '  body.sz-drawer-open nav.fixed.left-0 {' +
    '    transform: translateX(0);' +
    '  }' +
    /* Kill the 288px left margin so main content uses the full viewport */
    '  body main.ml-72,' +
    '  body main[class*="ml-72"],' +
    '  body div.ml-72,' +
    '  body main[class*="ml-72 "] {' +
    '    margin-left: 0 !important;' +
    '  }' +
    /* Tighten typical desktop padding so content actually fits */
    '  body main { padding-left: 1rem !important; padding-right: 1rem !important; padding-top: 4.5rem !important; }' +
    /* Any fixed top app-bar must shift right past the 44px hamburger + 12px gutter */
    '  body header.fixed.top-0 { left: 56px !important; }' +
    /* Hamburger sits top-left, fixed, above everything */
    '  #sz-hamburger { display: flex !important; }' +
    /* Backdrop visible only when drawer is open */
    '  body.sz-drawer-open #sz-drawer-backdrop { opacity: 1; pointer-events: auto; }' +
    /* Make tables horizontally scroll inside their wrapper instead of overflowing the page */
    '  body table { display: block; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }' +
    /* Force-stack any 3+ column grids that don\'t already have md: prefixes */
    '  body .grid.grid-cols-2:not(.md\\:grid-cols-2):not([class*="md:grid-cols"]),' +
    '  body .grid.grid-cols-3:not([class*="md:grid-cols"]):not([class*="lg:grid-cols"]),' +
    '  body .grid.grid-cols-4:not([class*="md:grid-cols"]):not([class*="lg:grid-cols"]) {' +
    '    grid-template-columns: minmax(0, 1fr) !important;' +
    '  }' +
    '}' +
    /* Hamburger and backdrop styles (always present, hidden on desktop via display:none) */
    '#sz-hamburger {' +
    '  display: none;' +
    '  position: fixed; top: 12px; left: 12px; z-index: 60;' +
    '  width: 44px; height: 44px; border-radius: 12px;' +
    '  background: #2A313D; color: #fff; border: none; cursor: pointer;' +
    '  align-items: center; justify-content: center;' +
    '  box-shadow: 0 6px 18px rgba(0,0,0,0.25);' +
    '}' +
    '#sz-hamburger .material-symbols-outlined { font-size: 24px; }' +
    '#sz-drawer-backdrop {' +
    '  position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 49;' +
    '  opacity: 0; pointer-events: none; transition: opacity 0.2s ease;' +
    '}';
  document.head.appendChild(css);

  function injectChrome() {
    // Only inject the hamburger on pages that actually have a fixed sidebar.
    var hasSidebar = document.querySelector('aside.fixed.left-0, nav.fixed.left-0');
    if (!hasSidebar) return;
    if (document.getElementById('sz-hamburger')) return;

    var btn = document.createElement('button');
    btn.id = 'sz-hamburger';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Open menu');
    btn.innerHTML = '<span class="material-symbols-outlined">menu</span>';
    document.body.appendChild(btn);

    var bd = document.createElement('div');
    bd.id = 'sz-drawer-backdrop';
    document.body.appendChild(bd);

    function open() {
      document.body.classList.add('sz-drawer-open');
      btn.innerHTML = '<span class="material-symbols-outlined">close</span>';
      btn.setAttribute('aria-label', 'Close menu');
    }
    function close() {
      document.body.classList.remove('sz-drawer-open');
      btn.innerHTML = '<span class="material-symbols-outlined">menu</span>';
      btn.setAttribute('aria-label', 'Open menu');
    }
    btn.addEventListener('click', function () {
      if (document.body.classList.contains('sz-drawer-open')) close();
      else open();
    });
    bd.addEventListener('click', close);
    // Auto-close after navigating to a sidebar link
    hasSidebar.addEventListener('click', function (e) {
      if (e.target.closest('a[href]')) close();
    });
    // Auto-close on Escape
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    // Auto-close if viewport grows past the breakpoint
    var mq = window.matchMedia('(min-width: 768px)');
    if (mq.addEventListener) mq.addEventListener('change', function (e) { if (e.matches) close(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectChrome);
  } else {
    injectChrome();
  }
})();
