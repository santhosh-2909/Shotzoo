import { Outlet } from 'react-router-dom';
import EmployeeSidebar from '@/components/employee/EmployeeSidebar';

/**
 * Shell for all /employee/* pages.
 * Renders the fixed sidebar + main content area at ml-72.
 */
export default function EmployeeLayout() {
  return (
    <div className="min-h-screen bg-background text-on-surface">
      <EmployeeSidebar />
      <main className="ml-72 min-h-screen p-10 relative overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
