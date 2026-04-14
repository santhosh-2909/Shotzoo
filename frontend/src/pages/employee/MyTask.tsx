import { useState, useEffect, useCallback, useRef } from 'react';
import { tasksApi } from '@/utils/api';
import type { Task, TaskStatus, TaskPriority } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_CLS: Record<TaskPriority, string> = {
  High:   'bg-secondary-fixed text-on-secondary-fixed',
  Medium: 'bg-surface-container-high/20 text-on-surface-variant',
  Low:    'bg-surface-container-high/20 text-on-surface-variant',
  Urgent: 'bg-error/10 text-error',
};

const STATUS_CLS: Record<TaskStatus, string> = {
  Pending:       'bg-surface-container-highest text-on-surface-variant',
  'In Progress': 'bg-secondary-container text-on-secondary-container',
  Completed:     'bg-primary-container text-on-primary-container',
  Overdue:       'bg-error-container text-on-error-container',
};

const NEXT_STATUS: Partial<Record<TaskStatus, TaskStatus>> = {
  Pending:       'In Progress',
  'In Progress': 'Completed',
  Overdue:       'In Progress',
};

const COLUMNS: { id: string; status: TaskStatus | null; label: string; badgeCls: string }[] = [
  { id: 'col-pending',    status: 'Pending',      label: 'Pending',     badgeCls: 'bg-surface-container-high/20 text-on-surface-variant' },
  { id: 'col-inprogress', status: 'In Progress',  label: 'In Progress', badgeCls: 'bg-primary-container/20 text-on-primary-container' },
  { id: 'col-completed',  status: 'Completed',    label: 'Completed',   badgeCls: 'bg-surface-container-high/20 text-on-surface-variant' },
  { id: 'col-overdue',    status: 'Overdue',       label: 'Overdue',    badgeCls: 'bg-error/20 text-error' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDeadline(iso?: string): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TaskCard({ task, onAction }: { task: Task; onAction: (id: string, next: TaskStatus) => void }) {
  const dlText      = formatDeadline(task.deadline);
  const pCls        = PRIORITY_CLS[task.priority] ?? PRIORITY_CLS.Medium;
  const isCompleted = task.status === 'Completed';
  const isOverdue   = task.status === 'Overdue';
  const borderCls   = task.status === 'In Progress' ? 'border-l-4 border-primary-container' : isOverdue ? 'border border-error/10' : '';
  const next        = NEXT_STATUS[task.status];

  return (
    <div className={`bg-white p-5 rounded-[1.25rem] shadow-[0_10px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.08)] transition-shadow group ${borderCls}`}>
      <div className="flex justify-between items-start mb-4">
        <span className={`px-3 py-1 rounded-full ${pCls} text-[10px] font-black font-body uppercase tracking-wider`}>
          {task.priority}
        </span>
        {isCompleted && (
          <span className="material-symbols-outlined text-primary-container material-symbols-filled">check_circle</span>
        )}
      </div>

      <h4 className={`font-headline font-bold text-on-surface leading-tight ${isCompleted ? 'line-through decoration-primary-container decoration-2' : ''}`}>
        {task.title}
      </h4>

      {task.status === 'In Progress' && task.progress > 0 && (
        <div className="mt-4 h-1 w-full bg-surface-container-high/10 rounded-full overflow-hidden">
          <div className="h-full bg-primary-container" style={{ width: `${task.progress}%` }} />
        </div>
      )}

      <div className="mt-6 flex items-center justify-between text-on-surface-variant/60">
        {dlText ? (
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">{isOverdue ? 'warning' : 'calendar_month'}</span>
            <span className={`text-[11px] font-bold font-body ${isOverdue ? 'text-error' : ''}`}>{dlText}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-gray-400">event_busy</span>
            <span className="text-[11px] font-semibold italic text-gray-400">No deadline set</span>
          </div>
        )}
        {task.status === 'In Progress' && task.progress > 0 && (
          <span className="text-[10px] font-extrabold font-body text-primary-container uppercase">{task.progress}%</span>
        )}
      </div>

      {next && (
        <button
          type="button"
          onClick={() => onAction(task._id, next)}
          className="mt-3 w-full text-center text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 py-2 rounded-xl hover:bg-primary/20 transition-colors"
        >
          Move to {next}
        </button>
      )}
    </div>
  );
}

function ListRow({ task, onAction }: { task: Task; onAction: (id: string, next: TaskStatus) => void }) {
  const dlText = formatDeadline(task.deadline);
  const pCls   = PRIORITY_CLS[task.priority] ?? PRIORITY_CLS.Medium;
  const sCls   = STATUS_CLS[task.status] ?? '';
  const next   = NEXT_STATUS[task.status];

  return (
    <tr className="hover:bg-black/[0.02] transition-colors">
      <td className="px-6 py-4 font-bold text-on-surface">{task.title}</td>
      <td className="px-6 py-4">
        <span className={`px-3 py-1 rounded-full ${pCls} text-[10px] font-black uppercase`}>{task.priority}</span>
      </td>
      <td className="px-6 py-4">
        {dlText
          ? <span className="text-on-surface-variant text-sm">{dlText}</span>
          : <span className="text-[11px] font-semibold italic text-gray-400">No deadline set</span>
        }
      </td>
      <td className="px-6 py-4">
        <span className={`px-3 py-1 rounded-full ${sCls} text-xs font-bold`}>{task.status}</span>
      </td>
      <td className="px-6 py-4 text-right">
        {next && (
          <button
            type="button"
            onClick={() => onAction(task._id, next)}
            className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1.5 rounded-xl hover:bg-primary/20 transition-colors"
          >
            {next}
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MyTask() {
  const [allTasks,      setAllTasks]      = useState<Task[]>([]);
  const [view,          setView]          = useState<'board' | 'list'>('board');
  const [statusFilter,  setStatusFilter]  = useState<TaskStatus | ''>('');
  const [priorityFilter,setPriorityFilter] = useState<TaskPriority | ''>('');
  const [search,        setSearch]        = useState('');
  const [dateFilter,    setDateFilter]    = useState('');
  const [showPriorityDD,setShowPriorityDD] = useState(false);
  const priorityRef = useRef<HTMLDivElement>(null);

  const loadTasks = useCallback(async () => {
    try {
      const data = await tasksApi.list() as unknown;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime shape unknown
      setAllTasks(((data as any)?.tasks ?? []) as Task[]);
    } catch { /* table shows no-tasks fallback */ }
  }, []);

  useEffect(() => { void loadTasks(); }, [loadTasks]);

  // Close priority dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!priorityRef.current?.contains(e.target as Node)) setShowPriorityDD(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  async function handleAction(id: string, next: TaskStatus) {
    try {
      await tasksApi.updateStatus(id, next);
      await loadTasks();
    } catch (err) {
      console.error('Status update failed:', err);
    }
  }

  // Filtered + sorted tasks
  const filtered = allTasks
    .filter(t => !statusFilter   || t.status   === statusFilter)
    .filter(t => !priorityFilter || t.priority === priorityFilter)
    .filter(t => !search         || t.title.toLowerCase().includes(search.toLowerCase()) || (t.description ?? '').toLowerCase().includes(search.toLowerCase()))
    .filter(t => !dateFilter     || (t.deadline?.substring(0, 10) === dateFilter))
    .sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });

  const statusBtnCls = (s: TaskStatus | '') =>
    `status-btn px-5 py-2 rounded-full text-xs font-extrabold font-body ${
      statusFilter === s ? 'bg-primary text-white' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
    }`;

  const dateLabel = dateFilter
    ? new Date(dateFilter + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'Date';

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <header className="pt-12 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="font-headline text-6xl font-extrabold tracking-tighter text-on-surface">My Tasks</h2>
          <p className="font-body text-on-surface-variant/80 font-medium mt-2">
            Manage your creative workflow with tactile precision.
          </p>
        </div>
        <div className="bg-surface-container-high/20 p-1.5 rounded-2xl flex items-center">
          {(['list', 'board'] as const).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-6 py-2.5 rounded-xl font-headline font-bold text-sm transition-all capitalize ${
                view === v ? 'bg-white text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </header>

      {/* Filter Bar */}
      <div className="mb-10">
        <div className="flex flex-wrap items-center gap-4 bg-white/60 backdrop-blur-md p-4 rounded-[2rem] shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
          {/* Status filters */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pr-4 border-r border-black/10">
            {(['', 'Pending', 'In Progress', 'Completed', 'Overdue'] as const).map(s => (
              <button key={s} type="button" onClick={() => setStatusFilter(s)} className={statusBtnCls(s)}>
                {s || 'All'}
              </button>
            ))}
          </div>

          {/* Search + Date + Priority */}
          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-lg">search</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-surface-container-high/10 border-none rounded-2xl focus:ring-2 focus:ring-primary-container text-sm font-body text-black placeholder:text-gray-500"
                placeholder="Search tasks…"
                type="text"
              />
            </div>

            {/* Date filter */}
            <div className="relative">
              <input
                type="date"
                aria-label="Filter by date"
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
              />
              <button
                type="button"
                className={`px-4 py-3 rounded-2xl flex items-center gap-2 shadow-sm text-on-surface-variant hover:text-on-surface transition-colors relative pointer-events-none ${dateFilter ? 'bg-primary-container' : 'bg-white'}`}
              >
                <span className="material-symbols-outlined text-xl">calendar_today</span>
                <span className="text-xs font-bold font-body">{dateLabel}</span>
              </button>
            </div>

            {/* Priority filter */}
            <div className="relative" ref={priorityRef}>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setShowPriorityDD(v => !v); }}
                className={`px-4 py-3 rounded-2xl flex items-center gap-2 shadow-sm text-on-surface-variant hover:text-on-surface transition-colors ${priorityFilter ? 'bg-primary-container' : 'bg-white'}`}
              >
                <span className="material-symbols-outlined text-xl">filter_list</span>
                <span className="text-xs font-bold font-body">{priorityFilter || 'Priority'}</span>
              </button>
              {showPriorityDD && (
                <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-lg border border-black/5 py-2 z-50 min-w-[140px]">
                  {(['', 'Low', 'Medium', 'High', 'Urgent'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => { setPriorityFilter(p); setShowPriorityDD(false); }}
                      className={`w-full text-left px-4 py-2 text-sm font-bold hover:bg-surface-container-high/30 ${p === 'Urgent' ? 'text-error' : p ? 'text-on-surface-variant' : 'text-on-surface'}`}
                    >
                      {p || 'All'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* List View */}
      {view === 'list' && (
        <div className="pb-20">
          <div className="bg-white rounded-3xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-high/30">
                  {['Task', 'Priority', 'Deadline', 'Status', 'Action'].map((h, i) => (
                    <th key={h} className={`px-6 py-4 font-headline text-sm font-bold text-on-surface-variant${i === 4 ? ' text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {filtered.length === 0
                  ? <tr><td colSpan={5} className="px-6 py-12 text-center text-on-surface-variant">No tasks match your filters</td></tr>
                  : filtered.map(t => <ListRow key={t._id} task={t} onAction={handleAction} />)
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Kanban Board View */}
      {view === 'board' && (
        <div className="pb-20 overflow-x-auto flex gap-8">
          {COLUMNS.map(col => {
            const colTasks = filtered.filter(t => t.status === col.status);
            const isOverdue = col.status === 'Overdue';
            return (
              <div key={col.id} className="flex-shrink-0 w-80">
                <div className="flex items-center justify-between mb-6 px-2">
                  <h3 className={`font-headline font-bold text-lg flex items-center gap-2 ${isOverdue ? 'text-error' : 'text-on-surface'}`}>
                    {col.label}
                    <span className={`${col.badgeCls} px-2 py-0.5 rounded-lg text-xs`}>{colTasks.length}</span>
                  </h3>
                </div>
                <div className="space-y-4">
                  {colTasks.length === 0
                    ? <p className="text-center text-on-surface-variant/60 py-8 text-sm">No tasks</p>
                    : colTasks.map(t => <TaskCard key={t._id} task={t} onAction={handleAction} />)
                  }
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
