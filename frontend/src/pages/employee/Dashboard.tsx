import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { tasksApi, attendanceApi, reportsApi } from '@/utils/api';
import { escapeHtml } from '@/utils/api';
import type { Task, Attendance, DailyReport } from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TaskStats {
  total: number;
  pending: number;
  completedToday: number;
  overdue: number;
}

interface WeekDay {
  letter: string;
  label: string;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  present: boolean;
}

interface EmployeeReportRow {
  user: { fullName: string; employeeId?: string };
  bod?: DailyReport;
  mod?: DailyReport;
  eod?: DailyReport;
  status: 'Completed' | 'Partial' | 'Not Submitted';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function greeting(name: string): string {
  const hour = new Date().getHours();
  const g = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return `${g}, ${name.split(' ')[0]} ☀️`;
}

function buildWeekDays(records: Attendance[]): WeekDay[] {
  const DAYS    = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const now = new Date();
  const dow = now.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const presentDates: Record<string, string> = {};
  records.forEach(r => {
    const d = new Date(r.date);
    presentDates[d.toDateString()] = r.status;
  });

  const days: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dayIdx  = d.getDay();
    const isToday = d.toDateString() === now.toDateString();
    const isPast  = d < now && !isToday;
    const isFuture = d > now && !isToday;
    days.push({
      letter:   LETTERS[dayIdx],
      label:    DAYS[dayIdx],
      isToday,
      isPast,
      isFuture,
      present:  !!presentDates[d.toDateString()],
    });
  }
  return days;
}

function truncate(str: string | undefined, len: number): string {
  if (!str) return '—';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color = 'text-primary' }: {
  icon: string; label: string; value: number; color?: string;
}) {
  return (
    <div className="bg-surface-container-highest/50 p-6 rounded-3xl hover:bg-surface-container-highest transition-colors flex flex-col gap-4">
      <span className={`material-symbols-outlined text-3xl ${color}`}>{icon}</span>
      <div>
        <h4 className="text-on-surface-variant text-sm font-bold uppercase tracking-wider">{label}</h4>
        <p className="font-headline text-4xl font-bold mt-1">{String(value).padStart(2, '0')}</p>
      </div>
    </div>
  );
}

function WeekDot({ day }: { day: WeekDay }) {
  const circleClass = day.present
    ? 'bg-primary-container text-on-primary-container'
    : day.isToday
    ? 'ring-2 ring-primary-container text-primary'
    : 'bg-surface-container-highest';
  const labelClass  = day.present ? 'text-on-surface-variant' : day.isToday ? 'text-primary' : '';
  const wrapClass   = !day.present && !day.isToday ? 'opacity-40' : '';

  return (
    <div className={`flex flex-col items-center gap-3 ${wrapClass}`}>
      <div className={`w-10 h-10 rounded-full ${circleClass} flex items-center justify-center font-bold text-xs`}>
        {day.letter}
      </div>
      <span className={`text-[10px] uppercase font-bold ${labelClass}`}>{day.label}</span>
    </div>
  );
}

const REPORT_STATUS_CLS: Record<string, string> = {
  Completed:     'bg-primary-container text-on-primary-container',
  Partial:       'bg-secondary-container text-on-secondary-container',
  'Not Submitted': 'bg-error-container text-on-error-container',
};

// ─── Main component ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, avatarUrl } = useAuth();

  // Stats
  const [stats,       setStats]       = useState<TaskStats>({ total: 0, pending: 0, completedToday: 0, overdue: 0 });
  // Attendance
  const [weekDays,    setWeekDays]    = useState<WeekDay[]>([]);
  const [weekMsg,     setWeekMsg]     = useState('Loading attendance data…');
  const [dayStarted,  setDayStarted]  = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  // Upcoming
  const [upcoming,    setUpcoming]    = useState<Task[]>([]);
  // Admin self-report
  const [bod,         setBod]         = useState('');
  const [mod,         setMod]         = useState('');
  const [eod,         setEod]         = useState('');
  const [reportStatus, setReportStatus] = useState<'Not Submitted' | 'Partial' | 'Completed'>('Not Submitted');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError,   setSaveError]   = useState('');
  // Employee reports table
  const [reportDate,  setReportDate]  = useState(new Date().toISOString().split('T')[0]);
  const [empReports,  setEmpReports]  = useState<EmployeeReportRow[]>([]);
  const [repFilter,   setRepFilter]   = useState<'All' | 'Completed' | 'Partial' | 'Not Submitted'>('All');
  const [repSearch,   setRepSearch]   = useState('');
  const [repLoading,  setRepLoading]  = useState(true);
  const [notifCount,  setNotifCount]  = useState(0);

  // ── Load task stats ────────────────────────────────────────────────────
  useEffect(() => {
    tasksApi.stats().then((d: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime shape unknown
      const s = (d as any)?.stats;
      if (s) setStats({ total: s.total ?? 0, pending: s.pending ?? 0, completedToday: s.completedToday ?? 0, overdue: s.overdue ?? 0 });
    }).catch(() => {});
  }, []);

  // ── Load upcoming deadlines ────────────────────────────────────────────
  useEffect(() => {
    tasksApi.upcoming().then((d: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime shape unknown
      const tasks = (d as any)?.tasks as Task[] | undefined;
      if (tasks) setUpcoming(tasks.slice(0, 4));
    }).catch(() => {});
  }, []);

  // ── Load attendance (week dots + today status) ─────────────────────────
  useEffect(() => {
    Promise.all([attendanceApi.history(), attendanceApi.today()]).then(([histData, todayData]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime shape unknown
      const records = ((histData as any)?.records ?? []) as Attendance[];
      const days = buildWeekDays(records);
      setWeekDays(days);

      const presentCount = days.filter(d => d.present).length;
      const pastDays     = days.filter(d => d.isPast || d.isToday).length;
      if (records.length === 0)         setWeekMsg('No attendance records yet. Start your day to begin tracking!');
      else if (pastDays === 0)           setWeekMsg('Your attendance week starts today!');
      else if (presentCount === pastDays) setWeekMsg('You\'ve maintained 100% attendance this week. Keep up the momentum!');
      else                               setWeekMsg(`${presentCount}/${pastDays} days attended this week.`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime shape unknown
      const att = (todayData as any)?.attendance as Attendance | undefined;
      if (att?.dayStarted) setDayStarted(true);
    }).catch(() => setWeekMsg('Unable to load attendance data.'));
  }, []);

  // ── Load notification badge count ─────────────────────────────────────
  useEffect(() => {
    import('@/utils/api').then(({ notifApi }) => {
      notifApi.list().then((d: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime shape unknown
        const n = (d as any)?.unreadCount as number | undefined;
        if (n) setNotifCount(n);
      }).catch(() => {});
    });
  }, []);

  // ── Load admin self-report ─────────────────────────────────────────────
  const loadAdminReport = useCallback((date?: string) => {
    reportsApi.today().then((d: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime shape unknown
      const reports = ((d as any)?.reports ?? []) as DailyReport[];
      const bodR = reports.find(r => r.type === 'BOD');
      const modR = reports.find(r => r.type === 'MOD');
      const eodR = reports.find(r => r.type === 'EOD');
      setBod(bodR ? bodR.description || bodR.title : '');
      setMod(modR ? modR.description || modR.title : '');
      setEod(eodR ? eodR.description || eodR.title : '');
      const count = [bodR, modR, eodR].filter(Boolean).length;
      setReportStatus(count === 3 ? 'Completed' : count > 0 ? 'Partial' : 'Not Submitted');
    }).catch(() => {});
    void date; // future: allow date param
  }, []);

  // ── Load employee reports table ────────────────────────────────────────
  const loadEmpReports = useCallback((date: string) => {
    setRepLoading(true);
    fetch('/api/daily-reports/all-today' + (date ? '?date=' + date : ''), {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('shotzoo_token') ?? '') },
      credentials: 'include',
    })
      .then(r => r.json())
      .then((d: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime shape unknown
        setEmpReports(((d as any)?.employees ?? []) as EmployeeReportRow[]);
      })
      .catch(() => setEmpReports([]))
      .finally(() => setRepLoading(false));
  }, []);

  useEffect(() => { loadAdminReport(); loadEmpReports(reportDate); }, [loadAdminReport, loadEmpReports, reportDate]);

  // ── Handlers ──────────────────────────────────────────────────────────
  async function handleStartDay() {
    setStartLoading(true);
    try {
      await attendanceApi.startDay();
      setDayStarted(true);
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('already')) setDayStarted(true);
    } finally {
      setStartLoading(false);
    }
  }

  async function handleSaveReport() {
    if (!bod.trim() && !mod.trim() && !eod.trim()) {
      setSaveError('Please fill in at least one report field.');
      return;
    }
    setSaveLoading(true);
    setSaveError('');
    const errors: string[] = [];
    const pairs: [string, string][] = [['BOD', bod], ['MOD', mod], ['EOD', eod]];
    for (const [type, text] of pairs) {
      if (!text.trim()) continue;
      try {
        await fetch('/api/daily-reports/submit', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + (localStorage.getItem('shotzoo_token') ?? ''),
          },
          credentials: 'include',
          body: JSON.stringify({ type, title: text.trim(), description: text.trim() }),
        });
      } catch (e) {
        errors.push(`${type}: ${(e as Error).message}`);
      }
    }
    setSaveLoading(false);
    if (errors.length) setSaveError(errors.join('\n'));
    else { loadAdminReport(); loadEmpReports(reportDate); }
  }

  // ── Derived ───────────────────────────────────────────────────────────
  const filteredReports = empReports.filter(e => {
    const matchFilter = repFilter === 'All' || e.status === repFilter;
    const matchSearch = !repSearch || e.user.fullName.toLowerCase().includes(repSearch.toLowerCase());
    return matchFilter && matchSearch;
  });

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="animate-fade-in">
      {/* Top App Bar */}
      <header className="flex items-center justify-between mb-12 h-20 px-4 w-full">
        <div className="flex-grow max-w-md">
          <div className="bg-surface-container-high rounded-full px-6 py-3 flex items-center gap-3 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
            <span className="material-symbols-outlined text-on-surface-variant">search</span>
            <input
              className="bg-transparent border-none focus:ring-0 text-on-surface w-full font-body placeholder:text-on-surface-variant"
              placeholder="Search tasks, docs…"
              type="text"
            />
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button type="button" className="text-on-surface-variant hover:text-on-surface transition-opacity">
            <span className="material-symbols-outlined">dark_mode</span>
          </button>
          <Link to="/employee/notifications" className="relative text-on-surface-variant hover:text-on-surface transition-opacity">
            <span className="material-symbols-outlined">notifications</span>
            {notifCount > 0 && (
              <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center">
                {notifCount > 99 ? '99+' : notifCount}
              </span>
            )}
          </Link>
          <Link to="/employee/profile" className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-surface-container-highest flex">
            <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
          </Link>
        </div>
      </header>

      {/* Section A: Welcome + Weekly Attendance */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        {/* Welcome card */}
        <div className="lg:col-span-2 bg-surface-container-low p-10 rounded-3xl clay-card relative overflow-hidden flex flex-col justify-between min-h-[300px]">
          <div className="relative z-10">
            <h1 className="font-headline text-5xl font-bold tracking-tighter mb-2">
              {greeting(user?.fullName ?? 'there')}
            </h1>
            <p className="text-on-surface-variant font-medium text-lg">{currentDate}</p>
          </div>
          <div className="relative z-10 mt-8">
            <button
              type="button"
              onClick={handleStartDay}
              disabled={dayStarted || startLoading}
              className="bg-primary-container text-on-primary-container px-10 py-5 rounded-2xl font-bold text-xl clay-button hover:translate-y-[-2px] transition-all active:scale-95 flex items-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className={`material-symbols-outlined ${dayStarted ? 'material-symbols-filled' : ''}`}>
                {dayStarted ? 'check_circle' : 'play_circle'}
              </span>
              {startLoading ? 'Starting…' : dayStarted ? 'Day Started!' : 'Start My Day'}
            </button>
          </div>
          <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-primary/10 rounded-full blur-[100px]" />
        </div>

        {/* Weekly attendance */}
        <div className="bg-surface-container-low p-8 rounded-3xl clay-card flex flex-col gap-6">
          <h3 className="font-headline text-xl font-bold tracking-tight">Weekly Attendance</h3>
          <div className="flex justify-between items-center px-2">
            {weekDays.map((d, i) => <WeekDot key={i} day={d} />)}
          </div>
          <div className="mt-auto pt-6 border-t border-black/5">
            <p className="text-sm text-on-surface-variant leading-relaxed">{weekMsg}</p>
          </div>
        </div>
      </section>

      {/* Section B: Stats cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
        <StatCard icon="task_alt"     label="Total Tasks"       value={stats.total}          />
        <StatCard icon="pending_actions" label="Pending"         value={stats.pending}        color="text-tertiary" />
        <StatCard icon="verified"     label="Completed Today"   value={stats.completedToday} />
        <StatCard icon="error_outline" label="Overdue"          value={stats.overdue}        color="text-error" />
      </section>

      {/* Main content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        {/* Section C: Reports */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-2xl font-bold">Report</h2>
            <input
              id="report-date"
              type="date"
              title="Select report date"
              value={reportDate}
              onChange={e => { setReportDate(e.target.value); loadEmpReports(e.target.value); }}
              className="bg-surface-container-high rounded-2xl px-4 py-2 text-sm font-body text-on-surface border-0 focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>

          {/* Admin self-report */}
          <div className="bg-surface-container-lowest rounded-3xl clay-card p-8 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h3 className="font-headline text-lg font-bold tracking-tight">My Daily Report</h3>
              <span className={`text-xs font-bold uppercase tracking-wider ${
                reportStatus === 'Completed' ? 'text-primary' :
                reportStatus === 'Partial' ? 'text-secondary' :
                'text-on-surface-variant'
              }`}>
                {reportStatus}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {([
                { id: 'bod', type: 'BOD', icon: 'wb_twilight', time: '9:00 AM – 1:00 PM', value: bod, setter: setBod, placeholder: 'What did you work on this morning?' },
                { id: 'mod', type: 'MOD', icon: 'light_mode',  time: '2:00 PM – 6:00 PM', value: mod, setter: setMod, placeholder: 'What did you work on this afternoon?' },
                { id: 'eod', type: 'EOD', icon: 'nightlight',  time: 'After 6:00 PM',     value: eod, setter: setEod, placeholder: 'What did you accomplish today?' },
              ] as const).map(({ id, type, icon, time, value, setter, placeholder }) => (
                <div key={id} className="bg-surface-container-highest/50 p-5 rounded-3xl flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-2xl">{icon}</span>
                    <div>
                      <h4 className="text-on-surface-variant text-xs font-bold uppercase tracking-wider">{type}</h4>
                      <p className="text-on-surface-variant text-xs">{time}</p>
                    </div>
                  </div>
                  <textarea
                    rows={3}
                    placeholder={placeholder}
                    value={value}
                    onChange={e => setter(e.target.value)}
                    className="bg-surface-container-high rounded-2xl px-4 py-3 w-full resize-none text-on-surface text-sm font-body border-0 focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-on-surface-variant/60"
                  />
                </div>
              ))}
            </div>
            {saveError && <p className="text-sm text-error">{saveError}</p>}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveReport}
                disabled={saveLoading}
                className="bg-primary-container text-on-primary-container px-8 py-3 rounded-2xl font-bold text-sm clay-button hover:translate-y-[-1px] transition-all active:scale-95 flex items-center gap-2 disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-base">save</span>
                {saveLoading ? 'Saving…' : reportStatus !== 'Not Submitted' ? 'Update Report' : 'Submit Report'}
              </button>
            </div>
          </div>

          {/* Employee reports table */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-grow max-w-xs bg-surface-container-high rounded-full px-4 py-2.5 flex items-center gap-2">
                <span className="material-symbols-outlined text-on-surface-variant text-base">search</span>
                <input
                  type="text"
                  placeholder="Search employee…"
                  value={repSearch}
                  onChange={e => setRepSearch(e.target.value)}
                  className="bg-transparent border-none focus:ring-0 text-on-surface text-sm w-full font-body placeholder:text-on-surface-variant outline-none"
                />
              </div>
              <div className="flex gap-2">
                {(['All', 'Completed', 'Partial', 'Not Submitted'] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setRepFilter(f)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${
                      repFilter === f
                        ? 'bg-primary-container text-on-primary-container'
                        : 'bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-highest'
                    }`}
                  >
                    {f === 'Not Submitted' ? 'Pending' : f}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-surface-container-lowest rounded-3xl overflow-hidden clay-card">
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-surface-container-highest/30">
                      {['Employee', 'BOD', 'MOD', 'EOD', 'Status'].map((h, i) => (
                        <th key={h} className={`px-6 py-5 font-headline text-sm font-bold text-on-surface-variant${i === 4 ? ' text-right' : ''}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {repLoading ? (
                      <tr><td colSpan={5} className="px-6 py-12 text-center text-on-surface-variant text-sm">Loading…</td></tr>
                    ) : filteredReports.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-12 text-center text-on-surface-variant text-sm">No reports found.</td></tr>
                    ) : filteredReports.map((e, i) => (
                      <tr key={i} className={`border-t border-black/5 hover:bg-black/[0.03] transition-colors ${e.status === 'Not Submitted' ? 'bg-error-container/20' : ''}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-xs font-bold text-primary">
                              {(e.user.fullName || '?')[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-sm">{escapeHtml(e.user.fullName)}</p>
                              <p className="text-xs text-on-surface-variant">{escapeHtml(e.user.employeeId ?? '')}</p>
                            </div>
                          </div>
                        </td>
                        {(['bod', 'mod', 'eod'] as const).map(key => (
                          <td key={key} className="px-6 py-4">
                            <span className="text-sm font-medium" title={e[key]?.title ?? ''}>
                              {truncate(e[key]?.title, 28)}
                            </span>
                          </td>
                        ))}
                        <td className="px-6 py-4 text-right">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ring-1 ring-black/10 ${REPORT_STATUS_CLS[e.status] ?? ''}`}>
                            {e.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Section D: Upcoming Deadlines */}
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-6">
            <h2 className="font-headline text-2xl font-bold">Upcoming</h2>
            <div className="flex flex-col gap-4 relative before:absolute before:left-4 before:top-4 before:bottom-4 before:w-[2px] before:bg-black/5">
              {upcoming.length === 0 ? (
                <p className="text-on-surface-variant text-sm pl-12">No upcoming deadlines</p>
              ) : upcoming.map((task, i) => {
                const opacity = i === 0 ? '' : i === 1 ? 'opacity-60' : 'opacity-40';
                const dotBg   = i === 0 ? 'bg-primary' : 'bg-on-surface-variant/20';
                const dl = task.deadline
                  ? new Date(task.deadline).toLocaleDateString('en-US', { weekday: 'long', hour: '2-digit', minute: '2-digit' })
                  : '';
                return (
                  <div key={task._id} className={`relative pl-12 ${opacity}`}>
                    <div className={`absolute left-[13px] top-1 w-2.5 h-2.5 rounded-full ${dotBg} ring-4 ring-background`} />
                    <h4 className="font-bold text-sm">{task.title}</h4>
                    <p className="text-xs text-on-surface-variant mt-1">{dl}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
