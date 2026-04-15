import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import LogoutModal from '@/components/LogoutModal';

const NAV_ITEMS = [
  { to: '/employee/attendance',     icon: 'event_available', label: 'Attendance'    },
  { to: '/employee/add-task',       icon: 'add_circle',      label: 'Add Task'      },
  { to: '/employee/daily-reports',  icon: 'description',     label: 'Daily Reports' },
  { to: '/employee/my-tasks',       icon: 'assignment',      label: 'My Tasks'      },
  { to: '/employee/notifications',  icon: 'notifications',   label: 'Notifications' },
  { to: '/employee/dashboard',      icon: 'dashboard',       label: 'Dashboard'     },
  { to: '/employee/profile',        icon: 'person',          label: 'My Profile'    },
] as const;

export default function EmployeeSidebar() {
  const { user, avatarUrl } = useAuth();
  const [showLogout, setShowLogout] = useState(false);

  return (
    <>
      <aside className="h-screen w-72 fixed left-0 top-0 bg-[#2A2A2A] shadow-[40px_0_40px_rgba(240,240,240,0.06)] z-50 flex flex-col p-6 font-headline tracking-tighter">
        {/* Logo — links home (employee dashboard), NOT the public landing page */}
        <div className="text-2xl font-bold text-[#add366] mb-8">
          <NavLink to="/employee/dashboard" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <img src="/company_logo.jpeg" alt="ShotZoo" className="w-8 h-8 object-contain" />
            <span>ShotZoo</span>
          </NavLink>
        </div>

        {/* User info */}
        <div className="flex flex-col gap-1 mb-10 px-4">
          <div className="w-14 h-14 rounded-2xl overflow-hidden mb-3 ring-2 ring-[#add366]/20">
            <img src={avatarUrl} alt="User avatar" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-white text-lg font-bold">{user?.fullName ?? 'User'}</h2>
          <p className="text-white/40 text-xs tracking-widest uppercase">
            ID: {user?.employeeId ?? 'N/A'}
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-2 flex-grow">
          {NAV_ITEMS.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                'sidebar-item' + (isActive ? ' active' : '')
              }
            >
              <span className="material-symbols-outlined">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="mt-auto pt-6 border-t border-black/5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowLogout(true)}
            className="sidebar-item w-full text-left"
          >
            <span className="material-symbols-outlined">logout</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {showLogout && <LogoutModal onClose={() => setShowLogout(false)} />}
    </>
  );
}
