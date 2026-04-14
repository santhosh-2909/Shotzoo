import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { profileApi, uploadUrl } from '@/utils/api';

interface ProfileData {
  fullName?:     string;
  employeeId?:   string;
  joiningDate?:  string;
  gender?:       string;
  dateOfBirth?:  string;
  email?:        string;
  phone?:        string;
  linkedinUrl?:  string;
  workRole?:     string;
  employeeType?: string;
  role?:         string;
  photo?:        string;
  bio?:          string;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

function orDash(s?: string): string {
  return s?.trim() ? s : '—';
}

export default function Profile() {
  const { setPortal } = useTheme();
  useEffect(() => { setPortal('employee'); }, [setPortal]);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  // Password change state
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew,     setPwdNew]     = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [showCur,    setShowCur]    = useState(false);
  const [showNew,    setShowNew]    = useState(false);
  const [showCfm,    setShowCfm]    = useState(false);
  const [pwdCurErr,  setPwdCurErr]  = useState('');
  const [pwdNewErr,  setPwdNewErr]  = useState('');
  const [pwdCfmErr,  setPwdCfmErr]  = useState('');
  const [pwdSaving,  setPwdSaving]  = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState('');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API response
      const data = await profileApi.get() as any;
      setProfile((data.user || {}) as ProfileData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleUpdatePassword = async () => {
    setPwdCurErr(''); setPwdNewErr(''); setPwdCfmErr(''); setPwdSuccess('');

    if (!pwdCurrent)         { setPwdCurErr('Enter your current password'); return; }
    if (!pwdNew)             { setPwdNewErr('Enter a new password'); return; }
    if (pwdNew.length < 6)   { setPwdNewErr('Password must be at least 6 characters'); return; }
    if (pwdNew !== pwdConfirm){ setPwdCfmErr('Passwords do not match'); return; }

    setPwdSaving(true);
    try {
      await profileApi.changePassword({
        currentPassword: pwdCurrent,
        newPassword:     pwdNew,
        confirmPassword: pwdConfirm,
      });
      setPwdCurrent(''); setPwdNew(''); setPwdConfirm('');
      setPwdSuccess('Password updated successfully');
      setTimeout(() => setPwdSuccess(''), 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update password';
      if (/current password/i.test(msg))  setPwdCurErr('Incorrect current password');
      else if (/do not match/i.test(msg)) setPwdCfmErr('Passwords do not match');
      else                                 setPwdCfmErr(msg);
    } finally {
      setPwdSaving(false);
    }
  };

  const initials = (profile?.fullName || 'U').trim().charAt(0).toUpperCase() || 'U';
  const photoUrl = profile?.photo ? uploadUrl(profile.photo) : '';

  return (
    <div className="animate-fade-in">
      <div className="flex-1 p-8 lg:p-12 max-w-5xl">
        <header className="mb-10">
          <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-surface">My Profile</h1>
          <p className="text-[#6B7280] mt-2 font-medium">View your personal details, contact info, and work information.</p>
        </header>

        {error && (
          <div className="mb-6 px-5 py-3 rounded-2xl bg-error-container text-on-error-container font-semibold text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="clay-card p-12 text-center text-on-surface-variant font-semibold">
            Loading profile…
          </div>
        ) : (
          <div className="space-y-8">
            {/* ── Personal Information ───────────────────────────────────── */}
            <section className="clay-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="material-symbols-outlined text-primary-container text-2xl">badge</span>
                <h2 className="text-xl font-headline font-extrabold tracking-tight">Personal Information</h2>
              </div>

              <div className="flex flex-col md:flex-row gap-8 items-start">
                {/* Photo */}
                <div className="flex flex-col items-center gap-3">
                  <div className="photo-upload pointer-events-none">
                    {photoUrl
                      ? <img src={photoUrl} alt={profile?.fullName ?? 'User'} className="w-full h-full object-cover" />
                      : <span>{initials}</span>
                    }
                  </div>
                  {profile?.employeeId && (
                    <span className="text-[11px] font-bold tracking-widest text-[#6B7280] font-mono">
                      {profile.employeeId}
                    </span>
                  )}
                </div>

                {/* Fields */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
                  <ReadField className="md:col-span-2" label="Full Name"    value={orDash(profile?.fullName)} />
                  <ReadField label="Joining Date"   value={formatDate(profile?.joiningDate)} />
                  <ReadField label="Gender"         value={orDash(profile?.gender)} />
                  <ReadField label="Date of Birth"  value={formatDate(profile?.dateOfBirth)} />
                  <ReadField label="Role"           value={orDash(profile?.role)} />
                </div>
              </div>
            </section>

            {/* ── Contact ────────────────────────────────────────────────── */}
            <section className="clay-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="material-symbols-outlined text-primary-container text-2xl">contact_mail</span>
                <h2 className="text-xl font-headline font-extrabold tracking-tight">Contact</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <ReadField label="Email Address" value={orDash(profile?.email)} />
                <ReadField label="Mobile Number" value={orDash(profile?.phone)} />
                <ReadField
                  className="md:col-span-2"
                  label="LinkedIn Profile"
                  value={orDash(profile?.linkedinUrl)}
                  link={profile?.linkedinUrl}
                />
              </div>
            </section>

            {/* ── Working ────────────────────────────────────────────────── */}
            <section className="clay-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="material-symbols-outlined text-primary-container text-2xl">work</span>
                <h2 className="text-xl font-headline font-extrabold tracking-tight">Working</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <span className="field-label">Work Location</span>
                  <div className="mt-2">
                    {profile?.employeeType
                      ? <span className="pill active inline-block">{profile.employeeType === 'Home' ? 'Work from Home' : 'Office'}</span>
                      : <span className="text-[#6B7280] text-sm font-semibold">—</span>
                    }
                  </div>
                </div>
                <ReadField label="Work Role" value={orDash(profile?.workRole)} />
                {profile?.bio && (
                  <ReadField className="md:col-span-2" label="Bio" value={profile.bio} multiline />
                )}
              </div>
            </section>

            {/* ── Password & Security ────────────────────────────────────── */}
            <section className="clay-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="material-symbols-outlined text-primary-container text-2xl">lock</span>
                <h2 className="text-xl font-headline font-extrabold tracking-tight">Password &amp; Security</h2>
              </div>

              {pwdSuccess && (
                <div className="mb-5 px-4 py-3 rounded-xl bg-[#DCFCE7] text-[#166534] font-semibold text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  {pwdSuccess}
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label htmlFor="emp-pwd-current" className="field-label">Current Password</label>
                  <div className="pwd-wrap">
                    <input
                      id="emp-pwd-current"
                      type={showCur ? 'text' : 'password'}
                      className="field-input"
                      placeholder="Enter your current password"
                      autoComplete="current-password"
                      value={pwdCurrent}
                      onChange={e => { setPwdCurrent(e.target.value); if (pwdCurErr) setPwdCurErr(''); }}
                    />
                    <button
                      type="button"
                      className="pwd-eye"
                      onClick={() => setShowCur(v => !v)}
                      aria-label={showCur ? 'Hide password' : 'Show password'}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {showCur ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                  {pwdCurErr && <p className="pwd-error show">{pwdCurErr}</p>}
                </div>

                <div>
                  <label htmlFor="emp-pwd-new" className="field-label">New Password</label>
                  <div className="pwd-wrap">
                    <input
                      id="emp-pwd-new"
                      type={showNew ? 'text' : 'password'}
                      className="field-input"
                      placeholder="Minimum 6 characters"
                      autoComplete="new-password"
                      value={pwdNew}
                      onChange={e => { setPwdNew(e.target.value); if (pwdNewErr) setPwdNewErr(''); }}
                    />
                    <button
                      type="button"
                      className="pwd-eye"
                      onClick={() => setShowNew(v => !v)}
                      aria-label={showNew ? 'Hide password' : 'Show password'}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {showNew ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                  {pwdNewErr && <p className="pwd-error show">{pwdNewErr}</p>}
                </div>

                <div>
                  <label htmlFor="emp-pwd-confirm" className="field-label">Confirm New Password</label>
                  <div className="pwd-wrap">
                    <input
                      id="emp-pwd-confirm"
                      type={showCfm ? 'text' : 'password'}
                      className="field-input"
                      placeholder="Re-type new password"
                      autoComplete="new-password"
                      value={pwdConfirm}
                      onChange={e => { setPwdConfirm(e.target.value); if (pwdCfmErr) setPwdCfmErr(''); }}
                    />
                    <button
                      type="button"
                      className="pwd-eye"
                      onClick={() => setShowCfm(v => !v)}
                      aria-label={showCfm ? 'Hide password' : 'Show password'}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {showCfm ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                  {pwdCfmErr && <p className="pwd-error show">{pwdCfmErr}</p>}
                </div>
              </div>

              <button
                type="button"
                disabled={pwdSaving}
                onClick={handleUpdatePassword}
                className="primary-btn w-full mt-6 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">
                  {pwdSaving ? 'progress_activity' : 'lock_reset'}
                </span>
                {pwdSaving ? 'Updating…' : 'Update Password'}
              </button>
            </section>

            <p className="text-center text-xs text-[#6B7280] font-semibold pt-2">
              Personal and work details are read-only. Contact an administrator to update them.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Read-only field display ─────────────────────────────────────────────

interface ReadFieldProps {
  label:      string;
  value:      string;
  link?:      string;
  className?: string;
  multiline?: boolean;
}

function ReadField({ label, value, link, className = '', multiline = false }: Readonly<ReadFieldProps>) {
  const isLink  = link && value !== '—';
  const content = isLink
    ? <a href={link} target="_blank" rel="noopener noreferrer" className="text-primary-container hover:underline">{value}</a>
    : value;

  return (
    <div className={className}>
      <span className="field-label">{label}</span>
      <div
        className={
          'mt-1 w-full rounded-2xl bg-[#F0F2EA] px-5 py-3.5 text-sm font-semibold text-[#111827] ' +
          (multiline ? 'whitespace-pre-wrap min-h-[80px]' : '')
        }
      >
        {content}
      </div>
    </div>
  );
}
