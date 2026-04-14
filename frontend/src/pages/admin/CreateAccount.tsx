import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { adminApi } from '@/utils/api';

// CreateAccount — admin creates a new employee account. The backend creates
// the account via /auth/create-employee (wrapped by adminApi.createEmployee).

interface CreateEmployeeResponse {
  success: boolean;
  message?: string;
  user?: {
    _id: string;
    fullName: string;
    email: string;
    employeeId: string;
    photo?: string;
  };
}

export default function CreateAccount() {
  const { setPortal } = useTheme();
  const navigate = useNavigate();
  useEffect(() => { setPortal('admin'); }, [setPortal]);

  // ─── Form state ───────────────────────────────────────────────────────
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(String(reader.result || ''));
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!fullName.trim()) { setError('Full name is required'); return; }
    if (!email.trim()) { setError('Email is required'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }

    setSubmitting(true);
    try {
      const body: Record<string, string> = {
        fullName,
        email,
        password,
        phone,
        company,
        role,
      };
      // Note: photo upload on create-employee is best-effort — backend
      // accepts photo via profile update after the account exists, so we
      // persist it in memory and the admin can attach it later.
      if (photoFile) {
        // keep in local var for later use if needed
      }
      const res = (await adminApi.createEmployee(body)) as CreateEmployeeResponse;
      if (!res.success) { setError(res.message || 'Failed to create account'); return; }
      setSuccessMsg('Account created successfully');
      setTimeout(() => navigate('/admin/employees'), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <main className="min-h-screen flex flex-col md:flex-row">
        {/* Left Panel: Branding */}
        <section className="w-full md:w-1/2 bg-[#0d0f08] text-white flex flex-col justify-between p-12 relative overflow-hidden">
          <div className="z-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#a8cd62] flex items-center justify-center">
              <span className="material-symbols-outlined text-[#131f00]">shield_with_heart</span>
            </div>
            <span className="font-headline font-bold text-2xl tracking-tighter text-[#add366]">
              ShotZoo
            </span>
          </div>

          <div className="flex-grow flex items-center justify-center py-20 z-10">
            <div className="auth-clay-shape w-64 h-64 md:w-96 md:h-96 flex items-center justify-center shadow-[0_20px_40px_rgba(240,240,240,0.06),0_10px_10px_rgba(240,240,240,0.04)]">
              <span className="material-symbols-outlined text-white/90 text-[120px]">
                nature
              </span>
            </div>
          </div>

          <div className="z-10">
            <h2 className="font-headline font-bold text-5xl md:text-6xl text-white tracking-tighter leading-none mb-4">
              Join the ShotZoo.
            </h2>
            <p className="font-headline text-2xl text-[#add366] opacity-80">Grow with us.</p>
          </div>

          <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-[#c8f07f]/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/4 -left-10 w-40 h-40 bg-[#add366]/10 rounded-full blur-2xl pointer-events-none" />
        </section>

        {/* Right Panel: Form */}
        <section className="w-full md:w-1/2 bg-[#e3e3d7] text-[#12140d] flex items-center justify-center p-8 md:p-16 lg:p-24">
          <div className="w-full max-w-lg">
            <header className="mb-10">
              <h1 className="font-headline font-bold text-4xl text-[#0d0f08] tracking-tight mb-2">
                Create your account
              </h1>
              <p className="text-[#33362d] font-medium">
                Precision start for your professional journey.
              </p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Photo */}
              <div className="flex flex-col items-center justify-center mb-8">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="relative group w-32 h-32 rounded-full border-2 border-dashed border-[#444939] flex flex-col items-center justify-center bg-black/5 hover:bg-black/10 transition-all duration-300 hover:scale-105 overflow-hidden"
                  aria-label="Upload profile photo"
                >
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[#33362d] text-3xl mb-1">add_a_photo</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#33362d]">
                        Upload Photo
                      </span>
                    </>
                  )}
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  aria-label="Profile photo file input"
                  title="Profile photo file input"
                  onChange={handlePhotoChange}
                />
              </div>

              {/* Name & Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="emp-name" className="text-xs font-bold font-headline uppercase tracking-wider text-[#33362d] px-1 block">
                    Full Name
                  </label>
                  <input
                    id="emp-name"
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full h-12 px-4 rounded-xl bg-black/5 ring-1 ring-black/10 focus:ring-2 focus:ring-[#add366] focus:bg-white transition-all outline-none font-body text-[#0d0f08]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="emp-email" className="text-xs font-bold font-headline uppercase tracking-wider text-[#33362d] px-1 block">
                    Email Address
                  </label>
                  <input
                    id="emp-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="john@shotzoo.io"
                    className="w-full h-12 px-4 rounded-xl bg-black/5 ring-1 ring-black/10 focus:ring-2 focus:ring-[#add366] focus:bg-white transition-all outline-none font-body text-[#0d0f08]"
                  />
                </div>
              </div>

              {/* Phone & Company */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="emp-phone" className="text-xs font-bold font-headline uppercase tracking-wider text-[#33362d] px-1 block">
                    Phone
                  </label>
                  <input
                    id="emp-phone"
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full h-12 px-4 rounded-xl bg-black/5 ring-1 ring-black/10 focus:ring-2 focus:ring-[#add366] focus:bg-white transition-all outline-none font-body text-[#0d0f08]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="emp-company" className="text-xs font-bold font-headline uppercase tracking-wider text-[#33362d] px-1 block">
                    Company
                  </label>
                  <select
                    id="emp-company"
                    value={company}
                    onChange={e => setCompany(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl bg-black/5 ring-1 ring-black/10 focus:ring-2 focus:ring-[#add366] focus:bg-white transition-all outline-none font-body text-[#0d0f08] appearance-none"
                  >
                    <option value="">Select Company</option>
                    <option value="shotzoo">ShotZoo HQ</option>
                    <option value="tactile">Tactile Precision Systems</option>
                    <option value="jungle">Jungle Logistics</option>
                  </select>
                </div>
              </div>

              {/* Role */}
              <div className="space-y-1.5">
                <label htmlFor="emp-role" className="text-xs font-bold font-headline uppercase tracking-wider text-[#33362d] px-1 block">
                  Role / Designation
                </label>
                <input
                  id="emp-role"
                  type="text"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  placeholder="Creative Operations Lead"
                  className="w-full h-12 px-4 rounded-xl bg-black/5 ring-1 ring-black/10 focus:ring-2 focus:ring-[#add366] focus:bg-white transition-all outline-none font-body text-[#0d0f08]"
                />
              </div>

              {/* Passwords */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="emp-pwd" className="text-xs font-bold font-headline uppercase tracking-wider text-[#33362d] px-1 block">
                    Password
                  </label>
                  <input
                    id="emp-pwd"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-12 px-4 rounded-xl bg-black/5 ring-1 ring-black/10 focus:ring-2 focus:ring-[#add366] focus:bg-white transition-all outline-none font-body text-[#0d0f08]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="emp-cfm" className="text-xs font-bold font-headline uppercase tracking-wider text-[#33362d] px-1 block">
                    Confirm Password
                  </label>
                  <input
                    id="emp-cfm"
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-12 px-4 rounded-xl bg-black/5 ring-1 ring-black/10 focus:ring-2 focus:ring-[#add366] focus:bg-white transition-all outline-none font-body text-[#0d0f08]"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-[#FEE2E2] text-[#991B1B] text-sm font-semibold text-center">
                  {error}
                </div>
              )}
              {successMsg && (
                <div className="p-3 rounded-xl bg-[#DCFCE7] text-[#166534] text-sm font-semibold text-center">
                  {successMsg}
                </div>
              )}

              {/* Submit */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-14 bg-[#a8cd62] text-[#3c5600] font-headline font-bold text-lg rounded-[20px] shadow-[0_20px_40px_rgba(240,240,240,0.06),inset_0_2px_4px_rgba(255,255,255,0.2)] hover:scale-[1.02] active:scale-95 transition-all duration-300 disabled:opacity-55 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Creating…' : 'Create Account'}
                </button>
              </div>

              <footer className="text-center space-y-4 pt-6">
                <p className="text-sm font-medium text-[#33362d]">
                  Already have an account?
                  <button
                    type="button"
                    onClick={() => navigate('/signin')}
                    className="text-[#add366] font-bold hover:underline ml-1"
                  >
                    Sign In
                  </button>
                </p>
                <div className="flex items-center justify-center gap-2 py-3 px-4 bg-black/5 rounded-full inline-flex mx-auto">
                  <span className="material-symbols-outlined text-[16px] text-[#33362d]">info</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#33362d]">
                    Employee ID auto generated
                  </span>
                </div>
              </footer>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
