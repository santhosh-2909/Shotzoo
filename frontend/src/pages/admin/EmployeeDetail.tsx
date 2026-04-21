import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { adminApi } from '@/utils/api';
import type { Task, TaskStatus, User } from '@/types';

interface EmployeeStats {
  total: number;
  completed: number;
  pendingInProgress: number;
  overdue: number;
}

interface EmployeeDetailResponse {
  success:      boolean;
  employee:     User;
  stats:        EmployeeStats;
  lastActivity: string | null;
}

interface EmployeeTasksResponse {
  success: boolean;
  date:    string;
  count:   number;
  tasks:   Task[];
}

interface CarryForwardResponse {
  success:      boolean;
  originalTask: Task;
  newTask:      Task;
}

interface MarkIncompleteResponse {
  success: boolean;
  task:    Task;
}

type StatusFilter = 'All' | 'Completed' | 'Pending' | 'In Progress' | 'Overdue';

const STATUS_BADGE: Record<TaskStatus, string> = {
  Completed:                   'bg-[#dcfce7] text-[#166534]',
  'In Progress':               'bg-[#dbeafe] text-[#0058be]',
  Pending:                     'bg-[#fef3c7] text-[#92400e]',
  Overdue:                     'bg-[#ffdad6] text-[#ba1a1a]',
  'Missed / Carried Forward':  'bg-stone-200 text-stone-600',
  Incomplete:                  'bg-stone-200 text-stone-600',
};

const PRIORITY_DOT: Record<string, string> = {
  High: 'bg-[#ba1a1a]', Urgent: 'bg-[#ba1a1a]', Medium: 'bg-[#ffb044]', Low: 'bg-stone-400',
};

const PRIORITY_TEXT: Record<string, string> = {
  High: 'text-[#ba1a1a]', Urgent: 'text-[#ba1a1a]', Medium: 'text-[#ffb044]', Low: 'text-stone-500',
};

function todayYmd(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return yyyy + '-' + mm + '-' + dd;
}

function shiftYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yyyy = dt.getFullYear();
  const mm   = String(dt.getMonth() + 1).padStart(2, '0');
  const dd   = String(dt.getDate()).padStart(2, '0');
  return yyyy + '-' + mm + '-' + dd;
}

function fmtDateLong(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtDateShort(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
}

function joiningAnniversary(joiningIso?: string): string {
  if (!joiningIso) return '';
  const start = new Date(joiningIso);
  if (isNaN(start.getTime())) return '';
  const now = new Date();
  let years  = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  if (years <= 0 && months <= 0) return 'Joined today';
  const parts: string[] = [];
  if (years > 0)  parts.push(years + (years === 1 ? ' year' : ' years'));
  if (months > 0) parts.push(months + (months === 1 ? ' month' : ' months'));
  return 'Joined ' + parts.join(' ') + ' ago';
}

function timeRemaining(deadline?: string | null, status?: TaskStatus): string {
  if (!deadline) return '—';
  if (status === 'Completed') return '—';
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff < 0) {
    const d = Math.floor(-diff / 86400000);
    const h = Math.floor((-diff % 86400000) / 3600000);
    return '- ' + d + 'd ' + h + 'h';
  }
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  return d + 'd ' + h + 'h';
}

function initialsOf(name?: string): string {
  return (name || '?').split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setPortal } = useTheme();

  const [profile, setProfile] = useState<User | null>(null);
  const [stats, setStats] = useState<EmployeeStats>({ total: 0, completed: 0, pendingInProgress: 0, overdue: 0 });
  const [lastActivity, setLastActivity] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');

  const [selectedDate, setSelectedDate] = useState(todayYmd());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  const [filter, setFilter] = useState<StatusFilter>('All');
  const [busyTaskIds, setBusyTaskIds] = useState<Record<string, boolean>>({});

  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const today = todayYmd();

  useEffect(() => { setPortal('admin'); }, [setPortal]);

  // Load profile + stats
  useEffect(() => {
    if (!id) return;
    setProfileLoading(true);
    setProfileError('');
    (adminApi.employeeDetail(id) as Promise<EmployeeDetailResponse>)
      .then(res => {
        if (res.success) {
          setProfile(res.employee);
          setStats(res.stats);
          setLastActivity(res.lastActivity);
        } else {
          setProfileError('Employee not found.');
        }
      })
      .catch((e: unknown) => {
        setProfileError(e instanceof Error ? e.message : 'Failed to load employee.');
      })
      .finally(() => setProfileLoading(false));
  }, [id]);

  // Load tasks for selected date
  const loadTasks = useCallback((date: string) => {
    if (!id) return;
    setTasksLoading(true);
    (adminApi.employeeTasks(id, date) as Promise<EmployeeTasksResponse>)
      .then(res => {
        if (res.success) setTasks(res.tasks || []);
        else setTasks([]);
      })
      .catch(() => setTasks([]))
      .finally(() => setTasksLoading(false));
  }, [id]);

  useEffect(() => { loadTasks(selectedDate); }, [loadTasks, selectedDate]);

  // Reload profile stats whenever tasks change via mutation — keep the strip in sync
  const reloadProfile = useCallback(() => {
    if (!id) return;
    (adminApi.employeeDetail(id) as Promise<EmployeeDetailResponse>)
      .then(res => {
        if (res.success) {
          setStats(res.stats);
          setLastActivity(res.lastActivity);
        }
      })
      .catch(() => {});
  }, [id]);

  function showToast(msg: string) {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  }

  async function handleCarryForward(task: Task) {
    const nextDay = shiftYmd(selectedDate, 1);
    setBusyTaskIds(p => ({ ...p, [task._id]: true }));
    // Optimistic: mark the original as carried forward locally
    const prevTasks = tasks;
    setTasks(ts => ts.map(t => t._id === task._id
      ? { ...t, status: 'Missed / Carried Forward' as TaskStatus, carriedToDate: nextDay }
      : t,
    ));
    try {
      await (adminApi.carryForwardTask(task._id, nextDay) as Promise<CarryForwardResponse>);
      showToast('Task carried forward to ' + fmtDateShort(nextDay) + '.');
      reloadProfile();
    } catch (e) {
      setTasks(prevTasks); // rollback
      showToast(e instanceof Error ? e.message : 'Failed to carry forward.');
    } finally {
      setBusyTaskIds(p => {
        const next = { ...p };
        delete next[task._id];
        return next;
      });
    }
  }

  async function handleMarkIncomplete(task: Task) {
    setBusyTaskIds(p => ({ ...p, [task._id]: true }));
    const prevTasks = tasks;
    setTasks(ts => ts.map(t => t._id === task._id ? { ...t, status: 'Incomplete' as TaskStatus } : t));
    try {
      await (adminApi.markTaskIncomplete(task._id) as Promise<MarkIncompleteResponse>);
      showToast('Task marked as incomplete.');
      reloadProfile();
    } catch (e) {
      setTasks(prevTasks);
      showToast(e instanceof Error ? e.message : 'Failed to update task.');
    } finally {
      setBusyTaskIds(p => {
        const next = { ...p };
        delete next[task._id];
        return next;
      });
    }
  }

  const filteredTasks = useMemo(() => {
    if (filter === 'All') return tasks;
    return tasks.filter(t => t.status === filter);
  }, [tasks, filter]);

  const isPastOrToday = selectedDate <= today;
  const isFuture = selectedDate > today;

  return (
    <div className="animate-fade-in pt-10 px-8 pb-24 min-h-screen">
      {/* Toast */}
      <div
        className={`fixed top-6 right-6 bg-[#2A313D] text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-2 z-[999] transition-all duration-300 pointer-events-none ${
          toastVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-5'
        }`}
      >
        <span className="material-symbols-outlined text-[#a8cd62]">info</span>
        <span className="font-bold text-sm">{toast}</span>
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Back button */}
        <button
          type="button"
          onClick={() => navigate('/admin/employees')}
          aria-label="Back to Employees"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#444939] hover:text-[#3c5600] mb-6 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          Back to Employees
        </button>

        {profileLoading ? (
          <div className="py-16 text-center text-stone-400 text-sm">Loading employee…</div>
        ) : profileError || !profile ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <span className="material-symbols-outlined text-[48px] text-stone-300">person_off</span>
            <p className="mt-3 font-bold text-stone-700">{profileError || 'Employee not found.'}</p>
            <button
              type="button"
              onClick={() => navigate('/admin/employees')}
              className="mt-4 bg-[#a8cd62] text-white px-5 py-2 rounded-lg font-semibold text-sm hover:bg-[#96B856]"
            >
              Return to Employees
            </button>
          </div>
        ) : (
          <>
            {/* Profile Header Card */}
            <section className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] p-8 mb-8">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="w-20 h-20 rounded-2xl bg-[#a8cd62] flex items-center justify-center font-bold text-[#3c5600] text-2xl flex-shrink-0">
                  {initialsOf(profile.fullName)}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-3xl font-headline font-bold text-stone-900">{profile.fullName || '—'}</h1>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
                    <span className="font-mono font-bold text-stone-600 bg-[#F0F3FF] px-2.5 py-0.5 rounded">{profile.employeeId || '—'}</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-tighter bg-[#A8CD62] text-stone-900">
                      {profile.employeeType || 'Office'}
                    </span>
                    {profile.role && (
                      <span className="text-stone-500 font-medium">{profile.role}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 mt-4 text-sm">
                    {profile.joiningDate && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Joined</p>
                        <p className="font-semibold text-stone-700">{new Date(profile.joiningDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      </div>
                    )}
                    {profile.email && (
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Email</p>
                        <p className="font-semibold text-stone-700 truncate" title={profile.email}>{profile.email}</p>
                      </div>
                    )}
                    {profile.phone && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Phone</p>
                        <p className="font-semibold text-stone-700">{profile.phone}</p>
                      </div>
                    )}
                    {profile.workRole && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Work Role</p>
                        <p className="font-semibold text-stone-700">{profile.workRole}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Stats Strip */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard label="Total Tasks" value={stats.total} accent="bg-[#F0F3FF] text-[#444939]" />
              <StatCard label="Completed" value={stats.completed} accent="bg-[#dcfce7] text-[#166534]" />
              <StatCard label="Pending / In Progress" value={stats.pendingInProgress} accent="bg-[#fef3c7] text-[#92400e]" />
              <StatCard label="Overdue" value={stats.overdue} accent="bg-[#ffdad6] text-[#ba1a1a]" />
            </section>

            {/* Extra Info Row */}
            <section className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-stone-600 mb-8">
              {profile.joiningDate && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#a8cd62] text-[18px]">cake</span>
                  {joiningAnniversary(profile.joiningDate)}
                </span>
              )}
              {lastActivity && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-stone-400 text-[18px]">schedule</span>
                  Last activity: {new Date(lastActivity).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                </span>
              )}
            </section>

            {/* Date Picker Block */}
            <section className="bg-white rounded-2xl p-6 mb-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">View tasks for</p>
                  <p className="text-xl font-headline font-bold text-stone-900">{fmtDateLong(selectedDate)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDate(d => shiftYmd(d, -1))}
                    aria-label="Previous day"
                    className="p-2 rounded-lg text-stone-500 bg-[#F0F3FF] hover:bg-[#A8CD62]/20 hover:text-[#3c5600] transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                  </button>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    aria-label="Select date"
                    className="bg-[#F0F3FF] border-none rounded-lg text-sm font-semibold text-stone-900 focus:ring-2 focus:ring-[#A8CD62] px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedDate(d => shiftYmd(d, 1))}
                    aria-label="Next day"
                    className="p-2 rounded-lg text-stone-500 bg-[#F0F3FF] hover:bg-[#A8CD62]/20 hover:text-[#3c5600] transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(today)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      selectedDate === today ? 'bg-[#a8cd62] text-white' : 'bg-[#F0F3FF] text-[#444939] hover:bg-[#A8CD62]/20'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(shiftYmd(today, -1))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      selectedDate === shiftYmd(today, -1) ? 'bg-[#a8cd62] text-white' : 'bg-[#F0F3FF] text-[#444939] hover:bg-[#A8CD62]/20'
                    }`}
                  >
                    Yesterday
                  </button>
                </div>
              </div>
            </section>

            {/* Filter chips */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {(['All', 'Completed', 'Pending', 'In Progress', 'Overdue'] as StatusFilter[]).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    filter === f ? 'bg-[#a8cd62] text-white' : 'bg-white text-stone-500 hover:bg-[#A8CD62]/10'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Task list */}
            {tasksLoading ? (
              <div className="py-16 text-center text-stone-400 text-sm">Loading tasks…</div>
            ) : filteredTasks.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center">
                <span className="material-symbols-outlined text-[48px] text-stone-300">event_busy</span>
                <p className="mt-3 font-bold text-stone-700">No tasks found for selected date.</p>
                <p className="text-sm text-stone-500 mt-1">Assign this employee a task to get started.</p>
                <button
                  type="button"
                  onClick={() => navigate('/admin/add-task?assignee=' + encodeURIComponent(profile.employeeId || profile._id))}
                  className="mt-4 inline-flex items-center gap-2 bg-[#a8cd62] text-white px-5 py-2 rounded-lg font-semibold text-sm hover:bg-[#96B856] transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">add_task</span>
                  Assign a task
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTasks.map(t => (
                  <TaskCard
                    key={t._id}
                    task={t}
                    isPastOrToday={isPastOrToday}
                    isFuture={isFuture}
                    busy={!!busyTaskIds[t._id]}
                    onCarryForward={() => handleCarryForward(t)}
                    onMarkIncomplete={() => handleMarkIncomplete(t)}
                    onJumpToDate={d => setSelectedDate(d)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className={`rounded-2xl p-5 ${accent}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">{label}</p>
      <p className="text-3xl font-headline font-bold mt-2 tabular-nums">{value}</p>
    </div>
  );
}

interface TaskCardProps {
  task: Task;
  isPastOrToday: boolean;
  isFuture: boolean;
  busy: boolean;
  onCarryForward: () => void;
  onMarkIncomplete: () => void;
  onJumpToDate: (ymd: string) => void;
}

function TaskCard({ task, isPastOrToday, isFuture, busy, onCarryForward, onMarkIncomplete, onJumpToDate }: TaskCardProps) {
  const badgeCls = STATUS_BADGE[task.status] ?? 'bg-stone-100 text-stone-600';
  const dotCls   = PRIORITY_DOT[task.priority] ?? 'bg-stone-400';
  const txtCls   = PRIORITY_TEXT[task.priority] ?? 'text-stone-500';
  const dl       = task.deadline ? new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const tr       = timeRemaining(task.deadline, task.status);

  const alreadyCarried = !!task.carriedToTaskId || task.status === 'Missed / Carried Forward';
  const canCarryForward = task.status !== 'Completed' && !alreadyCarried && isPastOrToday;

  return (
    <div className="bg-white rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-transparent hover:border-[#A8CD62]/30 transition-colors">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className={`text-base font-bold text-stone-900 ${task.status === 'Completed' ? 'line-through opacity-60' : ''}`}>
              {task.title}
            </h3>
            <span className="text-[11px] font-mono uppercase text-stone-400">ID: {task._id.slice(-6).toUpperCase()}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${dotCls}`} />
              <span className={`font-bold uppercase ${txtCls}`}>{task.priority}</span>
            </span>
            <span className="text-stone-500">Deadline: <span className="font-semibold text-stone-700">{dl}</span></span>
            {task.status !== 'Completed' && task.deadline && (
              <span className={`font-mono font-bold ${new Date(task.deadline).getTime() < Date.now() ? 'text-[#ba1a1a]' : 'text-[#ffb044]'}`}>
                {tr}
              </span>
            )}
          </div>
          {/* Carry-forward audit chips */}
          {(task.carriedFromDate || task.carriedToDate) && (
            <div className="flex flex-wrap gap-2 mt-2">
              {task.carriedFromDate && (
                <button
                  type="button"
                  onClick={() => onJumpToDate(task.carriedFromDate as string)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 px-2 py-0.5 rounded-full transition-colors"
                  aria-label={'Jump to ' + task.carriedFromDate}
                >
                  <span className="material-symbols-outlined text-[14px]">subdirectory_arrow_right</span>
                  Carried from {task.carriedFromDate}
                </button>
              )}
              {task.carriedToDate && (
                <button
                  type="button"
                  onClick={() => onJumpToDate(task.carriedToDate as string)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 px-2 py-0.5 rounded-full transition-colors"
                  aria-label={'Jump to ' + task.carriedToDate}
                >
                  <span className="material-symbols-outlined text-[14px]">subdirectory_arrow_right</span>
                  Carried to {task.carriedToDate}
                </button>
              )}
            </div>
          )}
        </div>
        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight ${badgeCls} shrink-0`}>
          {task.status}
        </span>
      </div>

      {/* Carry-forward action row */}
      {canCarryForward && !isFuture && (
        <div className="mt-4 pt-4 border-t border-stone-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <p className="text-sm text-stone-600">Not completed. Carry forward to next day?</p>
          <div className="flex items-center gap-2">
            {busy && (
              <span className="w-4 h-4 border-2 border-stone-200 border-t-[#a8cd62] rounded-full animate-spin" aria-hidden="true" />
            )}
            <button
              type="button"
              disabled={busy}
              onClick={onCarryForward}
              aria-label="Carry task forward to next day"
              className="bg-[#a8cd62] text-white px-4 py-1.5 rounded-lg font-semibold text-sm hover:bg-[#96B856] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Yes, carry forward
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onMarkIncomplete}
              aria-label="Mark task as incomplete"
              className="bg-stone-100 text-stone-700 px-4 py-1.5 rounded-lg font-semibold text-sm hover:bg-stone-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              No, leave as incomplete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
