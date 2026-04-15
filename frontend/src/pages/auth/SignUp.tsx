import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { authApi } from '@/utils/api';
import type { AuthResponse } from '@/types';

function todayIso(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export default function SignUp() {
  const navigate         = useNavigate();
  const { login, token, isAdmin } = useAuth();
  const { setPortal }    = useTheme();

  const [fullName,        setFullName]        = useState('');
  const [email,           setEmail]           = useState('');
  const [phone,           setPhone]           = useState('');
  const [company,         setCompany]         = useState('');
  const [workRole,        setWorkRole]        = useState('');
  const [employeeType,    setEmployeeType]    = useState<'Office' | 'Home'>('Office');
  const [joiningDate,     setJoiningDate]     = useState(todayIso());
  const [dateOfBirth,     setDateOfBirth]     = useState('');
  const [gender,          setGender]          = useState('');
  const [linkedinUrl,     setLinkedinUrl]     = useState('');
  const [bio,             setBio]             = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');

  useEffect(() => { setPortal('auth'); }, [setPortal]);

  useEffect(() => {
    if (token) navigate(isAdmin ? '/admin/attendance' : '/employee/dashboard', { replace: true });
  }, [token, isAdmin, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!fullName.trim())              { setError('Full name is required.'); return; }
    if (!email.trim())                 { setError('Email is required.'); return; }
    if (!phone.trim())                 { setError('Phone number is required.'); return; }
    if (!company.trim())               { setError('Company name is required.'); return; }
    if (password.length < 6)           { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword)  { setError('Passwords do not match.'); return; }
    if (linkedinUrl.trim() && !/^https?:\/\//i.test(linkedinUrl.trim())) {
      setError('LinkedIn URL must start with http(s)://'); return;
    }

    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('fullName',        fullName.trim());
      fd.append('email',           email.trim());
      fd.append('phone',           phone.trim());
      fd.append('company',         company.trim());
      fd.append('workRole',        workRole.trim());
      fd.append('employeeType',    employeeType);
      fd.append('joiningDate',     joiningDate);
      if (dateOfBirth) fd.append('dateOfBirth', dateOfBirth);
      if (gender)      fd.append('gender',      gender);
      if (linkedinUrl.trim()) fd.append('linkedinUrl', linkedinUrl.trim());
      if (bio.trim())  fd.append('bio',         bio.trim());
      fd.append('password',        password);
      fd.append('confirmPassword', confirmPassword);

      const data = await authApi.register(fd) as AuthResponse;
      login(data.user, data.token, data.user.isAdmin);
      navigate(data.user.isAdmin ? '/admin/attendance' : '/employee/dashboard', { replace: true });
    } catch (err) {
      setError((err as Error).message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  const inputCls = 'w-full h-[48px] px-4 rounded-[12px] bg-surface-container-highest/10 border-none ring-1 ring-surface-container-highest/20 focus:ring-2 focus:ring-primary-container focus:bg-white transition-all outline-none font-body text-surface';
  const labelCls = 'text-xs font-bold font-headline uppercase tracking-wider text-surface-container-highest px-1';
  const sectionTitleCls = 'text-[10px] font-extrabold uppercase tracking-[0.2em] text-primary-container mt-2 mb-3';

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
            Join the ShotZoo.
          </h2>
          <p className="font-headline text-2xl text-primary-fixed-dim opacity-80">Grow with us.</p>
        </div>

        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/4 -left-10 w-40 h-40 bg-primary-container/10 rounded-full blur-2xl" />
      </section>

      {/* Right panel */}
      <section className="w-full md:w-1/2 bg-on-background text-surface flex items-center justify-center p-8 md:p-12 lg:p-16 overflow-y-auto">
        <div className="w-full max-w-xl py-8">
          <header className="mb-8">
            <h1 className="font-headline font-bold text-4xl text-surface-container-lowest tracking-tight mb-2">
              Create Admin Account
            </h1>
            <p className="text-surface-container-highest font-medium">
              Set up your company's admin workspace.
            </p>
          </header>

          {error && (
            <div className="mb-4 rounded-xl bg-red-900/20 px-4 py-3 text-sm text-error font-medium">
              {error}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* ── Identity ──────────────────────────────────────────── */}
            <h4 className={sectionTitleCls}>Identity</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="reg-fullName" className={labelCls}>Full Name *</label>
                <input id="reg-fullName" type="text" required value={fullName}
                  onChange={e => setFullName(e.target.value)} placeholder="Your full name" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="reg-email" className={labelCls}>Email Address *</label>
                <input id="reg-email" type="email" required value={email}
                  onChange={e => setEmail(e.target.value)} placeholder="admin@company.com" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="reg-phone" className={labelCls}>Phone *</label>
                <input id="reg-phone" type="tel" required value={phone}
                  onChange={e => setPhone(e.target.value)} placeholder="+1 555 000 0000" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="reg-company" className={labelCls}>Company Name *</label>
                <input id="reg-company" type="text" required value={company}
                  onChange={e => setCompany(e.target.value)} placeholder="e.g. ShotZoo Productions" className={inputCls} />
              </div>
            </div>

            {/* ── Role ──────────────────────────────────────────────── */}
            <h4 className={sectionTitleCls}>Role &amp; Workplace</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="reg-workrole" className={labelCls}>Work Role / Title</label>
                <input id="reg-workrole" type="text" value={workRole}
                  onChange={e => setWorkRole(e.target.value)} placeholder="e.g. Founder, Operations Lead" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="reg-worktype" className={labelCls}>Work Type</label>
                <select id="reg-worktype" value={employeeType}
                  onChange={e => setEmployeeType(e.target.value as 'Office' | 'Home')}
                  className={`${inputCls} appearance-none`}
                >
                  <option value="Office">Office</option>
                  <option value="Home">Home</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="reg-joining" className={labelCls}>Joining Date</label>
                <input id="reg-joining" type="date" value={joiningDate}
                  onChange={e => setJoiningDate(e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="reg-linkedin" className={labelCls}>LinkedIn URL</label>
                <input id="reg-linkedin" type="url" value={linkedinUrl}
                  onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/handle" className={inputCls} />
              </div>
            </div>

            {/* ── Personal (optional) ───────────────────────────────── */}
            <h4 className={sectionTitleCls}>Personal Details (optional)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="reg-dob" className={labelCls}>Date of Birth</label>
                <input id="reg-dob" type="date" value={dateOfBirth}
                  onChange={e => setDateOfBirth(e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="reg-gender" className={labelCls}>Gender</label>
                <select id="reg-gender" value={gender}
                  onChange={e => setGender(e.target.value)}
                  className={`${inputCls} appearance-none`}
                >
                  <option value="">— Select —</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-bio" className={labelCls}>Short Bio</label>
              <textarea id="reg-bio" value={bio} rows={2}
                onChange={e => setBio(e.target.value)} placeholder="A short note about yourself or your company"
                className={`${inputCls} h-auto py-3 resize-none`} />
            </div>

            {/* ── Password ──────────────────────────────────────────── */}
            <h4 className={sectionTitleCls}>Account Password</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="reg-password" className={labelCls}>Password *</label>
                <input id="reg-password" type="password" required minLength={6} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="reg-confirmPassword" className={labelCls}>Confirm Password *</label>
                <input id="reg-confirmPassword" type="password" required minLength={6} value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" className={inputCls} />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-[56px] bg-primary-container text-on-primary-container font-headline font-bold text-lg rounded-[20px] hover:scale-[1.02] active:scale-95 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating Account…' : 'Create Admin Account'}
              </button>
            </div>

            <footer className="text-center space-y-4 pt-4">
              <p className="font-body text-sm font-medium text-surface-container-highest">
                Already have an account?{' '}
                <Link to="/signin" className="text-primary-fixed-dim font-bold hover:underline ml-1">Sign In</Link>
              </p>
              <div className="flex items-center justify-center gap-2 py-3 px-4 bg-surface-container-highest/5 rounded-full w-fit mx-auto">
                <span className="material-symbols-outlined text-[16px] text-surface-container-highest">shield_person</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-surface-container-highest">
                  Admin accounts only
                </span>
              </div>
            </footer>
          </form>
        </div>
      </section>
    </main>
  );
}
