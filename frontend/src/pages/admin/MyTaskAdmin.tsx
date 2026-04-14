import { useEffect, useState, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { adminApi } from '@/utils/api';
import type { Task, TaskStatus } from '@/types';

type ViewMode = 'board' | 'list';

const PRIORITY_CLS: Record<string, string> = {
  High: 'bg-[#d8e9b4] text-[#131f00]',
  Medium: 'bg-[#e2e8f8] text-[#444939]',
  Low: 'bg-[#e2e8f8] text-[#444939]',
  Urgent: 'bg-[#ffdad6] text-[#ba1a1a]',
};
const STATUS_CLS: Record<string, string> = {
  Pending: 'bg-[#dce2f3] text-[#444939]',
  'In Progress': 'bg-[#2170e4] text-white',
  Completed: 'bg-[#a8cd62] text-[#3c5600]',
  Overdue: 'bg-[#ffdad6] text-[#ba1a1a]',
};
const NEXT_STATUS: Record<string, TaskStatus> = {
  Pending: 'In Progress',
  'In Progress': 'Completed',
  Overdue: 'In Progress',
};
const COLS: { id: string; status: TaskStatus; label: string }[] = [
  { id: 'Pending', status: 'Pending', label: 'Pending' },
  { id: 'In Progress', status: 'In Progress', label: 'In Progress' },
  { id: 'Completed', status: 'Completed', label: 'Completed' },
  { id: 'Overdue', status: 'Overdue', label: 'Overdue' },
];

export default function MyTaskAdmin() {
  const { setPortal } = useTheme();
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [filtered, setFiltered] = useState<Task[]>([]);
  const [view, setView] = useState<ViewMode>('board');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => { setPortal('admin'); }, [setPortal]);

  useEffect(() => {
    // Fetch tasks assigned to the logged-in admin
    (adminApi.tasks() as Promise<{ success: boolean; tasks: Task[] }>)
      .then(d => { if (d.success) setAllTasks(d.tasks || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const applyFilters = useCallback(() => {
    let result = allTasks;
    if (statusFilter) result = result.filter(t => t.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q));
    }
    setFiltered(result);
  }, [allTasks, statusFilter, search]);

  useEffect(() => { applyFilters(); }, [applyFilters]);

  function showToast(msg: string) {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  }

  async function moveTask(id: string, nextStatus: TaskStatus) {
    setUpdating(id);
    try {
      await adminApi.tasks(`status=${nextStatus}`);
      setAllTasks(prev => prev.map(t => t._id === id ? { ...t, status: nextStatus } : t));
      showToast(`Task moved to ${nextStatus}`);
    } catch {
      showToast('Failed to update task');
    } finally {
      setUpdating(null);
    }
  }

  function TaskCard({ t }: { t: Task }) {
    const dl = t.deadline ? new Date(t.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    const pCls = PRIORITY_CLS[t.priority] ?? PRIORITY_CLS.Medium;
    const isCompleted = t.status === 'Completed';
    const isOverdue = t.status === 'Overdue';
    const next = NEXT_STATUS[t.status];
    const borderCls = t.status === 'In Progress' ? 'border-l-4 border-[#a8cd62]' : isOverdue ? 'border border-[#ffdad6]' : '';
    return (
      <div className={`bg-white p-5 rounded-[1.25rem] shadow-[0_10px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.08)] transition-shadow ${borderCls}`}>
        <div className="flex justify-between items-start mb-4">
          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${pCls}`}>{t.priority}</span>
          {isCompleted && <span className="material-symbols-filled text-[#a8cd62]">check_circle</span>}
        </div>
        <h4 className={`font-headline font-bold text-on-surface leading-tight ${isCompleted ? 'line-through decoration-[#a8cd62] decoration-2' : ''}`}>{t.title}</h4>
        <div className="mt-6 flex items-center justify-between text-[#444939]/60">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">{isOverdue ? 'warning' : 'calendar_month'}</span>
            <span className={`text-[11px] font-bold ${isOverdue ? 'text-[#ba1a1a]' : ''}`}>{dl}</span>
          </div>
        </div>
        {next && (
          <button
            type="button"
            disabled={updating === t._id}
            onClick={() => moveTask(t._id, next)}
            className="mt-3 w-full text-center text-[10px] font-bold uppercase tracking-wider text-[#496800] bg-[#a8cd62]/10 py-2 rounded-xl hover:bg-[#a8cd62]/20 transition-colors disabled:opacity-50"
          >
            {updating === t._id ? 'Updating…' : `Move to ${next}`}
          </button>
        )}
      </div>
    );
  }

  function ListRow({ t }: { t: Task }) {
    const dl = t.deadline ? new Date(t.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
    const pCls = PRIORITY_CLS[t.priority] ?? PRIORITY_CLS.Medium;
    const sCls = STATUS_CLS[t.status] ?? '';
    const next = NEXT_STATUS[t.status];
    return (
      <tr className="hover:bg-black/[0.02] transition-colors">
        <td className="px-6 py-4 font-bold text-on-surface">{t.title}</td>
        <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${pCls}`}>{t.priority}</span></td>
        <td className="px-6 py-4 text-[#444939] text-sm">{dl}</td>
        <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-bold ${sCls}`}>{t.status}</span></td>
        <td className="px-6 py-4 text-right">
          {next && (
            <button
              type="button"
              disabled={updating === t._id}
              onClick={() => moveTask(t._id, next)}
              className="text-[10px] font-bold uppercase tracking-wider text-[#496800] bg-[#a8cd62]/10 px-3 py-1.5 rounded-xl hover:bg-[#a8cd62]/20 transition-colors disabled:opacity-50"
            >
              {updating === t._id ? '…' : next}
            </button>
          )}
        </td>
      </tr>
    );
  }

  const STATUS_BTNS = ['', 'Pending', 'In Progress', 'Completed', 'Overdue'];

  return (
    <div className="animate-fade-in min-h-screen bg-[#F7F8F4] overflow-y-auto">
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
      <header className="px-10 pt-12 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="font-headline text-5xl font-extrabold tracking-tighter text-on-surface">My Tasks</h1>
          <p className="text-[#444939]/80 font-medium mt-2">Your personal admin tasks and assignments.</p>
        </div>
        <div className="bg-[#e2e8f8]/20 p-1.5 rounded-2xl flex items-center">
          <button
            type="button"
            data-view="list"
            onClick={() => setView('list')}
            className={`px-6 py-2.5 rounded-xl font-headline font-bold text-sm transition-all ${view === 'list' ? 'bg-white text-on-surface shadow-sm' : 'text-[#444939] hover:text-on-surface'}`}
          >
            List
          </button>
          <button
            type="button"
            data-view="board"
            onClick={() => setView('board')}
            className={`px-6 py-2.5 rounded-xl font-headline font-bold text-sm transition-all ${view === 'board' ? 'bg-white text-on-surface shadow-sm' : 'text-[#444939] hover:text-on-surface'}`}
          >
            Board
          </button>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="px-10 mb-10">
        <div className="flex flex-wrap items-center gap-4 bg-white/60 backdrop-blur-md p-4 rounded-[2rem] shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pr-4 border-r border-black/10">
            {STATUS_BTNS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-5 py-2 rounded-full text-xs font-extrabold transition-all ${
                  statusFilter === s
                    ? 'bg-[#496800] text-white'
                    : 'bg-[#e2e8f8] text-[#444939] hover:bg-[#dce2f3]'
                }`}
              >
                {s || 'All'}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#444939]/60 text-lg">search</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-[#e2e8f8]/10 border-none rounded-2xl focus:ring-2 focus:ring-[#a8cd62] text-sm text-black placeholder:text-gray-500"
              placeholder="Search tasks…"
              type="text"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="px-10 text-center text-stone-400 py-16">Loading…</div>
      ) : (
        <>
          {/* List View */}
          {view === 'list' && (
            <div className="px-10 pb-20">
              <div className="bg-white rounded-3xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#e2e8f8]/30">
                      {['Task', 'Priority', 'Deadline', 'Status', 'Action'].map((h, i) => (
                        <th key={h} className={`px-6 py-4 font-headline text-sm font-bold text-[#444939] ${i === 4 ? 'text-right' : ''}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {filtered.length === 0
                      ? <tr><td colSpan={5} className="px-6 py-12 text-center text-[#444939]">No tasks match your filters</td></tr>
                      : filtered.map(t => <ListRow key={t._id} t={t} />)
                    }
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Board View */}
          {view === 'board' && (
            <div className="px-10 pb-20 overflow-x-auto flex gap-8">
              {COLS.map(col => {
                const colTasks = filtered.filter(t => t.status === col.status);
                const isError = col.status === 'Overdue';
                return (
                  <div key={col.id} className="flex-shrink-0 w-80">
                    <div className="flex items-center justify-between mb-6 px-2">
                      <h3 className={`font-headline font-bold text-lg flex items-center gap-2 ${isError ? 'text-[#ba1a1a]' : 'text-on-surface'}`}>
                        {col.label}
                        <span className={`px-2 py-0.5 rounded-lg text-xs ${isError ? 'bg-[#ffdad6] text-[#ba1a1a]' : 'bg-[#e2e8f8]/20 text-[#444939]'}`}>{colTasks.length}</span>
                      </h3>
                    </div>
                    <div className="space-y-4">
                      {colTasks.length === 0
                        ? <p className="text-center text-[#444939]/60 py-8 text-sm">No tasks</p>
                        : colTasks.map(t => <TaskCard key={t._id} t={t} />)
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
