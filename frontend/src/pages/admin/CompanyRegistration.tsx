import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { authApi } from '@/utils/api';

// Company Registration — sets up a company workspace + the primary admin account.
// The backend does not currently expose a dedicated company endpoint, so we
// pass through to /auth/register with the admin details, and persist the
// company metadata client-side (localStorage) for later use.

export default function CompanyRegistration() {
  const { setPortal } = useTheme();
  const navigate = useNavigate();
  useEffect(() => { setPortal('admin'); }, [setPortal]);

  // ─── Company fields ───────────────────────────────────────────────────
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [industry, setIndustry] = useState('Photography');
  const [companySize, setCompanySize] = useState('1-10 Employees');

  // ─── Admin fields ─────────────────────────────────────────────────────
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showCfm, setShowCfm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(String(reader.result || ''));
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!companyName.trim()) { setError('Company name is required'); return; }
    if (!companyCode.trim()) { setError('Company code is required'); return; }
    if (!fullName.trim()) { setError('Admin name is required'); return; }
    if (!email.trim()) { setError('Email is required'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('fullName', fullName);
      fd.append('email', email);
      fd.append('password', password);
      fd.append('company', companyName);
      fd.append('companyCode', companyCode);
      fd.append('industry', industry);
      fd.append('companySize', companySize);
      if (logoFile) fd.append('photo', logoFile);

      // Persist company metadata locally so follow-up pages can reference it
      localStorage.setItem(
        'shotzoo_company',
        JSON.stringify({ name: companyName, code: companyCode, industry, size: companySize }),
      );

      await authApi.register(fd);
      navigate('/admin/attendance');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="animate-fade-in min-h-screen flex flex-col items-center justify-center p-6 md:p-12">
      <main className="w-full max-w-[480px] space-y-10">
        {/* Brand */}
        <header className="flex flex-col items-center space-y-6">
          <div className="text-[24px] font-bold tracking-tight font-headline text-on-surface">
            ShotZoo
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-[1.75rem] font-headline font-extrabold tracking-tight text-on-surface leading-none">
              Register Your Company
            </h1>
            <p className="text-base text-on-surface-variant font-normal">
              Set up your team&apos;s admin workspace
            </p>
          </div>
        </header>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          className="bg-surface-container-lowest rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] p-8 space-y-8"
        >
          {/* Company Details */}
          <section className="space-y-4">
            <div className="flex items-center gap-6">
              <div className="flex-shrink-0">
                <label className="block text-xs font-semibold text-on-surface-variant mb-2">Logo</label>
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="w-20 h-20 rounded-lg bg-surface-container-low flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container-high transition-colors relative overflow-hidden group"
                  aria-label="Upload company logo"
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-outline group-hover:scale-110 transition-transform">add_a_photo</span>
                      <span className="text-[10px] font-mono text-outline-variant mt-1 uppercase">80x80</span>
                    </>
                  )}
                </button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  aria-label="Company logo file input"
                  title="Company logo file input"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              </div>
              <div className="flex-grow space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="company-name" className="block text-xs font-semibold text-on-surface-variant">
                    Company Name
                  </label>
                  <input
                    id="company-name"
                    type="text"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder="e.g. Acme Studio"
                    className="w-full px-4 py-3 rounded-t-lg text-sm bg-[#f0f3ff] border-b-2 border-transparent focus:bg-[#e2e8f8] focus:border-[#a8cd62] focus:outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="company-code" className="block text-xs font-semibold text-on-surface-variant">
                    Company Code
                  </label>
                  <input
                    id="company-code"
                    type="text"
                    value={companyCode}
                    onChange={e => setCompanyCode(e.target.value)}
                    placeholder="ACME-2024"
                    className="w-full px-4 py-3 rounded-t-lg font-mono text-xs tracking-wider bg-[#f0f3ff] border-b-2 border-transparent focus:bg-[#e2e8f8] focus:border-[#a8cd62] focus:outline-none transition-all"
                  />
                  <p className="text-[11px] text-outline italic">
                    Unique identifier for team join requests.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="industry" className="block text-xs font-semibold text-on-surface-variant">
                  Industry
                </label>
                <select
                  id="industry"
                  value={industry}
                  onChange={e => setIndustry(e.target.value)}
                  className="w-full px-4 py-3 rounded-t-lg text-sm bg-[#f0f3ff] border-b-2 border-transparent focus:bg-[#e2e8f8] focus:border-[#a8cd62] focus:outline-none transition-all appearance-none"
                >
                  <option>Photography</option>
                  <option>Videography</option>
                  <option>Creative Agency</option>
                  <option>Production House</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="company-size" className="block text-xs font-semibold text-on-surface-variant">
                  Company Size
                </label>
                <select
                  id="company-size"
                  value={companySize}
                  onChange={e => setCompanySize(e.target.value)}
                  className="w-full px-4 py-3 rounded-t-lg text-sm bg-[#f0f3ff] border-b-2 border-transparent focus:bg-[#e2e8f8] focus:border-[#a8cd62] focus:outline-none transition-all appearance-none"
                >
                  <option>1-10 Employees</option>
                  <option>11-50 Employees</option>
                  <option>51-200 Employees</option>
                  <option>200+ Employees</option>
                </select>
              </div>
            </div>
          </section>

          {/* Divider */}
          <div className="relative py-2">
            <div aria-hidden="true" className="absolute inset-0 flex items-center">
              <div className="w-full bg-surface-container-low h-[1px]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-surface-container-lowest px-4 text-xs font-bold text-on-surface-variant font-headline tracking-widest uppercase">
                Admin Account
              </span>
            </div>
          </div>

          {/* Admin Account */}
          <section className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="admin-name" className="block text-xs font-semibold text-on-surface-variant">
                Full Name
              </label>
              <input
                id="admin-name"
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Jane Cooper"
                className="w-full px-4 py-3 rounded-t-lg text-sm bg-[#f0f3ff] border-b-2 border-transparent focus:bg-[#e2e8f8] focus:border-[#a8cd62] focus:outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="admin-email" className="block text-xs font-semibold text-on-surface-variant">
                Email Address
              </label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jane@shotzoo.com"
                className="w-full px-4 py-3 rounded-t-lg text-sm bg-[#f0f3ff] border-b-2 border-transparent focus:bg-[#e2e8f8] focus:border-[#a8cd62] focus:outline-none transition-all"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="admin-password" className="block text-xs font-semibold text-on-surface-variant">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="admin-password"
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-10 rounded-t-lg text-sm bg-[#f0f3ff] border-b-2 border-transparent focus:bg-[#e2e8f8] focus:border-[#a8cd62] focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                  >
                    <span className="material-symbols-outlined text-[18px]">{showPwd ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="admin-cfm" className="block text-xs font-semibold text-on-surface-variant">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="admin-cfm"
                    type={showCfm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-10 rounded-t-lg text-sm bg-[#f0f3ff] border-b-2 border-transparent focus:bg-[#e2e8f8] focus:border-[#a8cd62] focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCfm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                    aria-label={showCfm ? 'Hide password' : 'Show password'}
                  >
                    <span className="material-symbols-outlined text-[18px]">{showCfm ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {error && (
            <div className="p-3 rounded-lg bg-[#FEE2E2] text-[#991B1B] text-sm font-semibold text-center">
              {error}
            </div>
          )}

          <div className="pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-[#a8cd62] text-[#3c5600] font-bold rounded-lg transition-all duration-200 active:scale-[0.98] hover:brightness-95 shadow-sm disabled:opacity-55 disabled:cursor-not-allowed"
            >
              {submitting ? 'Registering…' : 'Register & Continue'}
            </button>
          </div>
        </form>

        <footer className="text-center pb-8">
          <p className="text-sm text-on-surface-variant">
            Already registered?{' '}
            <button
              type="button"
              onClick={() => navigate('/signin')}
              className="text-primary font-bold ml-1 hover:underline decoration-2 underline-offset-4"
            >
              Sign In
            </button>
          </p>
        </footer>
      </main>

      {/* Decor */}
      <div className="fixed top-0 left-0 w-full h-1 bg-[#a8cd62]/20 pointer-events-none" />
    </div>
  );
}
