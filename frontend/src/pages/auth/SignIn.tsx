import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { authApi } from '@/utils/api';
import type { AuthResponse } from '@/types';

export default function SignIn() {
  const navigate         = useNavigate();
  const { login, token, isAdmin } = useAuth();
  const { setPortal }    = useTheme();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => { setPortal('auth'); }, [setPortal]);

  useEffect(() => {
    if (token) navigate(isAdmin ? '/admin/attendance' : '/employee/attendance', { replace: true });
  }, [token, isAdmin, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter your email/ID and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await authApi.login(email.trim(), password) as AuthResponse;
      if (data.user.isAdmin) {
        setError('Please use the Admin portal');
        return;
      }
      login(data.user, data.token, data.user.isAdmin);
      navigate('/employee/attendance', { replace: true });
    } catch (err) {
      setError((err as Error).message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen w-full overflow-hidden bg-surface font-body text-on-surface animate-fade-in">
      {/* Left panel: Branding */}
      <section className="hidden md:flex md:w-1/2 bg-[#0d0f08] flex-col justify-between p-12 relative overflow-hidden">
        <div className="z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-container rounded-xl flex items-center justify-center">
              <img src="/company_logo.jpeg" alt="ShotZoo Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-3xl font-headline font-bold text-white tracking-tighter">ShotZoo</span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center relative">
          <div className="auth-clay-blob w-[400px] h-[400px] animate-pulse" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
            <span className="auth-logo-outline text-[120px] font-headline font-black text-white leading-none tracking-tighter">
              SZ
            </span>
            <div className="w-32 h-[2px] bg-gradient-to-r from-transparent via-white/40 to-transparent mt-2 mb-4" />
            <div className="text-3xl font-headline font-black text-white tracking-tighter">ShotZoo</div>
            <div className="text-[10px] font-bold text-white/50 uppercase tracking-[0.3em] mt-2">
              Jungle of Ad Creation
            </div>
          </div>
        </div>

        <div className="z-10">
          <h2 className="text-4xl md:text-5xl font-headline font-bold text-white tracking-tighter leading-none mb-4">
            Track your work.<br />
            <span className="text-primary-container">Own your time.</span>
          </h2>
          <p className="text-white/40 font-body text-lg max-w-xs">
            The sculpted workspace for high-performance workforce management.
          </p>
        </div>
      </section>

      {/* Right panel: Form */}
      <section className="w-full md:w-1/2 bg-on-surface flex flex-col items-center justify-center p-6 md:p-12 relative">
        <div className="w-full max-w-md">
          <div className="md:hidden flex items-center gap-2 mb-12">
            <span className="material-symbols-outlined ms-filled text-primary-container text-4xl">
              camera_enhance
            </span>
            <span className="text-2xl font-headline font-bold text-surface tracking-tighter">ShotZoo</span>
          </div>

          <header className="mb-10 text-left">
            <h1 className="text-4xl font-headline font-bold text-surface-container-lowest tracking-tight mb-2">
              Welcome Back
            </h1>
            <p className="text-surface-variant font-body font-medium">Sign in to your workspace</p>
          </header>

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 font-medium border border-red-100">
              {error}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="block text-sm font-bold text-surface-container-highest font-label" htmlFor="identity">
                Email or Employee ID
              </label>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-surface-variant group-focus-within:text-primary transition-colors">
                  person
                </span>
                <input
                  id="identity"
                  type="text"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-12 pr-4 py-4 bg-surface-container-high/10 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all font-body text-surface-container-lowest placeholder:text-surface-variant/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-surface-container-highest font-label" htmlFor="password">
                Password
              </label>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-surface-variant group-focus-within:text-primary transition-colors">
                  lock
                </span>
                <input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-4 bg-surface-container-high/10 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all font-body text-surface-container-lowest placeholder:text-surface-variant/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-variant hover:text-surface transition-colors"
                >
                  <span className="material-symbols-outlined">
                    {showPwd ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-bold text-surface-container-highest font-label">Remember me</span>
              <a href="#" className="text-sm font-bold text-primary-container hover:text-primary transition-colors font-label">
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-container text-on-primary-container font-headline font-bold py-5 rounded-2xl hover:-translate-y-1 transition-all active:scale-95 duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/admin/signin"
              className="text-sm font-bold text-primary-container hover:text-primary transition-colors font-label"
            >
              Admin? Sign in here →
            </Link>
          </div>
        </div>
      </section>

      <footer className="fixed bottom-0 left-0 w-full p-4 pointer-events-none hidden md:block">
        <div className="flex justify-between items-center text-[10px] text-white/20 uppercase tracking-[0.2em] font-bold px-8">
          <div>© 2026 ShotZoo.</div>
          <div className="flex gap-6 pointer-events-auto">
            <a href="#" className="hover:text-primary transition-colors">Support</a>
            <a href="#" className="hover:text-primary transition-colors">Privacy</a>
            <a href="#" className="hover:text-primary transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
