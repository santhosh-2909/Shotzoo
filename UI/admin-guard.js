// ShotZoo Admin Guard — include on every admin page
(function () {
    var tok = localStorage.getItem('shotzoo_token');
    var isAdmin = localStorage.getItem('shotzoo_admin');
    if (!tok || isAdmin !== 'true') {
        globalThis.location.href = '/admin';
        return;
    }
    // Populate data-admin-* elements
    document.addEventListener('DOMContentLoaded', function () {
        try {
            var u = JSON.parse(localStorage.getItem('shotzoo_user') || '{}');
            document.querySelectorAll('[data-admin-name]').forEach(function (el) { el.textContent = u.fullName || 'Admin'; });
            document.querySelectorAll('[data-admin-role]').forEach(function (el) { el.textContent = u.role || 'Administrator'; });
            document.querySelectorAll('[data-admin-id]').forEach(function (el) { el.textContent = u.employeeId || ''; });
        } catch (e) { }
    });
    // Logout handler (clicks on logout links) — confirmation modal first
    function doLogout() {
        localStorage.removeItem('shotzoo_admin');
        localStorage.removeItem('shotzoo_token');
        localStorage.removeItem('shotzoo_user');
        globalThis.location.href = '/';
    }

    function showLogoutModal() {
        if (document.getElementById('shotzoo-logout-modal')) return;
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

        function close() {
            overlay.remove();
            document.removeEventListener('keydown', onKey);
        }
        function onKey(e) { if (e.key === 'Escape') close(); }
        document.addEventListener('keydown', onKey);

        overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
        document.getElementById('sz-logout-cancel').addEventListener('click', close);
        document.getElementById('sz-logout-confirm').addEventListener('click', function () { close(); doLogout(); });

        var cancelBtn = document.getElementById('sz-logout-cancel');
        cancelBtn.addEventListener('mouseenter', function () { cancelBtn.style.background = '#F9FAFB'; });
        cancelBtn.addEventListener('mouseleave', function () { cancelBtn.style.background = '#fff'; });
        var confirmBtn = document.getElementById('sz-logout-confirm');
        confirmBtn.addEventListener('mouseenter', function () { confirmBtn.style.filter = 'brightness(1.08)'; });
        confirmBtn.addEventListener('mouseleave', function () { confirmBtn.style.filter = 'none'; });
    }

    // Capture-phase so we always intercept before any per-page handler
    document.addEventListener('click', function (e) {
        var a = e.target.closest('a[href="/"]');
        if (!a) return;
        var icon = a.querySelector('.material-symbols-outlined');
        if (icon && icon.textContent.trim() === 'logout') {
            e.preventDefault();
            e.stopImmediatePropagation();
            showLogoutModal();
        }
    }, true);

    // ========================================================
    // Responsive sidebar drawer (mobile / tablet < 768px)
    // ========================================================
    // Same pattern as the employee side (api.js). Hamburger toggles a class on
    // <body> that slides the fixed `nav.left-0` sidebar in/out, kills the
    // ml-72 main-content offset, and force-stacks naive grid-cols-N grids.
    if (!document.getElementById('sz-responsive-css')) {
        var css = document.createElement('style');
        css.id = 'sz-responsive-css';
        css.textContent =
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
            '  body main.ml-72,' +
            '  body main[class*="ml-72"],' +
            '  body div.ml-72 {' +
            '    margin-left: 0 !important;' +
            '  }' +
            '  body main { padding-left: 1rem !important; padding-right: 1rem !important; padding-top: 4.5rem !important; }' +
            /* Any fixed top app-bar must shift right past the 44px hamburger + 12px gutter */
            '  body header.fixed.top-0 { left: 56px !important; }' +
            '  #sz-hamburger { display: flex !important; }' +
            '  body.sz-drawer-open #sz-drawer-backdrop { opacity: 1; pointer-events: auto; }' +
            '  body table { display: block; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }' +
            '  body .grid.grid-cols-2:not(.md\\:grid-cols-2):not([class*="md:grid-cols"]),' +
            '  body .grid.grid-cols-3:not([class*="md:grid-cols"]):not([class*="lg:grid-cols"]),' +
            '  body .grid.grid-cols-4:not([class*="md:grid-cols"]):not([class*="lg:grid-cols"]) {' +
            '    grid-template-columns: minmax(0, 1fr) !important;' +
            '  }' +
            '}' +
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
    }

    function injectChrome() {
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
        hasSidebar.addEventListener('click', function (e) {
            if (e.target.closest('a[href]')) close();
        });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
        var mq = window.matchMedia('(min-width: 768px)');
        if (mq.addEventListener) mq.addEventListener('change', function (e) { if (e.matches) close(); });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectChrome);
    } else {
        injectChrome();
    }
})();
