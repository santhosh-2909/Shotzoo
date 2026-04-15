import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

// Real 404 page. Replaces the old "redirect any unknown route to /splash"
// behavior so typos like /admjn/attendance don't silently bounce users
// back to the landing page with no feedback.
export default function NotFound() {
  const navigate           = useNavigate();
  const location           = useLocation();
  const { token, isAdmin } = useAuth();
  const { setPortal }      = useTheme();

  useEffect(() => { setPortal('auth'); }, [setPortal]);

  const goHome = (): void => {
    if (!token) {
      navigate('/signin', { replace: true });
      return;
    }
    navigate(isAdmin ? '/admin/attendance' : '/employee/dashboard', { replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-8 font-body">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary-container/10">
          <span className="material-symbols-outlined text-5xl text-primary-container">help</span>
        </div>
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary-container">
          404 — Not Found
        </p>
        <h1 className="mt-2 font-headline text-3xl font-bold tracking-tight text-on-surface">
          Page not found
        </h1>
        <p className="mt-2 text-sm font-medium text-on-surface-variant break-words">
          We couldn't find <span className="font-mono text-xs">{location.pathname}</span> in your workspace.
        </p>

        <div className="mt-8">
          <button
            type="button"
            onClick={goHome}
            className="rounded-xl bg-primary-container px-6 py-3 font-headline font-bold text-on-primary-container transition-all hover:scale-[1.02] active:scale-95"
          >
            {token ? 'Back to dashboard' : 'Back to sign in'}
          </button>
        </div>
      </div>
    </main>
  );
}
