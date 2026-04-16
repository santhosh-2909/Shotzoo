import { useEffect, useState, type FormEvent } from 'react';
import { adminApi } from '@/utils/api';
import type { User } from '@/types';

interface AddAdminForm {
  fullName:        string;
  email:           string;
  password:        string;
  confirmPassword: string;
}

interface AddAdminModalProps {
  isOpen:    boolean;
  onClose:   () => void;
  onSuccess: (admin: User) => void;
}

const makeEmptyForm = (): AddAdminForm => ({
  fullName:        '',
  email:           '',
  password:        '',
  confirmPassword: '',
});

export default function AddAdminModal({ isOpen, onClose, onSuccess }: Readonly<AddAdminModalProps>) {
  const [form,       setForm]       = useState<AddAdminForm>(makeEmptyForm);
  const [errors,     setErrors]     = useState<Partial<Record<keyof AddAdminForm, string>>>({});
  const [apiError,   setApiError]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(makeEmptyForm());
      setErrors({});
      setApiError('');
      setSubmitting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const update = <K extends keyof AddAdminForm>(key: K, value: AddAdminForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
    if (apiError) setApiError('');
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof AddAdminForm, string>> = {};
    if (!form.fullName.trim())                            next.fullName = 'Full name is required';
    if (!form.email.trim())                               next.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(form.email.trim()))   next.email = 'Enter a valid email';
    if (!form.password)                                   next.password = 'Password is required';
    else if (form.password.length < 6)                    next.password = 'Password must be at least 6 characters';
    if (!form.confirmPassword)                            next.confirmPassword = 'Please confirm the password';
    else if (form.password !== form.confirmPassword)      next.confirmPassword = 'Passwords do not match';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setApiError('');
    try {
      const res = await adminApi.createAdmin({
        fullName:        form.fullName.trim(),
        email:           form.email.trim(),
        password:        form.password,
        confirmPassword: form.confirmPassword,
      }) as { success: boolean; user?: User; message?: string };

      if (!res.success || !res.user) {
        setApiError(res.message ?? 'Failed to create admin');
        return;
      }
      onSuccess(res.user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create admin';
      if (/already registered/i.test(msg)) setErrors(prev => ({ ...prev, email: 'Email already registered' }));
      else setApiError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = (fieldError?: string) =>
    `w-full bg-[#f0f3ff] border-none rounded-xl px-4 py-3 text-sm font-medium text-stone-700 focus:ring-2 focus:bg-white outline-none transition-all ${
      fieldError ? 'ring-2 ring-red-300' : 'focus:ring-[#A8CD62]'
    }`;
  const labelCls = 'block text-[11px] font-bold uppercase tracking-widest text-stone-500 mb-1.5';

  const fieldError = (key: keyof AddAdminForm) =>
    errors[key] && <p className="mt-1 text-xs font-bold text-red-500">{errors[key]}</p>;

  return (
    <div
      className="fixed inset-0 bg-black/45 z-[9998] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-admin-title"
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-8 py-6 border-b border-stone-100 z-10">
          <div>
            <h3 id="add-admin-title" className="text-xl font-headline font-extrabold tracking-tight text-stone-900">
              Add New Admin
            </h3>
            <p className="text-xs text-stone-500 mt-1">Grants full admin access — use with care.</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            className="p-2 hover:bg-stone-100 rounded-full transition-colors"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-stone-500">close</span>
          </button>
        </div>

        <form className="p-8 space-y-6" onSubmit={handleSubmit} noValidate>
          {apiError && (
            <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm font-semibold text-red-600">
              {apiError}
            </div>
          )}

          <div>
            <label htmlFor="aa-name" className={labelCls}>Full Name <span className="text-red-500">*</span></label>
            <input
              id="aa-name"
              type="text"
              value={form.fullName}
              onChange={e => update('fullName', e.target.value)}
              placeholder="e.g. Jane Doe"
              className={inputCls(errors.fullName)}
              autoFocus
            />
            {fieldError('fullName')}
          </div>

          <div>
            <label htmlFor="aa-email" className={labelCls}>Email Address <span className="text-red-500">*</span></label>
            <input
              id="aa-email"
              type="email"
              value={form.email}
              onChange={e => update('email', e.target.value)}
              placeholder="admin@company.com"
              className={inputCls(errors.email)}
            />
            {fieldError('email')}
          </div>

          <div>
            <label htmlFor="aa-password" className={labelCls}>Password <span className="text-red-500">*</span></label>
            <input
              id="aa-password"
              type="password"
              value={form.password}
              onChange={e => update('password', e.target.value)}
              placeholder="Minimum 6 characters"
              className={inputCls(errors.password)}
            />
            {fieldError('password')}
          </div>

          <div>
            <label htmlFor="aa-confirm" className={labelCls}>Confirm Password <span className="text-red-500">*</span></label>
            <input
              id="aa-confirm"
              type="password"
              value={form.confirmPassword}
              onChange={e => update('confirmPassword', e.target.value)}
              placeholder="Re-enter the password"
              className={inputCls(errors.confirmPassword)}
            />
            {fieldError('confirmPassword')}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 rounded-xl border-2 border-stone-200 text-stone-600 font-bold text-sm uppercase tracking-wider hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-[2] h-12 bg-[#A8CD62] text-[#131F00] font-extrabold text-sm uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#A8CD62]/30 hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">
                {submitting ? 'progress_activity' : 'shield_person'}
              </span>
              {submitting ? 'Creating…' : 'Create Admin Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
