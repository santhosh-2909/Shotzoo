import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { profileApi, uploadUrl } from '@/utils/api';
import type { User } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────
function dateToInput(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function maskEmail(e: string): string {
  if (!e) return '';
  const parts = String(e).split('@');
  if (parts.length !== 2) return e;
  const local = parts[0];
  const visible = local.slice(0, Math.min(3, Math.max(1, local.length - 1)));
  return visible + '*'.repeat(Math.max(1, local.length - visible.length)) + '@' + parts[1];
}

interface ProfileResponse { success: boolean; user: User; message?: string }
interface ResetRequestResponse { success: boolean; destination?: string; message?: string }

type Gender = 'Male' | 'Female' | 'Prefer not to say' | '';
type LocationType = 'Home' | 'Office' | '';

export default function AdminProfile() {
  const { setPortal } = useTheme();
  useEffect(() => { setPortal('admin'); }, [setPortal]);

  // ─── Profile state ────────────────────────────────────────────────────
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [gender, setGender] = useState<Gender>('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [workRole, setWorkRole] = useState('');
  const [location, setLocation] = useState<LocationType>('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // ─── Password state ───────────────────────────────────────────────────
  const [pwdCur, setPwdCur] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdCfm, setPwdCfm] = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showCfm, setShowCfm] = useState(false);
  const [pwdCurErr, setPwdCurErr] = useState('');
  const [pwdNewErr, setPwdNewErr] = useState('');
  const [pwdCfmErr, setPwdCfmErr] = useState('');
  const [updatingPwd, setUpdatingPwd] = useState(false);

  // ─── Forgot password modal state ──────────────────────────────────────
  const [fpOpen, setFpOpen] = useState(false);
  const [fpStep, setFpStep] = useState<1 | 2 | 3>(1);
  const [fpChannel, setFpChannel] = useState<'email' | 'mobile'>('email');
  const [fpOtp, setFpOtp] = useState(['', '', '', '', '', '']);
  const [fpStoredCode, setFpStoredCode] = useState('');
  const [fpNew, setFpNew] = useState('');
  const [fpConfirm, setFpConfirm] = useState('');
  const [fpStep1Err, setFpStep1Err] = useState('');
  const [fpOtpErr, setFpOtpErr] = useState('');
  const [fpFinalErr, setFpFinalErr] = useState('');
  const [fpResendSec, setFpResendSec] = useState(0);
  const [fpDestination, setFpDestination] = useState('');
  const [fpSending, setFpSending] = useState(false);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  // ─── Toast ────────────────────────────────────────────────────────────
  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  }, []);

  // ─── Load profile ─────────────────────────────────────────────────────
  const loadProfile = useCallback(() => {
    (profileApi.get() as Promise<ProfileResponse>)
      .then(d => {
        const u = d.user || ({} as User);
        setFullName(u.fullName || '');
        setEmail(u.email || '');
        setPhone(u.phone || '');
        setJoiningDate(dateToInput(u.joiningDate));
        setGender(u.gender || '');
        setDateOfBirth(dateToInput(u.dateOfBirth));
        setLinkedinUrl(u.linkedinUrl || '');
        setWorkRole(u.workRole || '');
        setLocation((u.employeeType as LocationType) || '');
        setPhotoUrl(u.photo ? uploadUrl(u.photo) : '');
      })
      .catch(() => setProfileError('Failed to load profile. Please refresh.'));
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // ─── Photo upload ─────────────────────────────────────────────────────
  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('photo', file);
    try {
      const d = (await profileApi.update(fd)) as ProfileResponse;
      if (d.user) {
        setPhotoUrl(d.user.photo ? uploadUrl(d.user.photo) : '');
        localStorage.setItem('shotzoo_user', JSON.stringify(d.user));
      }
      showToast('Photo updated');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Photo upload failed');
    }
  }

  // ─── Save profile ─────────────────────────────────────────────────────
  async function handleSaveProfile() {
    setSavingProfile(true);
    setProfileError('');
    const fd = new FormData();
    fd.append('fullName', fullName);
    fd.append('email', email);
    fd.append('phone', phone);
    fd.append('joiningDate', joiningDate);
    fd.append('gender', gender);
    fd.append('dateOfBirth', dateOfBirth);
    fd.append('linkedinUrl', linkedinUrl);
    fd.append('workRole', workRole);
    if (location === 'Office' || location === 'Home') fd.append('employeeType', location);
    try {
      const d = (await profileApi.update(fd)) as ProfileResponse;
      if (d.user) localStorage.setItem('shotzoo_user', JSON.stringify(d.user));
      showToast('Profile saved');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  }

  // ─── Update password ──────────────────────────────────────────────────
  async function handleUpdatePassword() {
    setPwdCurErr(''); setPwdNewErr(''); setPwdCfmErr('');
    if (!pwdCur) { setPwdCurErr('Enter your current password'); return; }
    if (!pwdNew) { setPwdNewErr('Enter a new password'); return; }
    if (pwdNew.length < 6) { setPwdNewErr('Password must be at least 6 characters'); return; }
    if (pwdNew !== pwdCfm) { setPwdCfmErr('Passwords do not match'); return; }

    setUpdatingPwd(true);
    try {
      await profileApi.changePassword({
        currentPassword: pwdCur,
        newPassword: pwdNew,
        confirmPassword: pwdCfm,
      });
      setPwdCur(''); setPwdNew(''); setPwdCfm('');
      showToast('Password updated successfully');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update password';
      if (/current password/i.test(msg)) setPwdCurErr('Incorrect current password');
      else if (/do not match/i.test(msg)) setPwdCfmErr('Passwords do not match');
      else setPwdCfmErr(msg);
    } finally {
      setUpdatingPwd(false);
    }
  }

  // ─── Forgot password modal ────────────────────────────────────────────
  function openForgot() {
    const u = JSON.parse(localStorage.getItem('shotzoo_user') || '{}') as Partial<User>;
    setFpChannel('email');
    setFpDestination(u.email ? maskEmail(u.email) : '—');
    setFpStep1Err(''); setFpOtpErr(''); setFpFinalErr('');
    setFpOtp(['', '', '', '', '', '']);
    setFpNew(''); setFpConfirm('');
    setFpStep(1);
    setFpOpen(true);
  }

  function closeForgot() {
    setFpOpen(false);
    setFpResendSec(0);
  }

  // Resend countdown effect
  useEffect(() => {
    if (!fpOpen || fpStep !== 2 || fpResendSec <= 0) return;
    const t = setInterval(() => setFpResendSec(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [fpOpen, fpStep, fpResendSec]);

  // Escape to close
  useEffect(() => {
    if (!fpOpen) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') closeForgot(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [fpOpen]);

  async function sendOtp() {
    setFpSending(true);
    setFpStep1Err('');
    try {
      const d = (await profileApi.requestOtp(fpChannel)) as ResetRequestResponse;
      const storedUser = JSON.parse(localStorage.getItem('shotzoo_user') || '{}') as Partial<User>;
      setFpDestination(d.destination || storedUser.email || 'your email');
      setFpStep(2);
      setFpResendSec(30);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (err) {
      setFpStep1Err(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setFpSending(false);
    }
  }

  function handleOtpChange(i: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(0, 1);
    const next = [...fpOtp];
    next[i] = digit;
    setFpOtp(next);
    setFpOtpErr('');
    if (digit && i < 5) otpRefs.current[i + 1]?.focus();
  }

  function handleOtpKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !fpOtp[i] && i > 0) {
      otpRefs.current[i - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text');
    const digits = (text || '').replace(/\D/g, '').slice(0, 6);
    if (!digits) return;
    e.preventDefault();
    const next = ['', '', '', '', '', ''];
    for (let j = 0; j < digits.length; j++) next[j] = digits[j];
    setFpOtp(next);
    const nextIdx = Math.min(digits.length, 5);
    otpRefs.current[nextIdx]?.focus();
  }

  function verifyOtp() {
    const code = fpOtp.join('');
    if (!/^\d{6}$/.test(code)) { setFpOtpErr('Enter the 6-digit code'); return; }
    setFpStoredCode(code);
    setFpOtpErr('');
    setFpStep(3);
  }

  async function submitNewPassword() {
    setFpFinalErr('');
    if (!fpNew || fpNew.length < 6) { setFpFinalErr('Password must be at least 6 characters'); return; }
    if (fpNew !== fpConfirm) { setFpFinalErr('Passwords do not match'); return; }
    try {
      await profileApi.confirmOtp({
        code: fpStoredCode,
        newPassword: fpNew,
        confirmPassword: fpConfirm,
      });
      closeForgot();
      showToast('Password updated successfully');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update password';
      if (/Invalid OTP/i.test(msg)) { setFpStep(2); setFpOtpErr('Invalid OTP. Try again.'); }
      else if (/expired/i.test(msg)) { setFpStep(2); setFpOtpErr(msg); }
      else setFpFinalErr(msg);
    }
  }

  const initial = (fullName || 'A').trim().charAt(0).toUpperCase() || 'A';

  return (
    <div className="animate-fade-in">
      {/* Toast */}
      <div
        className={`fixed top-6 right-6 bg-[#2A313D] text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-2 z-[999] transition-all duration-300 pointer-events-none ${
          toastVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-5'
        }`}
      >
        <span className="material-symbols-outlined text-[#a8cd62]">check_circle</span>
        <span className="font-bold text-sm">{toast}</span>
      </div>

      <main className="p-12 max-w-5xl">
        <header className="mb-10">
          <h1 className="text-4xl font-extrabold tracking-tighter">My Profile</h1>
          <p className="text-[#6B7280] mt-2 font-medium">
            Update your personal details, contact info, and security settings.
          </p>
        </header>

        {profileError && (
          <div className="mb-6 p-4 rounded-xl bg-[#FEE2E2] text-[#991B1B] text-sm font-semibold">
            {profileError}
          </div>
        )}

        <div className="space-y-8">
          {/* Personal Info */}
          <section className="clay-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="material-symbols-outlined text-[#a8cd62] text-2xl">badge</span>
              <h2 className="text-xl font-extrabold tracking-tight">Personal Information</h2>
            </div>
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="relative w-32 h-32 rounded-full bg-[#F0F2EA] flex items-center justify-center overflow-hidden border-[3px] border-[#A8CD62] text-[#3C5600] font-extrabold text-4xl font-headline cursor-pointer group"
                  title="Click to change photo"
                >
                  {photoUrl ? (
                    <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span>{initial}</span>
                  )}
                  <div className="absolute inset-0 bg-black/45 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="material-symbols-outlined">photo_camera</span>
                  </div>
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  aria-label="Upload profile photo"
                  title="Upload profile photo"
                  onChange={handlePhotoChange}
                />
                <span className="text-[11px] text-[#6B7280] font-semibold">Click to change</span>
              </div>

              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
                <div className="md:col-span-2">
                  <label htmlFor="prof-name" className="block text-[11px] uppercase tracking-widest font-extrabold text-[#6B7280] mb-1.5 ml-1">
                    Full Name
                  </label>
                  <input
                    id="prof-name"
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    className="w-full bg-[#F0F2EA] rounded-2xl px-4 py-3.5 font-semibold text-stone-900 placeholder:text-[#6B7280] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#A8CD62] transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="prof-joining" className="block text-[11px] uppercase tracking-widest font-extrabold text-[#6B7280] mb-1.5 ml-1">
                    Joining Date
                  </label>
                  <input
                    id="prof-joining"
                    type="date"
                    title="Joining date"
                    value={joiningDate}
                    onChange={e => setJoiningDate(e.target.value)}
                    className="w-full bg-[#F0F2EA] rounded-2xl px-4 py-3.5 font-semibold text-stone-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#A8CD62] transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="prof-gender" className="block text-[11px] uppercase tracking-widest font-extrabold text-[#6B7280] mb-1.5 ml-1">
                    Gender
                  </label>
                  <select
                    id="prof-gender"
                    title="Gender"
                    value={gender}
                    onChange={e => setGender(e.target.value as Gender)}
                    className="w-full bg-[#F0F2EA] rounded-2xl px-4 py-3.5 font-semibold text-stone-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#A8CD62] transition-all appearance-none"
                  >
                    <option value="">— Select —</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="prof-dob" className="block text-[11px] uppercase tracking-widest font-extrabold text-[#6B7280] mb-1.5 ml-1">
                    Date of Birth
                  </label>
                  <input
                    id="prof-dob"
                    type="date"
                    title="Date of birth"
                    value={dateOfBirth}
                    onChange={e => setDateOfBirth(e.target.value)}
                    className="w-full bg-[#F0F2EA] rounded-2xl px-4 py-3.5 font-semibold text-stone-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#A8CD62] transition-all"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Contact */}
          <section className="clay-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="material-symbols-outlined text-[#a8cd62] text-2xl">contact_mail</span>
              <h2 className="text-xl font-extrabold tracking-tight">Contact</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[11px] uppercase tracking-widest font-extrabold text-[#6B7280] mb-1.5 ml-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-[#F0F2EA] rounded-2xl px-4 py-3.5 font-semibold text-stone-900 placeholder:text-[#6B7280] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#A8CD62] transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-widest font-extrabold text-[#6B7280] mb-1.5 ml-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+1 555 000 0000"
                  className="w-full bg-[#F0F2EA] rounded-2xl px-4 py-3.5 font-semibold text-stone-900 placeholder:text-[#6B7280] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#A8CD62] transition-all"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] uppercase tracking-widest font-extrabold text-[#6B7280] mb-1.5 ml-1">
                  LinkedIn Profile URL <span className="text-[#9CA3AF] font-semibold normal-case tracking-normal ml-2">Optional</span>
                </label>
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={e => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/your-handle"
                  className="w-full bg-[#F0F2EA] rounded-2xl px-4 py-3.5 font-semibold text-stone-900 placeholder:text-[#6B7280] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#A8CD62] transition-all"
                />
              </div>
            </div>
          </section>

          {/* Working */}
          <section className="clay-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="material-symbols-outlined text-[#a8cd62] text-2xl">work</span>
              <h2 className="text-xl font-extrabold tracking-tight">Working</h2>
            </div>
            <label className="block text-[11px] uppercase tracking-widest font-extrabold text-[#6B7280] mb-3">
              Work Location
            </label>
            <div className="flex gap-3">
              {(['Home', 'Office'] as const).map(loc => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLocation(loc)}
                  className={`px-6 py-3 rounded-full font-extrabold text-[13px] border-2 transition-all ${
                    location === loc
                      ? 'bg-[#A8CD62] text-stone-900 border-[#A8CD62] shadow-[0_6px_16px_rgba(168,205,98,0.3)]'
                      : 'bg-white text-stone-700 border-gray-200'
                  }`}
                >
                  {loc === 'Home' ? 'Work from Home' : 'Office'}
                </button>
              ))}
            </div>
            <div className="mt-6">
              <label className="block text-[11px] uppercase tracking-widest font-extrabold text-[#6B7280] mb-1.5 ml-1">
                Work Role
              </label>
              <input
                type="text"
                value={workRole}
                onChange={e => setWorkRole(e.target.value)}
                placeholder="e.g. Growth Strategist, Performance Marketer..."
                className="w-full bg-[#F0F2EA] rounded-2xl px-4 py-3.5 font-semibold text-stone-900 placeholder:text-[#6B7280] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#A8CD62] transition-all"
              />
            </div>
          </section>

          {/* Password & Security */}
          <section className="clay-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="material-symbols-outlined text-[#a8cd62] text-2xl">lock</span>
              <h2 className="text-xl font-extrabold tracking-tight">Password &amp; Security</h2>
            </div>
            <div className="space-y-5 mb-2">
              <PasswordField
                label="Current Password"
                value={pwdCur}
                onChange={setPwdCur}
                show={showCur}
                setShow={setShowCur}
                placeholder="Enter your current password"
                error={pwdCurErr}
              />
              <PasswordField
                label="New Password"
                value={pwdNew}
                onChange={setPwdNew}
                show={showNew}
                setShow={setShowNew}
                placeholder="Min. 6 characters"
                error={pwdNewErr}
              />
              <PasswordField
                label="Confirm New Password"
                value={pwdCfm}
                onChange={setPwdCfm}
                show={showCfm}
                setShow={setShowCfm}
                placeholder="Re-type new password"
                error={pwdCfmErr}
              />
            </div>
            <button
              type="button"
              onClick={openForgot}
              className="inline-block text-sm font-bold text-[#A8CD62] mt-3 hover:underline"
            >
              Forgot your current password?
            </button>
            <button
              type="button"
              onClick={handleUpdatePassword}
              disabled={updatingPwd}
              className="w-full mt-5 bg-[#A8CD62] text-[#131F00] font-extrabold text-sm uppercase tracking-wider px-6 py-4 rounded-2xl shadow-[0_8px_20px_rgba(168,205,98,0.3)] hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-55 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined">lock_reset</span> Update Password
            </button>
          </section>

          <div className="flex items-center justify-end pt-2">
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="bg-[#A8CD62] text-[#131F00] font-extrabold text-sm uppercase tracking-wider px-6 py-4 rounded-2xl shadow-[0_8px_20px_rgba(168,205,98,0.3)] hover:brightness-110 active:scale-[0.99] transition-all flex items-center gap-2 disabled:opacity-55 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined">save</span> Save Changes
            </button>
          </div>
        </div>
      </main>

      {/* Forgot Password Modal */}
      {fpOpen && (
        <div
          className="fixed inset-0 bg-black/45 z-[9998] flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) closeForgot(); }}
        >
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-extrabold tracking-tight">Reset Your Password</h3>
              <button
                type="button"
                onClick={closeForgot}
                className="p-2 hover:bg-gray-100 rounded-full"
                aria-label="Close"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {fpStep === 1 && (
              <div>
                <div className="w-16 h-16 mx-auto rounded-full bg-[#F0F2EA] flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-[#3C5600] text-3xl">forward_to_inbox</span>
                </div>
                <p className="text-center text-sm text-[#6B7280] mb-5">
                  Choose where you&apos;d like the verification code sent.
                </p>
                <div className="flex gap-3 mb-5">
                  <button
                    type="button"
                    onClick={() => setFpChannel('email')}
                    className={`flex-1 px-6 py-3 rounded-full font-extrabold text-[13px] border-2 transition-all ${
                      fpChannel === 'email'
                        ? 'bg-[#A8CD62] text-stone-900 border-[#A8CD62] shadow-[0_6px_16px_rgba(168,205,98,0.3)]'
                        : 'bg-white text-stone-700 border-gray-200'
                    }`}
                  >
                    Send to Email
                  </button>
                  <button
                    type="button"
                    disabled
                    title="SMS delivery coming soon"
                    className="flex-1 px-6 py-3 rounded-full font-extrabold text-[13px] border-2 border-gray-200 bg-white text-stone-400 cursor-not-allowed"
                  >
                    Send to Mobile
                  </button>
                </div>
                <div className="bg-[#F0F2EA] rounded-2xl p-4 mb-2 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280] mb-1">
                    Code will be sent to
                  </p>
                  <p className="text-base font-bold font-mono text-stone-900">{fpDestination}</p>
                </div>
                {fpStep1Err && (
                  <p className="text-xs font-bold text-[#EF4444] text-center mt-3 mb-3">{fpStep1Err}</p>
                )}
                <button
                  type="button"
                  onClick={sendOtp}
                  disabled={fpSending}
                  className="w-full mt-3 bg-[#A8CD62] text-[#131F00] font-extrabold text-sm uppercase tracking-wider px-6 py-4 rounded-2xl shadow-[0_8px_20px_rgba(168,205,98,0.3)] hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-55 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined">send</span> Send OTP
                </button>
              </div>
            )}

            {fpStep === 2 && (
              <div>
                <div className="w-16 h-16 mx-auto rounded-full bg-[#F0F2EA] flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-[#3C5600] text-3xl">mark_email_read</span>
                </div>
                <p className="text-center text-sm text-[#6B7280] mb-5">
                  Enter the 6-digit code we sent to{' '}
                  <span className="font-bold text-stone-900">{fpDestination}</span>.
                </p>
                <div className="flex gap-2 justify-center mb-3">
                  {fpOtp.map((v, i) => (
                    <input
                      key={i}
                      ref={el => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={v}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      onPaste={handleOtpPaste}
                      aria-label={`OTP digit ${i + 1}`}
                      className="w-11 h-[52px] text-center font-mono text-[22px] font-extrabold bg-[#F0F2EA] border-2 border-transparent rounded-xl text-stone-900 focus:outline-none focus:border-[#A8CD62] focus:bg-white"
                      placeholder="•"
                    />
                  ))}
                </div>
                {fpOtpErr && (
                  <p className="text-xs font-bold text-[#EF4444] text-center mb-2">{fpOtpErr}</p>
                )}
                <div className="flex items-center justify-between text-xs mb-4">
                  {fpResendSec > 0 ? (
                    <span className="text-[#6B7280] font-semibold">Resend OTP in {fpResendSec}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={sendOtp}
                      className="text-sm font-bold text-[#A8CD62] hover:underline"
                    >
                      Resend OTP
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={verifyOtp}
                  className="w-full bg-[#A8CD62] text-[#131F00] font-extrabold text-sm uppercase tracking-wider px-6 py-4 rounded-2xl shadow-[0_8px_20px_rgba(168,205,98,0.3)] hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined">check_circle</span> Verify OTP
                </button>
              </div>
            )}

            {fpStep === 3 && (
              <div>
                <div className="w-16 h-16 mx-auto rounded-full bg-[#F0F2EA] flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-[#3C5600] text-3xl">lock_reset</span>
                </div>
                <p className="text-center text-sm text-[#6B7280] mb-5">
                  Choose a new password for your account.
                </p>
                <div className="space-y-4 mb-2">
                  <div>
                    <label className="block text-[11px] uppercase tracking-widest font-extrabold text-[#6B7280] mb-1.5 ml-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={fpNew}
                      onChange={e => setFpNew(e.target.value)}
                      placeholder="Min. 6 characters"
                      className="w-full bg-[#F0F2EA] rounded-2xl px-4 py-3.5 font-semibold text-stone-900 placeholder:text-[#6B7280] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#A8CD62] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase tracking-widest font-extrabold text-[#6B7280] mb-1.5 ml-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={fpConfirm}
                      onChange={e => setFpConfirm(e.target.value)}
                      placeholder="Re-type new password"
                      className="w-full bg-[#F0F2EA] rounded-2xl px-4 py-3.5 font-semibold text-stone-900 placeholder:text-[#6B7280] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#A8CD62] transition-all"
                    />
                  </div>
                </div>
                {fpFinalErr && (
                  <p className="text-xs font-bold text-[#EF4444] text-center mt-2">{fpFinalErr}</p>
                )}
                <button
                  type="button"
                  onClick={submitNewPassword}
                  className="w-full mt-4 bg-[#A8CD62] text-[#131F00] font-extrabold text-sm uppercase tracking-wider px-6 py-4 rounded-2xl shadow-[0_8px_20px_rgba(168,205,98,0.3)] hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined">save</span> Update Password
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Password field subcomponent ──────────────────────────────────────────
interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  setShow: (v: boolean) => void;
  placeholder?: string;
  error?: string;
}

function PasswordField({ label, value, onChange, show, setShow, placeholder, error }: PasswordFieldProps) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-widest font-extrabold text-[#6B7280] mb-1.5 ml-1">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="new-password"
          className="w-full bg-[#F0F2EA] rounded-2xl pl-4 pr-12 py-3.5 font-semibold text-stone-900 placeholder:text-[#6B7280] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#A8CD62] transition-all"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg text-[#6B7280] hover:text-stone-900 hover:bg-gray-200 transition-colors"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          <span className="material-symbols-outlined text-[20px]">{show ? 'visibility_off' : 'visibility'}</span>
        </button>
      </div>
      {error && <p className="text-xs font-bold text-[#EF4444] mt-1.5 ml-1">{error}</p>}
    </div>
  );
}
