import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { authApi } from '@/utils/api';
import type { AuthResponse } from '@/types';

// First-admin setup page. Gated by the server: once any admin exists,
// POST /api/auth/setup returns 403 and the client bounces back to /signin.

interface SetupFormErrors {
  name?:            string;
  email?:           string;
  phone?:           string;
  companyName?:    string;
  workRole?:       string;
  workType?:       string;
  joiningDate?:    string;
  linkedinUrl?:    string;
  password?:       string;
  confirmPassword?: string;
}

type WorkType = 'office' | 'remote' | 'hybrid';

function todayIso(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function isStrongPassword(pw: string): boolean {
  return pw.length >= 8 && /\d/.test(pw) && /[!@#$%^&*()_+\-={}[\]|\\:;"'<>,.?/~`]/.test(pw);
}

export default function Setup() {
  const navigate       = useNavigate();
  const { login, token } = useAuth();
  const { setPortal }  = useTheme();

  // Form state
  const [name,            setName]            = useState('');
  const [email,           setEmail]           = useState('');
  const [phone,           setPhone]           = useState('');
  const [companyName,     setCompanyName]     = useState('');
  const [workRole,        setWorkRole]        = useState('');
  const [workType,        setWorkType]        = useState<WorkType>('office');
  const [joiningDate,     setJoiningDate]     = useState(todayIso());
  const [linkedinUrl,     setLinkedinUrl]     = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errors,  setErrors]  = useState<SetupFormErrors>({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { setPortal('auth'); }, [setPortal]);

  // If the user is already logged in (cached token) just send them away.
  useEffect(() => {
    if (token) navigate('/admin/attendance', { replace: true });
  }, [token, navigate]);

  // Guard: if an admin already exists, kick to /signin.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authApi.checkSetup() as { success: boolean; data: { hasAdmin: boolean } };
        if (!cancelled && res.data?.hasAdmin) {
          navigate('/signin', { replace: true });
        }
      } catch { /* offline / backend hiccup — let the user try to submit anyway */ }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  function clearFieldError(key: keyof SetupFormErrors) {
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
    if (apiError) setApiError('');
  }

  function validate(): boolean {
    const next: SetupFormErrors = {};
    if (name.trim().length < 2)              next.name = 'Enter your full name (min 2 characters)';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter a valid email address';
    if (phone.trim().replace(/\D/g, '').length < 10) next.phone = 'Enter a valid 10-digit phone number';
    if (companyName.trim().length < 2)       next.companyName = 'Company name is required';
    if (!workRole.trim())                    next.workRole = 'Work role is required';
    if (!workType)                           next.workType = 'Select a work type';
    if (!joiningDate)                        next.joiningDate = 'Joining date is required';
    if (linkedinUrl.trim() && !/^https?:\/\//i.test(linkedinUrl.trim())) {
      next.linkedinUrl = 'LinkedIn URL must start with http(s)://';
    }
    if (!isStrongPassword(password)) {
      next.password = 'Min 8 characters, one number, and one special character';
    }
    if (password !== confirmPassword)        next.confirmPassword = 'Passwords do not match';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setApiError('');
    try {
      const data = await authApi.setup({
        name:         name.trim(),
        email:        email.trim(),
        phone:        phone.trim(),
        companyName:  companyName.trim(),
        workRole:     workRole.trim(),
        workType,
        joiningDate,
        linkedinUrl:  linkedinUrl.trim() || undefined,
        password,
        confirmPassword,
      }) as AuthResponse;

      login(data.user, data.token, data.user.isAdmin);
      navigate('/admin/attendance', { replace: true });
    } catch (err) {
      const msg = (err as Error).message || 'Setup failed.';
      if (/already exists/i.test(msg)) {
        setApiError('An admin account already exists. Redirecting to sign in…');
        setTimeout(() => navigate('/signin', { replace: true }), 1800);
      } else {
        setApiError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  // Match the existing SignUp.tsx design system exactly.
  const inputCls = (err?: string) =>
    'w-full h-[48px] px-4 rounded-[12px] bg-surface-container-highest/10 border-none ring-1 '
    + (err ? 'ring-error focus:ring-error' : 'ring-surface-container-highest/20 focus:ring-primary-container')
    + ' focus:ring-2 focus:bg-white transition-all outline-none font-body text-surface';
  const labelCls = 'text-xs font-bold font-headline uppercase tracking-wider text-surface-container-highest px-1';
  const sectionTitleCls = 'text-[10px] font-extrabold uppercase tracking-[0.2em] text-primary-container mt-2 mb-3';
  const fieldErr = (k: keyof SetupFormErrors) =>
    errors[k] && <p className="text-[11px] font-semibold text-error mt-1 px-1">{errors[k]}</p>;

  return (
    <main className="min-h-screen flex flex-col md:flex-row bg-surface font-body text-on-surface overflow-x-hidden animate-fade-in">
      {/* Left panel */}
      <section className="w-full md:w-1/2 bg-surface-container-lowest flex flex-col justify-between p-12 relative overflow-hidden">
        <div className="z-10 flex items-center gap-3">
          <img src="/company_logo.jpeg" alt="ShotZoo Logo" className="h-10 w-auto" />
          <span className="font-headline font-bold text-2xl tracking-tighter text-primary-fixed-dim">ShotZoo</span>
        </div>

        <div className="flex-grow flex items-center justify-center py-20 z-10">
          <div className="auth-clay-shape w-64 h-64 md:w-96 md:h-96 flex items-center justify-center">
            <img src="/company_logo.jpeg" alt="ShotZoo" className="h-32 w-auto object-contain opacity-90 drop-shadow-lg" />
          </div>
        </div>

        <div className="z-10">
          <h2 className="font-headline font-bold text-5xl md:text-6xl text-white tracking-tighter leading-none mb-4">
            Set up your workspace.
          </h2>
          <p className="font-headline text-2xl text-primary-fixed-dim opacity-80">One-time admin setup.</p>
        </div>

        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/4 -left-10 w-40 h-40 bg-primary-container/10 rounded-full blur-2xl" />
      </section>

      {/* Right panel */}
      <section className="w-full md:w-1/2 bg-on-background text-surface flex items-center justify-center p-8 md:p-12 lg:p-16 overflow-y-auto">
        <div className="w-full max-w-xl py-8">
          <header className="mb-8">
            <div className="inline-flex items-center gap-2 py-1.5 px-3 rounded-full bg-primary-container/10 mb-4">
              <span className="material-symbols-outlined text-[14px] text-primary-container">shield_person</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary-container">
                First-time setup
              </span>
            </div>
            <h1 className="font-headline font-bold text-4xl text-surface-container-lowest tracking-tight mb-2">
              Create Admin Account
            </h1>
            <p className="text-surface-container-highest font-medium">
              Set up your company's admin workspace.
            </p>
          </header>

          {apiError && (
            <div className="mb-4 rounded-xl bg-red-900/20 px-4 py-3 text-sm text-error font-medium">
              {apiError}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            {/* ── Identity ──────────────────────────────────────────── */}
            <h4 className={sectionTitleCls}>Identity</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="setup-name" className={labelCls}>Full Name *</label>
                <input id="setup-name" type="text" value={name}
                  onChange={e => { setName(e.target.value); clearFieldError('name'); }}
                  placeholder="Your full name" className={inputCls(errors.name)} />
                {fieldErr('name')}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="setup-email" className={labelCls}>Email Address *</label>
                <input id="setup-email" type="email" value={email}
                  onChange={e => { setEmail(e.target.value); clearFieldError('email'); }}
                  placeholder="admin@company.com" className={inputCls(errors.email)} />
                {fieldErr('email')}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="setup-phone" className={labelCls}>Phone *</label>
                <input id="setup-phone" type="tel" value={phone}
                  onChange={e => { setPhone(e.target.value); clearFieldError('phone'); }}
                  placeholder="+1 555 000 0000" className={inputCls(errors.phone)} />
                {fieldErr('phone')}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="setup-company" className={labelCls}>Company Name *</label>
                <input id="setup-company" type="text" value={companyName}
                  onChange={e => { setCompanyName(e.target.value); clearFieldError('companyName'); }}
                  placeholder="e.g. ShotZoo Productions" className={inputCls(errors.companyName)} />
                {fieldErr('companyName')}
              </div>
            </div>

            {/* ── Role & Workplace ──────────────────────────────────── */}
            <h4 className={sectionTitleCls}>Role &amp; Workplace</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="setup-workrole" className={labelCls}>Work Role / Title *</label>
                <input id="setup-workrole" type="text" value={workRole}
                  onChange={e => { setWorkRole(e.target.value); clearFieldError('workRole'); }}
                  placeholder="e.g. Founder, Operations Lead" className={inputCls(errors.workRole)} />
                {fieldErr('workRole')}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="setup-worktype" className={labelCls}>Work Type *</label>
                <select id="setup-worktype" value={workType}
                  onChange={e => { setWorkType(e.target.value as WorkType); clearFieldError('workType'); }}
                  className={`${inputCls(errors.workType)} appearance-none`}>
                  <option value="office">Office</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                </select>
                {fieldErr('workType')}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="setup-joining" className={labelCls}>Joining Date *</label>
                <input id="setup-joining" type="date" value={joiningDate}
                  onChange={e => { setJoiningDate(e.target.value); clearFieldError('joiningDate'); }}
                  className={inputCls(errors.joiningDate)} />
                {fieldErr('joiningDate')}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="setup-linkedin" className={labelCls}>LinkedIn URL</label>
                <input id="setup-linkedin" type="url" value={linkedinUrl}
                  onChange={e => { setLinkedinUrl(e.target.value); clearFieldError('linkedinUrl'); }}
                  placeholder="https://linkedin.com/in/handle" className={inputCls(errors.linkedinUrl)} />
                {fieldErr('linkedinUrl')}
              </div>
            </div>

            {/* ── Security ──────────────────────────────────────────── */}
            <h4 className={sectionTitleCls}>Security</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="setup-password" className={labelCls}>Password *</label>
                <input id="setup-password" type="password" value={password}
                  onChange={e => { setPassword(e.target.value); clearFieldError('password'); }}
                  placeholder="••••••••" className={inputCls(errors.password)} />
                {fieldErr('password')}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="setup-confirm" className={labelCls}>Confirm Password *</label>
                <input id="setup-confirm" type="password" value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); clearFieldError('confirmPassword'); }}
                  placeholder="••••••••" className={inputCls(errors.confirmPassword)} />
                {fieldErr('confirmPassword')}
              </div>
            </div>
            <ul className="text-[11px] text-surface-container-highest/80 px-1 list-disc list-inside space-y-0.5">
              <li>Minimum 8 characters</li>
              <li>At least one number</li>
              <li>At least one special character</li>
            </ul>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-[56px] bg-primary-container text-on-primary-container font-headline font-bold text-lg rounded-[20px] hover:scale-[1.02] active:scale-95 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating account…' : 'Create Admin Account'}
              </button>
            </div>

            <footer className="text-center pt-4">
              <p className="font-body text-sm font-medium text-surface-container-highest">
                Already have an account?{' '}
                <Link to="/signin" className="text-primary-fixed-dim font-bold hover:underline ml-1">Sign In</Link>
              </p>
            </footer>
          </form>
        </div>
      </section>
    </main>
  );
}
