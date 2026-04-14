import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { tasksApi } from '@/utils/api';

type Priority = 'Low' | 'Medium' | 'High' | 'Urgent';

export default function AddTask() {
  const navigate = useNavigate();
  const { setPortal } = useTheme();

  useEffect(() => { setPortal('employee'); }, [setPortal]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [context, setContext] = useState('');
  const [steps, setSteps] = useState('');
  const [priority, setPriority] = useState<Priority>('High');
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(30);
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const resetForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setContext('');
    setSteps('');
    setPriority('High');
    setHours(0);
    setMinutes(30);
    setDeadline('');
    setError('');
  }, []);

  const saveTask = useCallback(async (andAnother: boolean) => {
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await tasksApi.create({
        title: title.trim(),
        description,
        context,
        executionSteps: steps,
        priority,
        tags: [],
        estimatedHours: hours,
        estimatedMinutes: minutes,
        deadline: deadline || undefined,
      });
      if (andAnother) {
        setSuccessMsg('Task saved! You can add another.');
        resetForm();
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        navigate('/my-tasks');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task.');
    } finally {
      setSaving(false);
    }
  }, [title, description, context, steps, priority, hours, minutes, deadline, navigate, resetForm]);

  const priorityBtn = (p: Priority) => {
    const isActive = priority === p;
    if (p === 'Urgent') {
      return isActive
        ? 'priority-btn px-4 py-2 rounded-full bg-[#add366] text-[#131f00] text-xs font-extrabold uppercase tracking-widest shadow-lg shadow-[#add366]/20'
        : 'priority-btn px-4 py-2 rounded-full border border-error/20 text-xs font-bold uppercase tracking-widest text-error/80 hover:bg-error/5 transition-colors';
    }
    return isActive
      ? 'priority-btn px-4 py-2 rounded-full bg-[#add366] text-[#131f00] text-xs font-extrabold uppercase tracking-widest shadow-lg shadow-[#add366]/20'
      : 'priority-btn px-4 py-2 rounded-full border border-surface-container-high/10 text-xs font-bold uppercase tracking-widest text-on-surface-variant/80 hover:bg-surface-container-high/5 transition-colors';
  };

  return (
    <div className="animate-fade-in">
      {/* Decorative bg */}
      <div className="fixed top-0 right-0 w-1/3 h-screen pointer-events-none z-[-1] overflow-hidden opacity-30">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#add366] blur-[120px] rounded-full" />
      </div>

      <div className="pt-24 pb-20 px-12 max-w-5xl mx-auto">
        {/* Header */}
        <header className="mb-12">
          <h2 className="text-5xl font-headline font-bold text-on-surface tracking-tighter mb-2">Log a New Task</h2>
          <p className="text-[13px] text-[#6B7280] font-medium mb-2">This task will be assigned to you</p>
          <p className="text-on-surface-variant/80 font-medium max-w-lg">
            Fill in the details below to define your next workforce objective. Precision leads to efficiency.
          </p>
        </header>

        {error && (
          <div className="mb-6 px-5 py-3 rounded-2xl bg-error-container text-on-error-container font-semibold text-sm">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-6 px-5 py-3 rounded-2xl bg-primary-container/40 text-on-primary-container font-semibold text-sm">
            {successMsg}
          </div>
        )}

        <div className="space-y-8">
          {/* Card 1: What */}
          <section className="clay-card p-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-primary-container/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-on-primary-container text-sm">edit_note</span>
              </div>
              <h3 className="text-xl font-headline font-bold text-on-surface">What are you doing?</h3>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col space-y-2">
                <label htmlFor="task-title" className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Task Title</label>
                <input
                  id="task-title"
                  className="soft-input px-4 w-full"
                  placeholder="e.g. Weekly Inventory Audit"
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col space-y-2">
                <label htmlFor="task-description" className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Brief Description</label>
                <textarea
                  id="task-description"
                  className="soft-textarea w-full"
                  placeholder="Outline the core objective..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Card 2: Why */}
          <section className="clay-card p-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-primary-container/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-on-primary-container text-sm">question_mark</span>
              </div>
              <h3 className="text-xl font-headline font-bold text-on-surface">Why are you doing it?</h3>
            </div>
            <div className="flex flex-col space-y-2">
              <label htmlFor="task-context" className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Context &amp; Justification</label>
              <textarea
                id="task-context"
                className="soft-textarea w-full"
                placeholder="Describe the impact or necessity of this task..."
                value={context}
                onChange={e => setContext(e.target.value)}
              />
            </div>
          </section>

          {/* Card 3: How */}
          <section className="clay-card p-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-primary-container/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-on-primary-container text-sm">reorder</span>
              </div>
              <h3 className="text-xl font-headline font-bold text-on-surface">How are you doing it?</h3>
            </div>
            <div className="flex flex-col space-y-2">
              <label htmlFor="task-steps" className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Execution Steps</label>
              <textarea
                id="task-steps"
                className="soft-textarea w-full"
                placeholder="List the methodology or required tools..."
                value={steps}
                onChange={e => setSteps(e.target.value)}
              />
            </div>
          </section>

          {/* Priority Level */}
          <section className="clay-card p-8">
            <h3 className="text-lg font-headline font-bold text-on-surface mb-4">Priority Level</h3>
            <div className="flex flex-wrap gap-3">
              {(['Low', 'Medium', 'High', 'Urgent'] as Priority[]).map(p => (
                <button
                  key={p}
                  type="button"
                  className={priorityBtn(p)}
                  onClick={() => setPriority(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </section>

          {/* Card 4: Time & Deadline */}
          <section className="clay-card p-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-primary-container/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-on-primary-container text-sm">schedule</span>
              </div>
              <h3 className="text-xl font-headline font-bold text-on-surface">Time &amp; Deadline</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col space-y-2">
                <label htmlFor="task-hours" className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Estimated Hours</label>
                <input
                  id="task-hours"
                  className="soft-input px-4 w-full"
                  type="number"
                  value={hours}
                  min={0}
                  onChange={e => setHours(parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <div className="flex flex-col space-y-2">
                <label htmlFor="task-minutes" className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Minutes</label>
                <input
                  id="task-minutes"
                  className="soft-input px-4 w-full"
                  type="number"
                  value={minutes}
                  min={0}
                  max={59}
                  onChange={e => setMinutes(parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <div className="flex flex-col space-y-2">
                <label htmlFor="task-deadline" className="text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">Deadline Date</label>
                <div className="relative">
                  <input
                    id="task-deadline"
                    className="soft-input px-4 w-full appearance-none"
                    type="date"
                    value={deadline}
                    onChange={e => setDeadline(e.target.value)}
                  />
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 pointer-events-none">
                    calendar_month
                  </span>
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
              className="text-on-surface-variant/80 font-bold text-sm uppercase tracking-widest hover:text-on-surface transition-colors"
              onClick={() => navigate('/employee/dashboard')}
            >
              Cancel
            </button>
          </div>
          <div className="flex items-center space-x-4 w-full md:w-auto">
            <button
              type="button"
              disabled={saving}
              className="flex-1 md:flex-none px-8 h-[56px] border-2 border-surface-container-lowest/10 rounded-[20px] font-bold text-on-surface hover:bg-surface-container-lowest/5 transition-all disabled:opacity-50"
              onClick={() => saveTask(true)}
            >
              Save &amp; Add Another
            </button>
            <button
              type="button"
              disabled={saving}
              className="flex-1 md:flex-none clay-button-primary px-12 h-[56px] font-extrabold text-sm uppercase tracking-wider flex items-center justify-center space-x-2 disabled:opacity-50"
              onClick={() => saveTask(false)}
            >
              <span>Save Task</span>
              <span className="material-symbols-outlined">check_circle</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
