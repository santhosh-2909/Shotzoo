import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Wraps all /employee/* routes.
 * - Redirects to /signin if no token is present.
 * - Applies the employee (dark) CSS variable theme.
 */
export default function EmployeeGuard() {
  const { token } = useAuth();
  const { setPortal } = useTheme();

  useEffect(() => {
    setPortal('employee');
  }, [setPortal]);

  if (!token) return <Navigate to="/signin" replace />;
  return <Outlet />;
}
