import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

// Shown when a logged-in user tries to access a route for the other
// role — e.g. an employee hitting /admin/* or an admin hitting
// /employee/*. Unauthenticated visitors are caught earlier by the
// guards and sent to /signin instead.
export default function Unauthorized() {
  const navigate               = useNavigate();
  const { token, isAdmin, logout } = useAuth();
  const { setPortal }          = useTheme();

  useEffect(() => { setPortal('auth'); }, [setPortal]);

  const goHome = (): void => {
    if (!token) {
      navigate('/', { replace: true });
      return;
    }
    navigate(isAdmin ? '/admin/attendance' : '/employee/dashboard', { replace: true });
  };

  const handleLogout = (): void => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-8 font-body">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-error/10">
          <span className="material-symbols-outlined text-5xl text-error">lock</span>
        </div>
        <h1 className="font-headline text-3xl font-bold tracking-tight text-on-surface">
          Access Denied
        </h1>
        <p className="mt-2 text-sm font-medium text-on-surface-variant">
          You don't have permission to view this page.
          {token && (isAdmin
            ? ' Admin accounts can only access the admin workspace.'
            : ' Employee accounts can only access the employee workspace.')}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={goHome}
            className="rounded-xl bg-primary-container px-6 py-3 font-headline font-bold text-on-primary-container transition-all hover:scale-[1.02] active:scale-95"
          >
            {token ? 'Go to your dashboard' : 'Go to sign in'}
          </button>
          {token && (
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border-2 border-surface-container-highest/30 px-6 py-3 font-headline font-bold text-on-surface transition-colors hover:bg-surface-container-highest/10"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
