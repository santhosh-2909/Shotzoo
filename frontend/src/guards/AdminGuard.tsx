import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Wraps all /admin/* routes.
 * - Redirects to /signin if no token is present.
 * - Redirects to /unauthorized if logged in but not admin (hard denial
 *   instead of silently bouncing employees to their own home).
 * - Applies the admin (light) CSS variable theme.
 */
export default function AdminGuard() {
  const { token, isAdmin } = useAuth();
  const { setPortal } = useTheme();

  useEffect(() => {
    setPortal('admin');
  }, [setPortal]);

  if (!token)   return <Navigate to="/signin"        replace />;
  if (!isAdmin) return <Navigate to="/unauthorized"  replace />;
  return <Outlet />;
}
