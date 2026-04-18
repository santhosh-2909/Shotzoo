import { useEffect, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { useTheme } from '@/contexts/ThemeContext';
import { adminApi } from '@/utils/api';
import type { Task, TaskStatus, User } from '@/types';
import TaskDetailModal from '@/components/tasks/TaskDetailModal';

type StatusFilter = '' | TaskStatus;

export default function AllTasks() {
  const { setPortal } = useTheme();
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [filtered, setFiltered] = useState<Task[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isModalOpen,    setIsModalOpen]    = useState(false);

  const loadTasks = useCallback(() => {
    setLoading(true);
    (adminApi.tasks() as Promise<{ success: boolean; tasks: Task[] }>)
      .then(d => { if (d.success) setAllTasks(d.tasks || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { setPortal('admin'); }, [setPortal]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const applyFilters = useCallback(() => {
    let result = allTasks;
    if (statusFilter) result = result.filter(t => t.status === statusFilter);
    if (priorityFilter) result = result.filter(t => t.priority === priorityFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.tags || []).some(tag => tag.toLowerCase().includes(q)) ||
        t._id.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [allTasks, statusFilter, priorityFilter, search]);

  useEffect(() => { applyFilters(); }, [applyFilters]);

  function showToast(msg: string) {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  }

  function exportXlsx() {
    if (!filtered.length) return;
    const rows = filtered.map(t => ({
      Assignee: typeof t.user === 'object' ? (t.user as User).fullName : t.user,
      Title: t.title,
      Priority: t.priority,
      Deadline: t.deadline ? new Date(t.deadline).toLocaleDateString() : '',
      Status: t.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
    XLSX.writeFile(wb, 'tasks.xlsx');
    showToast('Tasks exported successfully');
  }

  function remindOverdue() {
    const overdueTasks = allTasks.filter(t => t.status === 'Overdue');
    if (!overdueTasks.length) { showToast('No overdue tasks found'); return; }
    showToast(`Reminder queued for ${overdueTasks.length} overdue task(s)`);
  }

  function timeRemaining(deadline?: string): string {
    if (!deadline) return '—';
    const diff = new Date(deadline).getTime() - Date.now();
    if (diff < 0) {
      const d = Math.floor(-diff / 86400000);
      const h = Math.floor((-diff % 86400000) / 3600000);
      return `- ${d}d ${h}h`;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    return `${d}d ${h}h`;
  }

  const overdueCount = allTasks.filter(t => t.status === 'Overdue').length;

  const STATUS_PILLS: { label: string; value: StatusFilter; cls: string; activeCls: string }[] = [
    { label: 'All', value: '', cls: 'bg-[#e7eefe] text-[#444939]', activeCls: 'bg-[#a8cd62] text-white' },
    { label: 'Pending', value: 'Pending', cls: 'bg-[#e2e8f8] text-[#444939]', activeCls: 'bg-[#a8cd62] text-white' },
    { label: 'In Progress', value: 'In Progress', cls: 'bg-[#e2e8f8] text-[#444939]', activeCls: 'bg-[#a8cd62] text-white' },
    { label: 'Completed', value: 'Completed', cls: 'bg-[#e2e8f8] text-[#444939]', activeCls: 'bg-[#a8cd62] text-white' },
    { label: 'Overdue', value: 'Overdue', cls: 'bg-[#ffdad6] text-[#ba1a1a]', activeCls: 'bg-[#ba1a1a] text-white' },
  ];

  const PRIORITY_DOT: Record<string, string> = {
    High: 'bg-[#ba1a1a]', Urgent: 'bg-[#ba1a1a]', Medium: 'bg-[#ffb044]', Low: 'bg-stone-400',
  };
  const PRIORITY_TEXT: Record<string, string> = {
    High: 'text-[#ba1a1a]', Urgent: 'text-[#ba1a1a]', Medium: 'text-[#ffb044]', Low: 'text-stone-400',
  };
  const STATUS_BADGE: Record<string, string> = {
    Overdue: 'bg-[#ffdad6] text-[#ba1a1a]',
    'In Progress': 'bg-[#dbeafe] text-[#0058be]',
    Completed: 'bg-[#dcfce7] text-[#166534]',
    Pending: 'bg-[#e2e8f8] text-[#444939]',
  };

  return (
    <div className="animate-fade-in pt-10 px-8 pb-24 min-h-screen">
      {/* Toast */}
      <div
        className={`fixed top-6 right-6 bg-[#2A313D] text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-2 z-[999] transition-all duration-300 pointer-events-none ${
          toastVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-5'
        }`}
      >
        <span className="material-symbols-outlined text-[#a8cd62]">check_circle</span>
        <span className="font-bold text-sm">{toast}</span>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h2 className="text-4xl md:text-5xl font-headline font-bold text-on-surface tracking-tight">All Tasks</h2>
              <span className="bg-[#a8cd62]/20 text-[#3c5600] px-3 py-1 rounded-full font-mono text-lg font-bold">{loading ? '…' : filtered.length}</span>
            </div>
            <p className="text-[#444939] font-medium text-lg opacity-80">Managing institutional workflow and editorial assignments.</p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={remindOverdue}
              className="bg-[#ffdad6] text-[#ba1a1a] px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2 hover:bg-[#ba1a1a]/20 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-[20px]">notification_important</span>
              Remind All Overdue
            </button>
            <button
              type="button"
              onClick={exportXlsx}
              disabled={!filtered.length}
              className="bg-[#a8cd62] text-white px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2 hover:bg-[#96B856] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[20px]">download</span>
              Export
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-[#f0f3ff] p-4 mb-8 flex flex-col lg:flex-row items-center gap-6 rounded-xl">
          <div className="flex-1 overflow-x-auto w-full no-scrollbar">
            <label className="block text-[10px] uppercase tracking-wider font-bold text-[#444939] mb-1 ml-1">Status View</label>
            <div className="flex items-center gap-2 whitespace-nowrap">
              {STATUS_PILLS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setStatusFilter(p.value)}
                  className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${statusFilter === p.value ? p.activeCls : p.cls}`}
                >
                  {p.label}
                  {p.value === 'Overdue' && overdueCount > 0 && (
                    <span className="ml-1 text-[10px] bg-[#ba1a1a] text-white px-1.5 rounded-full">{overdueCount}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="w-full lg:w-40">
            <label className="block text-[10px] uppercase tracking-wider font-bold text-[#444939] mb-1 ml-1">Priority</label>
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              aria-label="Filter by priority"
              className="w-full bg-white border-none rounded-lg text-sm font-semibold text-on-surface focus:ring-2 focus:ring-[#A8CD62] px-3 py-2"
            >
              <option value="">Any Priority</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>
          <div className="w-full lg:w-64 relative">
            <label className="block text-[10px] uppercase tracking-wider font-bold text-[#444939] mb-1 ml-1">Search Tasks</label>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 bg-white border-none rounded-lg text-sm font-semibold text-on-surface focus:ring-2 focus:ring-[#A8CD62] py-2 px-3"
              placeholder="ID, Title, or Tag…"
              type="text"
            />
            <span className="material-symbols-outlined absolute left-3 top-[30px] text-stone-400 text-[20px]">search</span>
          </div>
        </div>

        {/* Task Table */}
        <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f0f3ff]/50">
                  {['Assignee', 'Task Detail', 'Priority', 'Deadline', 'Time Remaining', 'Status', 'Actions'].map(h => (
                    <th key={h} className={`px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-[#444939] ${h === 'Status' ? 'text-center' : h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f3ff]">
                {loading ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-stone-400 text-sm">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-stone-400 text-sm">No tasks match your filters.</td></tr>
                ) : (
                  filtered.map(t => {
                    const assignee = typeof t.user === 'object' ? (t.user as User).fullName : 'Assigned';
                    const dl = t.deadline ? new Date(t.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
                    const tr_ = timeRemaining(t.deadline);
                    const isOverdue = t.status === 'Overdue';
                    const isCompleted = t.status === 'Completed';
                    const dotCls = PRIORITY_DOT[t.priority] ?? 'bg-stone-400';
                    const txtCls = PRIORITY_TEXT[t.priority] ?? 'text-stone-400';
                    const badgeCls = STATUS_BADGE[t.status] ?? 'bg-stone-100 text-stone-600';
                    return (
                      <tr
                        key={t._id}
                        onClick={() => { setSelectedTaskId(t._id); setIsModalOpen(true); }}
                        className={`hover:bg-[#f0f3ff] transition-colors cursor-pointer border-l-4 ${isOverdue ? 'border-[#ba1a1a]' : 'border-transparent'}`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#e7eefe] flex items-center justify-center text-xs font-bold text-[#444939]">
                              {(assignee || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-sm font-bold text-on-surface">{assignee}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="max-w-xs">
                            <p className={`text-sm font-bold text-on-surface truncate ${isCompleted ? 'line-through opacity-50' : ''}`}>{t.title}</p>
                            <p className="text-[11px] text-[#444939] uppercase font-mono">ID: {t._id.slice(-6).toUpperCase()}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${dotCls}`} />
                            <span className={`text-xs font-bold uppercase ${txtCls}`}>{t.priority}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-on-surface">{dl}</td>
                        <td className="px-6 py-4">
                          {isCompleted
                            ? <span className="material-symbols-outlined text-[#496800] text-[20px]">check_circle</span>
                            : <span className={`font-mono text-xs font-bold ${isOverdue ? 'text-[#ba1a1a]' : 'text-[#ffb044]'}`}>{tr_}</span>
                          }
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight ${badgeCls}`}>{t.status}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); setSelectedTaskId(t._id); setIsModalOpen(true); }}
                              className="material-symbols-outlined text-stone-400 hover:text-[#496800] transition-colors p-1.5 rounded-md hover:bg-[#a8cd62]/10"
                            >
                              visibility
                            </button>
                            {isOverdue && (
                              <button
                                type="button"
                                onClick={e => e.stopPropagation()}
                                className="material-symbols-outlined text-[#ba1a1a] hover:scale-110 transition-transform p-1.5 rounded-md hover:bg-[#ba1a1a]/10"
                              >
                                notifications_active
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <TaskDetailModal
        taskId={selectedTaskId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onStatusUpdate={loadTasks}
      />
    </div>
  );
}
