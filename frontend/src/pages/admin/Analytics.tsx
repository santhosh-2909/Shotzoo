import { useEffect, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { adminApi } from '@/utils/api';
import type { User } from '@/types';

interface AdminStats {
  totalEmployees: number;
  completedToday: number;
  openTasks: number;
  overdueCount: number;
}

interface TaskBreakdown {
  Pending: number;
  'In Progress': number;
  Completed: number;
  Overdue: number;
}

interface AttendanceData {
  present: number;
  absent: number;
  totalEmployees: number;
}

export default function Analytics() {
  const { setPortal } = useTheme();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [taskBreakdown, setTaskBreakdown] = useState<TaskBreakdown | null>(null);
  const [totalTasks, setTotalTasks] = useState(0);
  const [attendance, setAttendance] = useState<AttendanceData | null>(null);
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setPortal('admin'); }, [setPortal]);

  useEffect(() => {
    Promise.all([
      adminApi.stats() as Promise<{ success: boolean; stats: AdminStats }>,
      adminApi.tasks() as Promise<{ success: boolean; tasks: Array<{ status: string }> }>,
      adminApi.attendance() as Promise<{ success: boolean; present: number; absent: number; totalEmployees: number }>,
      adminApi.employees() as Promise<{ success: boolean; employees: User[] }>,
    ])
      .then(([statsRes, tasksRes, attRes, empRes]) => {
        if (statsRes.success) setStats(statsRes.stats);
        if (tasksRes.success) {
          const tasks = tasksRes.tasks || [];
          const counts: TaskBreakdown = { Pending: 0, 'In Progress': 0, Completed: 0, Overdue: 0 };
          tasks.forEach(t => {
            const s = t.status as keyof TaskBreakdown;
            if (s in counts) counts[s]++;
          });
          setTaskBreakdown(counts);
          setTotalTasks(tasks.length);
        }
        if (attRes.success) setAttendance({ present: attRes.present, absent: attRes.absent, totalEmployees: attRes.totalEmployees });
        if (empRes.success) setEmployees(empRes.employees || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const STATUS_COLORS: Record<string, string> = {
    Pending: '#0058be',
    'In Progress': '#ffb044',
    Completed: '#A8CD62',
    Overdue: '#ba1a1a',
  };

  const presentPct = attendance && attendance.totalEmployees
    ? Math.round((attendance.present / attendance.totalEmployees) * 100)
    : 0;

  return (
    <div className="animate-fade-in p-12">
      {/* Header */}
      <header className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-4xl font-bold tracking-tight font-headline text-black">Analytics</h1>
          <p className="text-stone-500 mt-1">Company performance metrics and insights.</p>
        </div>
      </header>

      {/* Summary Stats */}
      <section className="grid grid-cols-4 gap-6 mb-12">
        <div className="bg-white p-8 rounded-xl flex flex-col gap-3">
          <span className="material-symbols-outlined text-[#a8cd62] text-3xl">group</span>
          <p className="text-stone-400 text-xs font-medium uppercase tracking-wider">Total Employees</p>
          <h3 className="text-3xl font-bold font-headline">{loading ? '…' : (stats?.totalEmployees ?? 0)}</h3>
        </div>
        <div className="bg-white p-8 rounded-xl flex flex-col gap-3">
          <span className="material-symbols-outlined text-[#0058be] text-3xl">assignment_turned_in</span>
          <p className="text-stone-400 text-xs font-medium uppercase tracking-wider">Tasks Completed Today</p>
          <h3 className="text-3xl font-bold font-headline">{loading ? '…' : (stats?.completedToday ?? 0)}</h3>
        </div>
        <div className="bg-white p-8 rounded-xl flex flex-col gap-3">
          <span className="material-symbols-outlined text-[#ffb044] text-3xl">pending_actions</span>
          <p className="text-stone-400 text-xs font-medium uppercase tracking-wider">Open Tasks</p>
          <h3 className="text-3xl font-bold font-headline">{loading ? '…' : (stats?.openTasks ?? 0)}</h3>
        </div>
        <div className="bg-white p-8 rounded-xl flex flex-col gap-3">
          <span className="material-symbols-outlined text-[#ba1a1a] text-3xl">warning</span>
          <p className="text-stone-400 text-xs font-medium uppercase tracking-wider">Overdue Tasks</p>
          <h3 className="text-3xl font-bold font-headline text-[#ba1a1a]">{loading ? '…' : (stats?.overdueCount ?? 0)}</h3>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-8">
        {/* Task Status Breakdown */}
        <div className="col-span-7 bg-white rounded-xl p-8">
          <h2 className="text-xl font-bold font-headline mb-6">Task Status Breakdown</h2>
          {loading ? (
            <p className="text-stone-400 text-sm">Loading…</p>
          ) : !taskBreakdown || totalTasks === 0 ? (
            <p className="text-stone-400 text-sm">No tasks yet.</p>
          ) : (
            <div className="space-y-5">
              {(Object.keys(taskBreakdown) as Array<keyof TaskBreakdown>).map(status => {
                const count = taskBreakdown[status];
                const pct = Math.round((count / totalTasks) * 100);
                const color = STATUS_COLORS[status];
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-stone-700">{status}</span>
                      <span className="text-sm font-bold" style={{ color }}>{count} ({pct}%)</span>
                    </div>
                    <div className="stat-bar">
                      <div className="stat-bar-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Attendance Today */}
        <div className="col-span-5 bg-white rounded-xl p-8">
          <h2 className="text-xl font-bold font-headline mb-6">Attendance Today</h2>
          {loading ? (
            <p className="text-stone-400 text-sm">Loading…</p>
          ) : attendance ? (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <div className="text-6xl font-extrabold font-headline text-[#a8cd62]">{presentPct}%</div>
                <p className="text-stone-400 text-sm mt-1">Attendance Rate</p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-[#A8CD62]/10 rounded-lg p-4">
                  <p className="text-2xl font-bold text-[#496800]">{attendance.present}</p>
                  <p className="text-xs text-stone-500 mt-1">Present</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-2xl font-bold text-[#ba1a1a]">{attendance.absent}</p>
                  <p className="text-xs text-stone-500 mt-1">Absent</p>
                </div>
                <div className="bg-[#e7eefe] rounded-lg p-4">
                  <p className="text-2xl font-bold text-stone-700">{attendance.totalEmployees}</p>
                  <p className="text-xs text-stone-500 mt-1">Total</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-stone-400 text-sm">No data.</p>
          )}
        </div>
      </div>

      {/* Employee List */}
      <section className="mt-8 bg-white rounded-xl p-8">
        <h2 className="text-xl font-bold font-headline mb-6">Employee Overview</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="px-4 py-3 text-xs font-bold text-stone-400 uppercase tracking-wider">Employee</th>
                <th className="px-4 py-3 text-xs font-bold text-stone-400 uppercase tracking-wider">ID</th>
                <th className="px-4 py-3 text-xs font-bold text-stone-400 uppercase tracking-wider">Role</th>
                <th className="px-4 py-3 text-xs font-bold text-stone-400 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-xs font-bold text-stone-400 uppercase tracking-wider text-right">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-400 text-sm">Loading…</td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-400 text-sm">No employees registered.</td></tr>
              ) : (
                employees.map(emp => {
                  const initials = (emp.fullName || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                  const joined = emp.createdAt
                    ? new Date(emp.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : '—';
                  return (
                    <tr key={emp._id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#a8cd62] flex items-center justify-center text-xs font-bold text-[#3c5600]">{initials}</div>
                          <span className="text-sm font-bold text-stone-900">{emp.fullName || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="font-mono text-xs text-stone-500">{emp.employeeId || '—'}</span></td>
                      <td className="px-4 py-3 text-sm text-stone-600">{emp.role || 'Employee'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#a8cd62]/20 text-[#3c5600] uppercase">{emp.employeeType || 'Office'}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-stone-400">{joined}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
