import { Outlet } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';

/**
 * Shell for all /admin/* pages.
 * Renders the fixed dark sidebar + main content area at ml-72.
 */
export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-[#F7F8F4] text-on-surface">
      <AdminSidebar />
      <main className="ml-72 min-h-screen p-12">
        <Outlet />
      </main>
    </div>
  );
}
