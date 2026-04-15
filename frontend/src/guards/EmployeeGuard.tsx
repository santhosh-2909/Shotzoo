import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Wraps all /employee/* routes.
 * - Redirects to /signin if no token is present.
 * - Redirects to /unauthorized if logged in as an admin (employee
 *   pages are employee-only — admins use /admin/*).
 * - Applies the employee (dark) CSS variable theme.
 */
export default function EmployeeGuard() {
  const { token, isAdmin } = useAuth();
  const { setPortal } = useTheme();

  useEffect(() => {
    setPortal('employee');
  }, [setPortal]);

  if (!token)  return <Navigate to="/signin"       replace />;
  if (isAdmin) return <Navigate to="/unauthorized" replace />;
  return <Outlet />;
}
