import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { tasksApi, attendanceApi } from '@/utils/api';
import type { Task, Attendance } from '@/types';

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

      {/* Upcoming Deadlines */}
      <section>
        <h2 className="font-headline text-2xl font-bold mb-6">Upcoming</h2>
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
      </section>
    </div>
  );
}
