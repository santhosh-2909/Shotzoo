import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { useTheme } from '@/contexts/ThemeContext';
import { adminApi } from '@/utils/api';
import type { Task, User } from '@/types';

interface AdminStats {
  completedToday: number;
  openTasks: number;
  totalEmployees: number;
  overdueCount: number;
}

export default function AdminDashboard() {
  const { setPortal } = useTheme();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => { setPortal('admin'); }, [setPortal]);

  useEffect(() => {
    Promise.all([
      adminApi.stats() as Promise<{ success: boolean; stats: AdminStats }>,
      adminApi.tasks() as Promise<{ success: boolean; tasks: Task[] }>,
    ])
      .then(([statsRes, tasksRes]) => {
        if (statsRes.success) setStats(statsRes.stats);
        if (tasksRes.success) setTasks(tasksRes.tasks || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  }

  function exportCsv() {
    if (!tasks.length) return;
    const rows = tasks.map(t => ({
      Employee: typeof t.user === 'object' ? (t.user as User).fullName : t.user,
      Title: t.title,
      Deadline: t.deadline ? new Date(t.deadline).toLocaleDateString() : '',
      Status: t.status,
      Priority: t.priority,
    }));
    const header = Object.keys(rows[0]).join(',');
    const body = rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tasks.csv';
    a.click();
    showToast('CSV exported successfully');
  }

  function exportXlsx() {
    if (!tasks.length) return;
    const rows = tasks.map(t => ({
      Employee: typeof t.user === 'object' ? (t.user as User).fullName : t.user,
      Title: t.title,
      Deadline: t.deadline ? new Date(t.deadline).toLocaleDateString() : '',
      Status: t.status,
      Priority: t.priority,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
    XLSX.writeFile(wb, 'tasks.xlsx');
    showToast('Excel exported successfully');
  }

  const statusColor: Record<string, string> = {
    Overdue: 'text-red-600 bg-red-50',
    Completed: 'text-green-700 bg-green-50',
    'In Progress': 'text-blue-600 bg-blue-50',
    Pending: 'text-stone-600 bg-stone-50',
  };

  return (
    <div className="animate-fade-in p-12">
      {/* Toast */}
      <div
        className={`fixed top-6 right-6 bg-[#2A313D] text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-2 z-[999] transition-all duration-300 pointer-events-none ${
          toastVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-5'
        }`}
      >
        <span className="material-symbols-outlined text-[#a8cd62]">info</span>
        <span className="font-bold text-sm">{toast}</span>
      </div>

      {/* Header */}
      <header className="flex justify-between items-center mb-12 w-full">
        <div>
          <h1 className="text-4xl font-bold tracking-tight font-headline text-black">Dashboard</h1>
          <p className="text-stone-500 mt-1">Editorial oversight &amp; operations control center.</p>
        </div>
      </header>

      {/* Stats Grid */}
      <section className="grid grid-cols-3 gap-6 mb-12">
        <div className="bg-white p-8 rounded-xl flex flex-col gap-4">
          <span className="material-symbols-outlined text-[#a8cd62] text-3xl">trending_up</span>
          <div>
            <p className="text-stone-400 text-xs font-medium uppercase tracking-wider mb-1">Completed Today</p>
            <h3 className="text-3xl font-bold font-headline">{loading ? '—' : (stats?.completedToday ?? 0)}</h3>
          </div>
          <div className="text-xs font-bold text-[#a8cd62]">tasks finished</div>
        </div>
        <div className="bg-white p-8 rounded-xl flex flex-col gap-4">
          <span className="material-symbols-outlined text-[#ffb044] text-3xl">pending_actions</span>
          <div>
            <p className="text-stone-400 text-xs font-medium uppercase tracking-wider mb-1">Open Tasks</p>
            <h3 className="text-3xl font-bold font-headline">{loading ? '—' : (stats?.openTasks ?? 0)}</h3>
          </div>
          <div className="text-xs font-bold text-stone-400">
            {stats && stats.overdueCount > 0 ? `${stats.overdueCount} Overdue` : ''}
          </div>
        </div>
        <div className="bg-white p-8 rounded-xl flex flex-col gap-4">
          <span className="material-symbols-outlined text-[#0058be] text-3xl">group</span>
          <div>
            <p className="text-stone-400 text-xs font-medium uppercase tracking-wider mb-1">Total Employees</p>
            <h3 className="text-3xl font-bold font-headline">{loading ? '—' : (stats?.totalEmployees ?? 0)}</h3>
          </div>
          <div className="text-xs font-bold text-stone-400">registered accounts</div>
        </div>
      </section>

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-8">

          {/* Reporting Overview */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold font-headline">Reporting Overview</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportCsv}
                  disabled={!tasks.length}
                  className="text-sm font-bold text-[#496800] flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[#a8cd62]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-sm">download</span> Export CSV
                </button>
                <button
                  type="button"
                  onClick={exportXlsx}
                  disabled={!tasks.length}
                  className="text-sm font-bold text-white bg-[#a8cd62] hover:brightness-110 flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-sm">table_view</span> Export Excel
                </button>
              </div>
            </div>
            <div className="bg-white rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#f0f3ff]">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-stone-500">Name / Role</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-stone-500">Title</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-stone-500 text-center">Deadline</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-stone-500 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-stone-400 text-sm">Loading task data…</td></tr>
                  ) : tasks.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-stone-400 text-sm">No tasks yet.</td></tr>
                  ) : (
                    tasks.slice(0, 8).map(t => {
                      const emp = typeof t.user === 'object' ? (t.user as User).fullName : 'Unassigned';
                      const dl = t.deadline ? new Date(t.deadline).toLocaleDateString() : '—';
                      const sc = statusColor[t.status] ?? 'text-stone-600 bg-stone-50';
                      return (
                        <tr key={t._id} className="hover:bg-[#a8cd62]/5 transition-colors">
                          <td className="px-6 py-4"><span className="text-sm font-bold">{emp}</span></td>
                          <td className="px-6 py-4 text-sm font-medium">{t.title}</td>
                          <td className="px-6 py-4 text-sm text-center">{dl}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${sc}`}>{t.status}</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Right Column: Urgent Deadlines */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-8">
          <section>
            <h2 className="text-2xl font-bold font-headline mb-6">Urgent Deadlines</h2>
            <div className="bg-white p-8 rounded-xl flex flex-col gap-8">
              {tasks.filter(t => t.status === 'Overdue' || t.status === 'In Progress').slice(0, 2).length === 0 ? (
                <p className="text-stone-400 text-sm">No urgent deadlines.</p>
              ) : (
                tasks.filter(t => t.status === 'Overdue' || t.status === 'In Progress').slice(0, 2).map(t => {
                  const isOverdue = t.status === 'Overdue';
                  const dl = t.deadline ? new Date(t.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
                  return (
                    <div
                      key={t._id}
                      className={`relative pl-6 before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:rounded-full ${isOverdue ? 'before:bg-[#ba1a1a]' : 'before:bg-[#ffb044]'}`}
                    >
                      <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isOverdue ? 'text-[#ba1a1a]' : 'text-[#ffb044]'}`}>{dl}</p>
                      <h4 className="text-lg font-bold font-headline">{t.title}</h4>
                      <p className="text-sm text-stone-500 mt-2">{t.description || 'No description.'}</p>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
