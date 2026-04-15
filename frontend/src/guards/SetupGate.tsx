import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/utils/api';

interface CheckSetupResponse {
  success: boolean;
  data:    { hasAdmin: boolean };
}

// Runs once on app mount. If zero admins exist in the DB, force the user
// onto /setup (the one-time admin creation page). If an admin already
// exists and the user somehow lands on /setup, bounce them to /signin.
// All other routes are left alone — existing guards handle the rest.
export default function SetupGate({ children }: Readonly<{ children: ReactNode }>) {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authApi.checkSetup() as CheckSetupResponse;
        if (cancelled) return;
        const hasAdmin = res?.data?.hasAdmin ?? true;
        const path = globalThis.location.pathname;
        if (!hasAdmin && path !== '/setup') {
          navigate('/setup', { replace: true });
        } else if (hasAdmin && path === '/setup') {
          navigate('/signin', { replace: true });
        }
      } catch {
        // Backend unreachable — don't block the app. The user may already
        // be logged in via cached localStorage; /signin will retry on its own.
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => { cancelled = true; };
    // Intentionally run once on mount — the Setup page's own guard handles
    // post-creation navigation, so we don't need to re-check per-route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-container border-t-primary" />
      </div>
    );
  }
  return <>{children}</>;
}
