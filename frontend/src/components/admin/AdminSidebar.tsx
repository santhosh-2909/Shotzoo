import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import LogoutModal from '@/components/LogoutModal';

const NAV_ITEMS = [
  { to: '/admin/attendance',     icon: 'calendar_today', label: 'Attendance'         },
  { to: '/admin/add-task',       icon: 'add_task',       label: 'Add Task'           },
  { to: '/admin/my-tasks',       icon: 'task_alt',       label: 'My Tasks'           },
  { to: '/admin/all-tasks',      icon: 'assignment',     label: 'All Tasks'          },
  { to: '/admin/employees',      icon: 'group',          label: 'Employees'          },
  { to: '/admin/analytics',      icon: 'analytics',      label: 'Analytics'          },
  { to: '/admin/dashboard',      icon: 'dashboard',      label: 'Dashboard'          },
  { to: '/admin/notifications',  icon: 'mic',            label: 'Send Notification'  },
] as const;

export default function AdminSidebar() {
  const [showLogout, setShowLogout] = useState(false);

  return (
    <>
      <nav className="fixed left-0 top-0 h-screen w-72 bg-[#2A313D] z-50 shadow-[4px_0_20px_rgba(0,0,0,0.3)] overflow-y-auto">
        <div className="flex flex-col min-h-full py-8 px-6 gap-y-2">
        {/* Brand */}
        <NavLink
          to="/landing"
          className="mb-10 px-2 flex items-center gap-3 group hover:opacity-90 transition-opacity"
        >
          <div className="w-10 h-10 bg-primary-container rounded-lg flex items-center justify-center overflow-hidden">
            <img src="/company_logo.jpeg" alt="ShotZoo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h2 className="font-bold text-lg tracking-tighter font-headline leading-tight text-white group-hover:text-[#A8CD62] transition-colors">
              Admin Panel
            </h2>
            <p className="text-[11px] text-white/40 uppercase tracking-widest font-medium font-headline">
              ShotZoo
            </p>
          </div>
        </NavLink>

        {/* Navigation */}
        <div className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                isActive
                  ? 'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-150 text-white font-bold bg-[#A8CD62] mx-2 my-1'
                  : 'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors duration-150 text-white/60 hover:text-white hover:bg-white/10 mx-2 my-1'
              }
            >
              <span className="material-symbols-outlined">{icon}</span>
              <span className="font-headline font-medium text-sm">{label}</span>
            </NavLink>
          ))}
        </div>

        {/* Bottom: Settings + Logout */}
        <div className="mt-auto pt-8 border-t border-white/10 flex flex-col gap-1">
          <NavLink
            to="/admin/profile"
            className={({ isActive }) =>
              isActive
                ? 'flex items-center gap-3 px-4 py-3 rounded-lg text-white font-bold bg-[#A8CD62] mx-2 my-1'
                : 'flex items-center gap-3 px-4 py-3 rounded-xl text-white/60 hover:text-white hover:bg-white/10 mx-2 my-1 transition-colors duration-150'
            }
          >
            <span className="material-symbols-outlined">settings</span>
            <span className="font-headline font-medium text-sm">Settings</span>
          </NavLink>

          <button
            type="button"
            onClick={() => setShowLogout(true)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-error hover:bg-white/10 mx-2 my-1 transition-colors duration-150 w-full text-left"
          >
            <span className="material-symbols-outlined">logout</span>
            <span className="font-headline font-medium text-sm">Log out</span>
          </button>
        </div>
        </div>
      </nav>

      {showLogout && <LogoutModal onClose={() => setShowLogout(false)} />}
    </>
  );
}
