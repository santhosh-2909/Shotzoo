import { useEffect, useState, type FormEvent } from 'react';
import { adminApi } from '@/utils/api';
import type { User } from '@/types';

interface AddEmployeeForm {
  fullName:     string;
  email:        string;
  password:     string;
  phone:        string;
  role:         'Admin' | 'Employee';
  employeeType: 'Office' | 'Home';
  joiningDate:  string;
  workRole:     string;
  dateOfBirth:  string;
  gender:       'Male' | 'Female' | 'Prefer not to say' | '';
  linkedinUrl:  string;
  bio:          string;
}

interface AddEmployeeModalProps {
  isOpen:    boolean;
  onClose:   () => void;
  onSuccess: (employee: User) => void;
}

function today(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const makeEmptyForm = (): AddEmployeeForm => ({
  fullName:     '',
  email:        '',
  password:     '',
  phone:        '',
  role:         'Employee',
  employeeType: 'Office',
  joiningDate:  today(),
  workRole:     '',
  dateOfBirth:  '',
  gender:       '',
  linkedinUrl:  '',
  bio:          '',
});

export default function AddEmployeeModal({ isOpen, onClose, onSuccess }: Readonly<AddEmployeeModalProps>) {
  const [form,       setForm]       = useState<AddEmployeeForm>(makeEmptyForm);
  const [errors,     setErrors]     = useState<Partial<Record<keyof AddEmployeeForm, string>>>({});
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

  const update = <K extends keyof AddEmployeeForm>(key: K, value: AddEmployeeForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
    if (apiError) setApiError('');
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof AddEmployeeForm, string>> = {};
    if (!form.fullName.trim())       next.fullName = 'Full name is required';
    if (!form.email.trim())          next.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = 'Enter a valid email';
    if (!form.password)              next.password = 'Password is required';
    else if (form.password.length < 6) next.password = 'Password must be at least 6 characters';
    if (!form.phone.trim())          next.phone = 'Phone number is required';
    else if (form.phone.trim().replace(/\D/g, '').length < 7) next.phone = 'Enter a valid phone number';
    if (!form.joiningDate)           next.joiningDate = 'Joining date is required';
    if (!form.workRole.trim())       next.workRole = 'Work role is required';
    if (form.linkedinUrl.trim() && !/^https?:\/\//i.test(form.linkedinUrl.trim())) {
      next.linkedinUrl = 'LinkedIn URL must start with http(s)://';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setApiError('');
    try {
      const res = await adminApi.createEmployee({
        fullName:     form.fullName.trim(),
        email:        form.email.trim(),
        phone:        form.phone.trim(),
        password:     form.password,
        role:         form.role,
        employeeType: form.employeeType,
        joiningDate:  form.joiningDate,
        workRole:     form.workRole.trim(),
        dateOfBirth:  form.dateOfBirth || undefined,
        gender:       form.gender || undefined,
        linkedinUrl:  form.linkedinUrl.trim() || undefined,
        bio:          form.bio.trim() || undefined,
      }) as { success: boolean; user?: User; message?: string };

      if (!res.success || !res.user) {
        setApiError(res.message ?? 'Failed to create employee');
        return;
      }
      onSuccess(res.user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create employee';
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
  const sectionTitleCls = 'text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#A8CD62] mb-4';

  const fieldError = (key: keyof AddEmployeeForm) =>
    errors[key] && <p className="mt-1 text-xs font-bold text-red-500">{errors[key]}</p>;

  return (
    <div
      className="fixed inset-0 bg-black/45 z-[9998] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-employee-title"
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-8 py-6 border-b border-stone-100 z-10">
          <div>
            <h3 id="add-employee-title" className="text-xl font-headline font-extrabold tracking-tight text-stone-900">
              Add New Employee
            </h3>
            <p className="text-xs text-stone-500 mt-1">Fields marked with <span className="text-red-500">*</span> are required</p>
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

        <form className="p-8 space-y-8" onSubmit={handleSubmit} noValidate>
          {apiError && (
            <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm font-semibold text-red-600">
              {apiError}
            </div>
          )}

          {/* ── Account credentials ─────────────────────────────────────── */}
          <section>
            <h4 className={sectionTitleCls}>Account Credentials</h4>
            <div className="space-y-4">
              <div>
                <label htmlFor="ae-name" className={labelCls}>Full Name <span className="text-red-500">*</span></label>
                <input
                  id="ae-name"
                  type="text"
                  value={form.fullName}
                  onChange={e => update('fullName', e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className={inputCls(errors.fullName)}
                  autoFocus
                />
                {fieldError('fullName')}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ae-email" className={labelCls}>Email Address <span className="text-red-500">*</span></label>
                  <input
                    id="ae-email"
                    type="email"
                    value={form.email}
                    onChange={e => update('email', e.target.value)}
                    placeholder="jane@company.com"
                    className={inputCls(errors.email)}
                  />
                  {fieldError('email')}
                </div>
                <div>
                  <label htmlFor="ae-phone" className={labelCls}>Phone Number <span className="text-red-500">*</span></label>
                  <input
                    id="ae-phone"
                    type="tel"
                    value={form.phone}
                    onChange={e => update('phone', e.target.value)}
                    placeholder="+1 555 000 0000"
                    className={inputCls(errors.phone)}
                  />
                  {fieldError('phone')}
                </div>
              </div>

              <div>
                <label htmlFor="ae-password" className={labelCls}>Temporary Password <span className="text-red-500">*</span></label>
                <input
                  id="ae-password"
                  type="text"
                  value={form.password}
                  onChange={e => update('password', e.target.value)}
                  placeholder="Minimum 6 characters"
                  className={inputCls(errors.password)}
                />
                {fieldError('password')}
              </div>
            </div>
          </section>

          {/* ── Employment details ─────────────────────────────────────── */}
          <section>
            <h4 className={sectionTitleCls}>Employment Details</h4>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ae-role" className={labelCls}>Role <span className="text-red-500">*</span></label>
                  <select
                    id="ae-role"
                    value={form.role}
                    onChange={e => update('role', e.target.value as AddEmployeeForm['role'])}
                    className={`${inputCls()} appearance-none`}
                  >
                    <option value="Employee">Employee</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="ae-type" className={labelCls}>Work Type <span className="text-red-500">*</span></label>
                  <select
                    id="ae-type"
                    value={form.employeeType}
                    onChange={e => update('employeeType', e.target.value as AddEmployeeForm['employeeType'])}
                    className={`${inputCls()} appearance-none`}
                  >
                    <option value="Office">Office</option>
                    <option value="Home">Home</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="ae-workrole" className={labelCls}>Work Role / Job Title <span className="text-red-500">*</span></label>
                <input
                  id="ae-workrole"
                  type="text"
                  value={form.workRole}
                  onChange={e => update('workRole', e.target.value)}
                  placeholder="e.g. Growth Strategist, Performance Marketer"
                  className={inputCls(errors.workRole)}
                />
                {fieldError('workRole')}
              </div>

              <div>
                <label htmlFor="ae-joining" className={labelCls}>Joining Date <span className="text-red-500">*</span></label>
                <input
                  id="ae-joining"
                  type="date"
                  value={form.joiningDate}
                  onChange={e => update('joiningDate', e.target.value)}
                  className={inputCls(errors.joiningDate)}
                />
                {fieldError('joiningDate')}
              </div>
            </div>
          </section>

          {/* ── Personal details (optional) ────────────────────────────── */}
          <section>
            <h4 className={sectionTitleCls}>Personal Details (optional)</h4>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ae-dob" className={labelCls}>Date of Birth</label>
                  <input
                    id="ae-dob"
                    type="date"
                    value={form.dateOfBirth}
                    onChange={e => update('dateOfBirth', e.target.value)}
                    className={inputCls()}
                  />
                </div>
                <div>
                  <label htmlFor="ae-gender" className={labelCls}>Gender</label>
                  <select
                    id="ae-gender"
                    value={form.gender}
                    onChange={e => update('gender', e.target.value as AddEmployeeForm['gender'])}
                    className={`${inputCls()} appearance-none`}
                  >
                    <option value="">— Select —</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="ae-linkedin" className={labelCls}>LinkedIn Profile URL</label>
                <input
                  id="ae-linkedin"
                  type="url"
                  value={form.linkedinUrl}
                  onChange={e => update('linkedinUrl', e.target.value)}
                  placeholder="https://linkedin.com/in/your-handle"
                  className={inputCls(errors.linkedinUrl)}
                />
                {fieldError('linkedinUrl')}
              </div>

              <div>
                <label htmlFor="ae-bio" className={labelCls}>Short Bio</label>
                <textarea
                  id="ae-bio"
                  value={form.bio}
                  onChange={e => update('bio', e.target.value)}
                  placeholder="A short note about the new hire (optional)"
                  rows={3}
                  className={`${inputCls()} resize-none`}
                />
              </div>
            </div>
          </section>

          <div className="text-[11px] text-stone-500 bg-stone-50 rounded-xl px-4 py-3">
            <span className="font-bold">Note:</span> Employee ID is auto-generated (format: SZ-EMP-XXXX) and emailed to the new employee if email is configured.
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
                {submitting ? 'progress_activity' : 'person_add'}
              </span>
              {submitting ? 'Creating…' : 'Create Employee Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
