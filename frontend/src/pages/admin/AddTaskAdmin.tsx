import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { adminApi } from '@/utils/api';
import type { TaskPriority, User } from '@/types';

type Priority = TaskPriority;

export default function AddTaskAdmin() {
  const { setPortal } = useTheme();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const myId = currentUser?._id ?? '';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [context, setContext] = useState('');
  const [steps, setSteps] = useState('');
  const [priority, setPriority] = useState<Priority>('High');
  const [tags, setTags] = useState('');
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(30);
  const [deadline, setDeadline] = useState('');
  const [employees, setEmployees] = useState<User[]>([]);
  const [assigneeId, setAssigneeId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { setPortal('admin'); }, [setPortal]);

  useEffect(() => {
    (adminApi.employees() as Promise<{ success: boolean; employees: User[] }>)
      .then(d => {
        if (d.success) {
          setEmployees(d.employees || []);
          if (myId) setAssigneeId(myId);
        }
      })
      .catch(() => {});
  }, [myId]);

  function resetForm() {
    setTitle(''); setDescription(''); setContext(''); setSteps('');
    setPriority('High'); setTags(''); setHours(0); setMinutes(30); setDeadline('');
  }

  async function saveTask(andAnother: boolean) {
    if (!title.trim()) { setError('Task title is required.'); return; }
    if (!assigneeId) { setError('Please select an assignee.'); return; }
    setError('');
    setSaving(true);
    try {
      await adminApi.createTask({
        userId: assigneeId,
        title: title.trim(),
        description,
        context,
        executionSteps: steps,
        priority,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        estimatedHours: hours + minutes / 60,
        estimatedMinutes: minutes,
        deadline: deadline || undefined,
      });
      if (andAnother) {
        setSuccess('Task assigned successfully! Add another.');
        resetForm();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        navigate('/admin/all-tasks');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save task.');
    } finally {
      setSaving(false);
    }
  }

  const PRIORITIES: Priority[] = ['Low', 'Medium', 'High', 'Urgent'];

  return (
    <div className="animate-fade-in min-h-screen pt-24 pb-20 px-12 max-w-5xl mx-auto">
      {/* Decorative blob */}
      <div className="fixed top-0 right-0 w-1/3 h-screen pointer-events-none z-[-1] overflow-hidden opacity-30">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#add366] blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      <header className="mb-12">
        <h2 className="text-5xl font-headline font-bold text-on-surface tracking-tighter mb-2">Log a New Task</h2>
        <p className="text-[#444939]/80 font-medium max-w-lg">Fill in the details below to assign a task to an employee. Precision leads to efficiency.</p>
      </header>

      {error && (
        <div className="mb-6 px-5 py-4 rounded-2xl bg-[#ffdad6] text-[#ba1a1a] font-bold text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">error</span>{error}
        </div>
      )}
      {success && (
        <div className="mb-6 px-5 py-4 rounded-2xl bg-[#dcfce7] text-[#166534] font-bold text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>{success}
        </div>
      )}

      <div className="space-y-8">
        {/* Assignee */}
        <section className="clay-card p-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-[#a8cd62]/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#3c5600] text-sm">person</span>
            </div>
            <h3 className="text-xl font-headline font-bold text-on-surface">Assign To</h3>
          </div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="task-assignee" className="text-xs font-bold uppercase tracking-widest text-[#444939] ml-1 block">
              Assignee
            </label>
            {myId && (
              <button
                type="button"
                onClick={() => setAssigneeId(myId)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider transition-all ${
                  assigneeId === myId
                    ? 'bg-[#a8cd62] text-[#131f00] shadow-sm'
                    : 'border border-[#a8cd62]/40 text-[#3c5600] hover:bg-[#a8cd62]/10'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">person</span>
                Myself
              </button>
            )}
          </div>
          <select
            id="task-assignee"
            value={assigneeId}
            onChange={e => setAssigneeId(e.target.value)}
            aria-label="Select assignee"
            className="soft-input px-4 w-full"
          >
            <option value="">— Select employee —</option>
            {employees.map(emp => (
              <option key={emp._id} value={emp._id}>
                {emp.fullName} ({emp.employeeId || emp.role || 'Employee'})
                {emp._id === myId ? ' — Myself' : ''}
              </option>
            ))}
          </select>
        </section>

        {/* What */}
        <section className="clay-card p-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-[#a8cd62]/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#3c5600] text-sm">edit_note</span>
            </div>
            <h3 className="text-xl font-headline font-bold text-on-surface">What are you doing?</h3>
          </div>
          <div className="space-y-4">
            <div className="flex flex-col space-y-2">
              <label htmlFor="task-title" className="text-xs font-bold uppercase tracking-widest text-[#444939] ml-1">Task Title</label>
              <input
                id="task-title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="soft-input px-4 w-full"
                placeholder="e.g. Weekly Inventory Audit"
                type="text"
                required
              />
            </div>
            <div className="flex flex-col space-y-2">
              <label htmlFor="task-description" className="text-xs font-bold uppercase tracking-widest text-[#444939] ml-1">Brief Description</label>
              <textarea
                id="task-description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="soft-textarea w-full"
                placeholder="Outline the core objective…"
              />
            </div>
          </div>
        </section>

        {/* Why */}
        <section className="clay-card p-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-[#a8cd62]/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#3c5600] text-sm">question_mark</span>
            </div>
            <h3 className="text-xl font-headline font-bold text-on-surface">Why are you doing it?</h3>
          </div>
          <div className="flex flex-col space-y-2">
            <label htmlFor="task-context" className="text-xs font-bold uppercase tracking-widest text-[#444939] ml-1">Context &amp; Justification</label>
            <textarea
              id="task-context"
              value={context}
              onChange={e => setContext(e.target.value)}
              className="soft-textarea w-full"
              placeholder="Describe the impact or necessity of this task…"
            />
          </div>
        </section>

        {/* How */}
        <section className="clay-card p-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-[#a8cd62]/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#3c5600] text-sm">reorder</span>
            </div>
            <h3 className="text-xl font-headline font-bold text-on-surface">How are you doing it?</h3>
          </div>
          <div className="flex flex-col space-y-2">
            <label htmlFor="task-steps" className="text-xs font-bold uppercase tracking-widest text-[#444939] ml-1">Execution Steps</label>
            <textarea
              id="task-steps"
              value={steps}
              onChange={e => setSteps(e.target.value)}
              className="soft-textarea w-full"
              placeholder="List the methodology or required tools…"
            />
          </div>
        </section>

        {/* Priority & Tags */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section className="clay-card p-8">
            <h3 className="text-lg font-headline font-bold text-on-surface mb-4">Priority Level</h3>
            <div className="flex flex-wrap gap-3">
              {PRIORITIES.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`px-4 py-2 rounded-full text-xs font-extrabold uppercase tracking-widest transition-all ${
                    priority === p
                      ? 'bg-[#add366] text-[#131f00] shadow-lg shadow-[#add366]/20'
                      : p === 'Urgent'
                        ? 'border border-[#ba1a1a]/20 text-[#ba1a1a]/80 hover:bg-[#ba1a1a]/5'
                        : 'border border-[#e2e8f8]/10 text-[#444939]/80 hover:bg-[#e2e8f8]/5'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </section>
          <section className="clay-card p-8">
            <h3 className="text-lg font-headline font-bold text-on-surface mb-4">Tags</h3>
            <input
              id="task-tags"
              value={tags}
              onChange={e => setTags(e.target.value)}
              className="soft-input px-4 w-full"
              placeholder="Add tags (comma separated)"
              type="text"
            />
          </section>
        </div>

        {/* Time & Deadline */}
        <section className="clay-card p-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-[#a8cd62]/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#3c5600] text-sm">schedule</span>
            </div>
            <h3 className="text-xl font-headline font-bold text-on-surface">Time &amp; Deadline</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col space-y-2">
              <label htmlFor="task-hours" className="text-xs font-bold uppercase tracking-widest text-[#444939] ml-1">Estimated Hours</label>
              <input
                id="task-hours"
                value={hours}
                onChange={e => setHours(Number(e.target.value))}
                className="soft-input px-4 w-full"
                type="number"
                min={0}
              />
            </div>
            <div className="flex flex-col space-y-2">
              <label htmlFor="task-minutes" className="text-xs font-bold uppercase tracking-widest text-[#444939] ml-1">Minutes</label>
              <input
                id="task-minutes"
                value={minutes}
                onChange={e => setMinutes(Number(e.target.value))}
                className="soft-input px-4 w-full"
                type="number"
                min={0}
                max={59}
              />
            </div>
            <div className="flex flex-col space-y-2">
              <label htmlFor="task-deadline" className="text-xs font-bold uppercase tracking-widest text-[#444939] ml-1">Deadline Date</label>
              <div className="relative">
                <input
                  id="task-deadline"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  className="soft-input px-4 w-full appearance-none"
                  type="date"
                />
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[#444939]/60 pointer-events-none">calendar_month</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Footer Actions */}
      <footer className="mt-12 flex flex-col md:flex-row items-center justify-between gap-6 pb-20">
        <div className="flex items-center space-x-8">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-[#444939]/80 font-bold text-sm uppercase tracking-widest hover:text-on-surface transition-colors"
          >
            Cancel
          </button>
        </div>
        <div className="flex items-center space-x-4 w-full md:w-auto">
          <button
            type="button"
            disabled={saving}
            onClick={() => saveTask(true)}
            className="flex-1 md:flex-none px-8 h-[56px] border-2 border-[#e2e8f8]/10 rounded-[20px] font-bold text-on-surface hover:bg-[#e2e8f8]/5 transition-all disabled:opacity-50"
          >
            Save &amp; Add Another
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => saveTask(false)}
            className="flex-1 md:flex-none clay-button-primary px-12 h-[56px] font-extrabold text-sm uppercase tracking-wider flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <span>{saving ? 'Saving…' : 'Save Task'}</span>
            {!saving && <span className="material-symbols-outlined">check_circle</span>}
          </button>
        </div>
      </footer>
    </div>
  );
}
