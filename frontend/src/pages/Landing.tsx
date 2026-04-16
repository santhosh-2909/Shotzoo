import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

const FEATURES = [
  { icon: 'task_alt',              title: 'Structured Task Logging', desc: 'Log every task with precision and clarity.' },
  { icon: 'timer',                 title: 'Attendance Tracking',     desc: 'Seamless check-ins and check-outs for your team.' },
  { icon: 'notifications_active',  title: 'Smart Notifications',     desc: 'Stay ahead of deadlines with real-time alerts.' },
  { icon: 'bar_chart',             title: 'Analytics Dashboard',     desc: 'Visualize team performance and project growth.' },
] as const;

export default function Landing() {
  const { token, isAdmin } = useAuth();
  const { setPortal } = useTheme();

  useEffect(() => { setPortal('auth'); }, [setPortal]);

  const dashboardHref = token ? (isAdmin ? '/admin/dashboard' : '/employee/dashboard') : '/signin';

  return (
    <div className="bg-surface text-on-surface font-body">

      {/* ── Navigation ──────────────────────────────────────────────── */}
      <header className="bg-white/70 backdrop-blur-xl sticky top-0 z-50 shadow-[0_40px_40px_rgba(21,28,39,0.06),0_4px_10px_rgba(21,28,39,0.04)]">
        <div className="flex justify-between items-center max-w-7xl mx-auto px-8 py-4">
          <div className="flex items-center gap-2">
            <img src="/company_logo.jpeg" alt="ShotZoo Logo" className="h-10 w-auto object-contain flex-shrink-0" />
            <div className="text-2xl font-extrabold tracking-tighter text-zinc-900 font-headline">ShotZoo</div>
          </div>
          <Link
            to={dashboardHref}
            className="bg-primary-container text-on-primary-container px-6 py-2.5 rounded-2xl font-bold transition-all hover:scale-[1.02] active:scale-95 duration-200 shadow-[0_10px_20px_rgba(21,28,39,0.08),inset_0_2px_2px_rgba(255,255,255,0.2)]"
          >
            {token ? 'Go to Dashboard' : 'Get Started'}
          </Link>
        </div>
      </header>

      <main>

        {/* ── Hero ────────────────────────────────────────────────────── */}
        <section className="flex flex-col items-center justify-center text-center px-6 bg-surface-container-lowest py-32">
          <div className="max-w-4xl mx-auto space-y-8">
            <h1 className="font-headline font-extrabold text-[56px] leading-[1.1] text-on-surface tracking-[-0.02em]">
              Manage Tasks. Track Time. <span className="text-primary">Grow Teams.</span>
            </h1>
            <p className="text-lg text-on-surface-variant max-w-2xl mx-auto font-body">
              The all-in-one workspace for teams to log tasks, track attendance, and hit every deadline.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              {token ? (
                <Link
                  to={dashboardHref}
                  className="bg-primary-container text-on-primary-container px-8 py-4 rounded-[14px] font-bold text-lg shadow-[0_10px_20px_rgba(21,28,39,0.08)] transition-transform hover:-translate-y-1 w-full sm:w-auto text-center flex items-center gap-2 justify-center"
                >
                  <span className="material-symbols-outlined text-[20px]">dashboard</span>
                  <span>Go to Dashboard</span>
                </Link>
              ) : (
                <>
                  <Link
                    to="/signin"
                    className="bg-primary-container text-on-primary-container px-8 py-4 rounded-[14px] font-bold text-lg shadow-[0_10px_20px_rgba(21,28,39,0.08)] transition-transform hover:-translate-y-1 w-full sm:w-auto text-center"
                  >
                    Employee Sign In
                  </Link>
                  <Link
                    to="/admin/signin"
                    className="bg-primary-container text-on-primary-container px-8 py-4 rounded-[14px] font-bold text-lg shadow-[0_10px_20px_rgba(21,28,39,0.08)] transition-transform hover:-translate-y-1 w-full sm:w-auto text-center"
                  >
                    Admin Sign In
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ── Features ────────────────────────────────────────────────── */}
        <section className="py-32 px-8 bg-surface">
          <div className="max-w-7xl mx-auto">
            <div className="mb-20">
              <h2 className="font-headline font-extrabold text-4xl text-on-surface tracking-[-0.02em]">
                Built for modern teams
              </h2>
              <div className="h-2 w-24 bg-primary-container mt-4 rounded-full" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {FEATURES.map(f => (
                <div
                  key={f.title}
                  className="bg-surface-container-lowest p-8 rounded-[20px] shadow-[0_40px_40px_rgba(21,28,39,0.06),0_4px_10px_rgba(21,28,39,0.04)] hover:-translate-y-2 transition-transform duration-300"
                >
                  <div className="w-14 h-14 bg-primary-container rounded-full flex items-center justify-center mb-6 text-on-primary-container">
                    <span className="material-symbols-outlined">{f.icon}</span>
                  </div>
                  <h3 className="font-headline font-extrabold text-xl mb-3 text-on-surface">{f.title}</h3>
                  <p className="text-on-surface-variant font-body">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Stats ───────────────────────────────────────────────────── */}
        <section className="py-24 bg-surface-container-low px-8">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-16 items-center">

            <div className="lg:w-1/2">
              <h2 className="font-headline font-extrabold text-[44px] leading-tight text-on-surface tracking-[-0.02em] mb-6">
                Real-time metrics for real-world growth.
              </h2>
              <p className="text-lg text-on-surface-variant mb-10">
                Stop guessing and start measuring. Our data-driven workspace provides granular insights into
                workforce efficiency without the overhead.
              </p>
              <div className="flex gap-12">
                <div>
                  <div className="font-headline font-extrabold text-4xl text-primary mb-1">98%</div>
                  <div className="text-sm font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Accuracy</div>
                </div>
                <div>
                  <div className="font-headline font-extrabold text-4xl text-primary mb-1">12k+</div>
                  <div className="text-sm font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Tasks Tracked</div>
                </div>
              </div>
            </div>

            <div className="lg:w-1/2 w-full">
              <div className="bg-surface-container-lowest p-12 rounded-[32px] shadow-[0_40px_40px_rgba(21,28,39,0.06),0_4px_10px_rgba(21,28,39,0.04)] relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 text-primary/10">
                  <span className="material-symbols-outlined text-[120px]">insights</span>
                </div>
                <div className="space-y-6 relative z-10">
                  <div className="bg-surface p-6 rounded-2xl shadow-[0_10px_20px_rgba(21,28,39,0.08)]">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-secondary-container rounded-full" />
                      <div>
                        <div className="font-bold text-on-surface">Weekly Attendance Report</div>
                        <div className="text-sm text-on-surface-variant">Generated 2m ago</div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-primary-container p-6 rounded-2xl shadow-[0_10px_20px_rgba(21,28,39,0.08)]">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-white">check</span>
                      </div>
                      <div>
                        <div className="font-bold text-on-primary-container">Development Phase Complete</div>
                        <div className="text-sm text-on-primary-container/80">Project: Alpha Redesign</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="bg-zinc-50 py-12">
        <div className="flex flex-col items-center gap-6 w-full px-8">
          <div className="flex items-center gap-2">
            <img src="/company_logo.jpeg" alt="ShotZoo Logo" className="h-7 w-auto object-contain" />
            <div className="text-xl font-extrabold tracking-tighter text-zinc-900 font-headline">ShotZoo</div>
          </div>
          <div className="flex gap-8">
            <a className="text-zinc-500 text-sm hover:text-zinc-900 transition-colors" href="/privacy">Privacy Policy</a>
            <a className="text-zinc-500 text-sm hover:text-zinc-900 transition-colors" href="/terms">Terms of Service</a>
            <a className="text-zinc-500 text-sm hover:text-zinc-900 transition-colors" href="/contact">Contact</a>
          </div>
          <div className="text-zinc-500 text-sm">© 2026 ShotZoo. All rights reserved.</div>
        </div>
      </footer>

    </div>
  );
}
