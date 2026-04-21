import { useEffect, useState } from 'react';
import { tasksApi } from '@/utils/api';
import type { Task, TaskStatus, TaskPriority } from '@/types';

interface TaskDetailModalProps {
  taskId:         string | null;
  isOpen:         boolean;
  onClose:        () => void;
  onStatusUpdate?: () => void;
}

const PRIORITY_CLS: Record<TaskPriority, string> = {
  High:   'bg-secondary-fixed text-on-secondary-fixed',
  Medium: 'bg-surface-container-high/20 text-on-surface-variant',
  Low:    'bg-surface-container-high/20 text-on-surface-variant',
  Urgent: 'bg-error/10 text-error',
};

const STATUS_CLS: Record<TaskStatus, string> = {
  Pending:                    'bg-surface-container-highest text-on-surface-variant',
  'In Progress':              'bg-secondary-container text-on-secondary-container',
  Completed:                  'bg-primary-container text-on-primary-container',
  Overdue:                    'bg-error-container text-on-error-container',
  'Missed / Carried Forward': 'bg-surface-container-highest text-on-surface-variant',
  Incomplete:                 'bg-surface-container-highest text-on-surface-variant',
};

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function countdownFor(iso?: string): string {
  if (!iso) return 'No deadline set';
  const ms   = new Date(iso).getTime() - Date.now();
  const day  = 86_400_000;
  const days = Math.round(ms / day);
  if (ms < 0) {
    const od = Math.abs(days);
    if (od === 0) return 'Overdue today';
    return 'Overdue by ' + od + (od === 1 ? ' day' : ' days');
  }
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return 'Due in ' + days + ' days';
}

function initialsOf(name?: string): string {
  return (name || '?').split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function TaskDetailModal({ taskId, isOpen, onClose, onStatusUpdate }: Readonly<TaskDetailModalProps>) {
  const [task,       setTask]       = useState<Task | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [updating,   setUpdating]   = useState(false);

  useEffect(() => {
    if (!isOpen || !taskId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setTask(null);
    tasksApi.get(taskId)
      .then(res => {
        if (cancelled) return;
        const r = res as { success?: boolean; task?: Task; message?: string };
        if (r.success && r.task) setTask(r.task);
        else setError(r.message ?? 'Failed to load task');
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load task');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, taskId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleAction(nextStatus: TaskStatus) {
    if (!task) return;
    setUpdating(true);
    setError('');
    try {
      const res = await tasksApi.updateStatus(task._id, nextStatus, nextStatus === 'Completed' ? 100 : undefined) as { success?: boolean; task?: Task; message?: string };
      if (!res.success || !res.task) {
        setError(res.message ?? 'Failed to update status');
        return;
      }
      setTask(res.task);
      onStatusUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  }

  const statusCls   = task ? (STATUS_CLS[task.status] ?? '') : '';
  const priorityCls = task ? (PRIORITY_CLS[task.priority] ?? PRIORITY_CLS.Medium) : '';

  return (
    <div
      className="fixed inset-0 bg-black/45 z-[9998] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-detail-title"
    >
      <style>{`
        @keyframes szTaskDetailIn {
          from { transform: translateY(16px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
      <div
        className="bg-white rounded-[1.75rem] shadow-[0_25px_60px_rgba(0,0,0,0.25)] w-full max-w-2xl max-h-[92vh] overflow-y-auto"
        style={{ animation: 'szTaskDetailIn 200ms ease' }}
      >
        <div className="sticky top-0 bg-white flex items-start justify-between px-8 py-6 border-b border-surface-container-high/40 z-10">
          <div className="min-w-0 pr-4">
            <h2 id="task-detail-title" className="font-headline font-extrabold tracking-tight text-2xl text-on-surface leading-tight">
              {loading ? 'Loading…' : (task?.title ?? 'Task')}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-container-high/30 transition-colors flex-shrink-0"
          >
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>

        <div className="p-8 space-y-6">
          {loading && (
            <p className="text-sm text-on-surface-variant">Loading task details…</p>
          )}

          {error && (
            <div className="px-4 py-3 rounded-xl bg-error-container text-on-error-container text-sm font-semibold">
              {error}
            </div>
          )}

          {task && !loading && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${statusCls}`}>
                  {task.status}
                </span>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${priorityCls}`}>
                  {task.priority}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                <span className="font-semibold">{formatDate(task.deadline)}</span>
                <span className="text-on-surface-variant/60">·</span>
                <span className={task.deadline && new Date(task.deadline).getTime() < Date.now() && task.status !== 'Completed' ? 'text-error font-bold' : 'font-semibold'}>
                  {countdownFor(task.deadline)}
                </span>
              </div>

              <section className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  <span className="material-symbols-outlined text-[18px]">assignment</span>
                  What to do
                </div>
                <p className="whitespace-pre-wrap text-sm text-on-surface leading-relaxed bg-surface-container-low rounded-2xl p-4">
                  {task.description?.trim() || '—'}
                </p>
              </section>

              <section className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  <span className="material-symbols-outlined text-[18px]">track_changes</span>
                  Why
                </div>
                <p className="whitespace-pre-wrap text-sm text-on-surface leading-relaxed bg-surface-container-low rounded-2xl p-4">
                  {task.context?.trim() || '—'}
                </p>
              </section>

              <section className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  <span className="material-symbols-outlined text-[18px]">build</span>
                  How
                </div>
                <p className="whitespace-pre-wrap text-sm text-on-surface leading-relaxed bg-surface-container-low rounded-2xl p-4">
                  {task.executionSteps?.trim() || '—'}
                </p>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-surface-container-high/40 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Assigned to</p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center text-xs font-extrabold text-on-primary-container">
                      {initialsOf(task.assignedTo?.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-on-surface truncate">{task.assignedTo?.name ?? '—'}</p>
                      <p className="text-[11px] font-mono text-on-surface-variant">{task.assignedTo?.employeeId ?? ''}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-surface-container-high/40 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Created by</p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-surface-container-high/30 flex items-center justify-center text-xs font-bold text-on-surface-variant">
                      —
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-on-surface-variant">—</p>
                      <p className="text-[11px] font-mono text-on-surface-variant/60">not tracked</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                {task.status === 'Completed' ? (
                  <div className="w-full h-12 rounded-full bg-primary-container/40 text-on-primary-container font-bold text-sm flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    Completed on {formatDate(task.completedAt)}
                  </div>
                ) : task.status === 'In Progress' ? (
                  <button
                    type="button"
                    onClick={() => handleAction('Completed')}
                    disabled={updating}
                    className="w-full h-12 rounded-full bg-primary-container text-on-primary-container font-extrabold text-sm uppercase tracking-wider shadow-[0_10px_20px_rgba(173,211,102,0.3)] hover:brightness-105 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">done_all</span>
                    {updating ? 'Saving…' : 'Mark Completed'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAction('In Progress')}
                    disabled={updating}
                    className="w-full h-12 rounded-full bg-primary-container text-on-primary-container font-extrabold text-sm uppercase tracking-wider shadow-[0_10px_20px_rgba(173,211,102,0.3)] hover:brightness-105 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                    {updating ? 'Saving…' : 'Start Task'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
