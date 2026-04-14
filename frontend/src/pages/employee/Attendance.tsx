import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { attendanceApi } from '@/utils/api';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- shape from API is dynamic
type AnyRecord = any;

function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function fmtTimeShort(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function sessionWorkingMs(session: AnyRecord): number {
  const end = session.checkOutTime ? new Date(session.checkOutTime) : new Date();
  let totalMs = end.getTime() - new Date(session.checkInTime).getTime();
  const breaks: { startTime: string; endTime?: string }[] = session.breaks || [];
  for (const b of breaks) {
    const bEnd = b.endTime ? new Date(b.endTime) : (session.checkOutTime ? new Date(session.checkOutTime) : new Date());
    totalMs -= bEnd.getTime() - new Date(b.startTime).getTime();
  }
  return Math.max(0, totalMs);
}

function totalWorkingMs(attendance: AnyRecord): number {
  if (!attendance?.sessions) return 0;
  return (attendance.sessions as AnyRecord[]).reduce((sum: number, s: AnyRecord) => sum + sessionWorkingMs(s), 0);
}

function isOnBreak(session: AnyRecord): boolean {
  if (!session?.breaks?.length) return false;
  return !session.breaks[session.breaks.length - 1].endTime;
}

function totalBreakMinutes(att: AnyRecord): number {
  if (!att?.sessions) return 0;
  let totalMs = 0;
  for (const s of att.sessions as AnyRecord[]) {
    for (const b of (s.breaks || []) as { startTime: string; endTime?: string }[]) {
      if (!b.startTime) continue;
      const end = b.endTime ? new Date(b.endTime) : new Date();
      totalMs += end.getTime() - new Date(b.startTime).getTime();
    }
  }
  return Math.max(0, Math.round(totalMs / 60000));
}

function fmtMinutes(mins: number): string {
  return mins + ' min' + (mins === 1 ? '' : 's');
}

function fmtTodayLong(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

interface AttendanceStats {
  daysPresent?: number;
  totalHours?: number;
  avgHoursPerDay?: number;
  streak?: number;
}

interface HistoryRecord {
  date: string;
  sessions: { checkInTime: string; checkOutTime?: string; breaks?: unknown[] }[];
  hoursWorked?: number;
  status?: string;
}

export default function Attendance() {
  const { setPortal } = useTheme();
  useEffect(() => { setPortal('employee'); }, [setPortal]);

  const [attendance, setAttendance] = useState<AnyRecord>(null);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [historyMonth, setHistoryMonth] = useState<Date>(() => { const d = new Date(); d.setDate(1); return d; });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [clock, setClock] = useState('');
  const [timerDisplay, setTimerDisplay] = useState('00:00:00');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startLiveTimer = useCallback((att: AnyRecord) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimerDisplay(formatDuration(totalWorkingMs(att)));
    }, 1000);
    setTimerDisplay(formatDuration(totalWorkingMs(att)));
  }, []);

  const updateUI = useCallback((att: AnyRecord) => {
    setAttendance(att);
    const sessions: AnyRecord[] = att?.sessions || [];
    const lastSession = sessions.length ? sessions[sessions.length - 1] : null;
    const openSession = lastSession && !lastSession.checkOutTime ? lastSession : null;
    if (openSession) {
      startLiveTimer(att);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setTimerDisplay(formatDuration(totalWorkingMs(att)));
    }
  }, [startLiveTimer]);

  useEffect(() => {
    attendanceApi.today()
      .then((data: AnyRecord) => updateUI(data.attendance))
      .catch(() => updateUI(null));

    attendanceApi.stats()
      .then((data: AnyRecord) => setStats(data.stats || {}))
      .catch(() => {});

    const tick = () => setClock(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    tick();
    clockRef.current = setInterval(tick, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (clockRef.current) clearInterval(clockRef.current);
    };
  }, [updateUI]);

  const loadHistory = useCallback(async (month: Date) => {
    setHistoryLoading(true);
    const monthStr = month.getFullYear() + '-' + String(month.getMonth() + 1).padStart(2, '0');
    try {
      const data = await attendanceApi.history(monthStr) as AnyRecord;
      setHistoryRecords(data.records || []);
    } catch {
      setHistoryRecords([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { loadHistory(historyMonth); }, [historyMonth, loadHistory]);

  const handleCheckIn = async () => {
    setError('');
    try {
      const data = await attendanceApi.checkIn() as AnyRecord;
      updateUI(data.attendance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check in.');
    }
  };

  const handleCheckOut = async () => {
    setError('');
    try {
      const data = await attendanceApi.checkOut() as AnyRecord;
      if (timerRef.current) clearInterval(timerRef.current);
      updateUI(data.attendance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check out.');
    }
  };

  const handleToggleBreak = async () => {
    setError('');
    try {
      const data = await attendanceApi.toggleBreak() as AnyRecord;
      updateUI(data.attendance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle break.');
    }
  };

  // Derived state
  const sessions: AnyRecord[] = attendance?.sessions || [];
  const firstSession: AnyRecord = sessions[0] || null;
  const lastSession: AnyRecord = sessions.length ? sessions[sessions.length - 1] : null;
  const openSession: AnyRecord = lastSession && !lastSession.checkOutTime ? lastSession : null;
  const openBreak: AnyRecord = openSession?.breaks
    ? (openSession.breaks as AnyRecord[]).find((b: AnyRecord) => !b.endTime)
    : null;

  let statusPillClass = 'px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider bg-stone-100 text-stone-500';
  let statusPillText = 'Not Checked In';
  if (openBreak) {
    statusPillClass = 'px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider bg-[#FEF3C7] text-[#92400E]';
    statusPillText = 'On Break';
  } else if (openSession) {
    statusPillClass = 'px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider bg-[#DCFCE7] text-[#166534]';
    statusPillText = 'Checked In';
  } else if (firstSession) {
    statusPillClass = 'px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider bg-[#F0F2EA] text-[#3C5600]';
    statusPillText = 'Checked Out';
  }

  // Last closed break message
  let lastBreakMsg = '';
  if (attendance?.sessions) {
    outer: for (let si = (attendance.sessions as AnyRecord[]).length - 1; si >= 0; si--) {
      const brks: AnyRecord[] = attendance.sessions[si].breaks || [];
      for (let bi = brks.length - 1; bi >= 0; bi--) {
        if (brks[bi].endTime) {
          const mins = Math.max(1, Math.round((new Date(brks[bi].endTime).getTime() - new Date(brks[bi].startTime).getTime()) / 60000));
          lastBreakMsg = 'Last break: ' + fmtMinutes(mins);
          break outer;
        }
      }
    }
  }

  const historyMonthLabel = historyMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const checkInDisabled = !!openSession;
  const checkOutDisabled = !openSession || !!openBreak;
  const breakBtnDisabled = !openSession;

  return (
    <div className="animate-fade-in">
      {/* TopAppBar */}
      <header className="flex items-center justify-end px-10 h-20 mb-8">
        <span className="text-sm font-bold font-mono text-primary tabular-nums">{clock}</span>
      </header>

      <div className="px-10 pb-12 space-y-10">
        {error && (
          <div className="px-5 py-3 rounded-2xl bg-error-container text-on-error-container font-semibold text-sm">
            {error}
          </div>
        )}

        {/* My Attendance Card */}
        <section className="bg-white rounded-[28px] p-8 clay-shadow">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary-container text-3xl">how_to_reg</span>
              <div>
                <h2 className="text-2xl font-extrabold tracking-tighter text-on-surface">My Attendance</h2>
                <p className="text-[#6B7280] text-sm font-medium">{fmtTodayLong()}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={statusPillClass}>{statusPillText}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-[#F0F2EA] rounded-2xl p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280] mb-2">Check In</p>
              <p className="text-2xl font-extrabold font-mono tracking-tight">{fmtTimeShort(firstSession?.checkInTime)}</p>
            </div>
            <div className="bg-[#F0F2EA] rounded-2xl p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280] mb-2">Check Out</p>
              <p className="text-2xl font-extrabold font-mono tracking-tight">
                {lastSession?.checkOutTime ? fmtTimeShort(lastSession.checkOutTime) : '—'}
              </p>
            </div>
            <div className="bg-[#F0F2EA] rounded-2xl p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280] mb-2">Hours Worked</p>
              <p className="text-2xl font-extrabold font-mono tracking-tight">
                {typeof attendance?.hoursWorked === 'number' ? (attendance.hoursWorked as number).toFixed(2) : '0.00'}
              </p>
            </div>
            <div className="bg-[#F0F2EA] rounded-2xl p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280] mb-2">Total Break</p>
              <p className="text-2xl font-extrabold font-mono tracking-tight">{fmtMinutes(totalBreakMinutes(attendance))}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={checkInDisabled}
              onClick={handleCheckIn}
              className="flex-1 min-w-[180px] bg-[#A8CD62] hover:brightness-110 active:scale-[0.99] transition-all text-[#131F00] font-extrabold text-sm uppercase tracking-wider px-8 h-[56px] rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-[#A8CD62]/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined">login</span> Check In
            </button>

            {!openBreak && (
              <button
                type="button"
                disabled={breakBtnDisabled}
                onClick={handleToggleBreak}
                className="flex-1 min-w-[180px] bg-white border-2 border-[#A8CD62] hover:bg-[#F0F2EA] active:scale-[0.99] transition-all text-[#3C5600] font-extrabold text-sm uppercase tracking-wider px-8 h-[56px] rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined">free_breakfast</span>
                <span>Log Break</span>
              </button>
            )}

            {openBreak && (
              <button
                type="button"
                onClick={handleToggleBreak}
                className="flex-1 min-w-[180px] bg-[#A8CD62] hover:brightness-110 active:scale-[0.99] transition-all text-[#131F00] font-extrabold text-sm uppercase tracking-wider px-8 h-[56px] rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-[#A8CD62]/30"
              >
                <span className="material-symbols-outlined">play_arrow</span> Resume
              </button>
            )}

            <button
              type="button"
              disabled={checkOutDisabled}
              onClick={handleCheckOut}
              className="flex-1 min-w-[180px] bg-[#2A313D] hover:brightness-110 active:scale-[0.99] transition-all text-white font-extrabold text-sm uppercase tracking-wider px-8 h-[56px] rounded-2xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined">logout</span> Check Out
            </button>
          </div>

          {lastBreakMsg && (
            <p className="mt-3 text-xs font-semibold text-[#6B7280]">{lastBreakMsg}</p>
          )}
        </section>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-surface-container-low p-8 rounded-[28px] clay-shadow border border-black/5 flex flex-col justify-between hover:bg-surface-container transition-colors h-64">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-on-surface-variant text-sm font-bold uppercase tracking-widest">Days Present</p>
                <h3 className="text-5xl font-headline font-bold text-on-surface mt-4">{stats?.daysPresent ?? '--'}</h3>
              </div>
              <div className="w-12 h-12 bg-surface-container-highest rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">history</span>
              </div>
            </div>
            <div className="text-on-surface-variant text-sm font-medium">This month</div>
          </div>

          <div className="bg-surface-container-low p-8 rounded-[28px] clay-shadow border border-black/5 flex flex-col justify-between hover:bg-surface-container transition-colors h-64">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-on-surface-variant text-sm font-bold uppercase tracking-widest">Total Hours</p>
                <h3 className="text-5xl font-headline font-bold text-on-surface mt-4">
                  {stats?.totalHours != null ? Math.floor(stats.totalHours) + 'h' : '--'}
                </h3>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">calendar_view_week</span>
              </div>
            </div>
            <div className="text-on-surface-variant text-sm font-medium">
              Average: {stats?.avgHoursPerDay != null ? stats.avgHoursPerDay.toFixed(1) + 'h/day' : '--'}
            </div>
          </div>

          <div className="bg-surface-container-low p-8 rounded-[28px] clay-shadow border border-black/5 flex flex-col justify-between hover:bg-surface-container transition-colors h-64">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-on-surface-variant text-sm font-bold uppercase tracking-widest">Streak</p>
                <h3 className="text-5xl font-headline font-bold text-on-surface mt-4">
                  {stats?.streak != null ? stats.streak + ' days' : '--'}
                </h3>
              </div>
              <div className="w-12 h-12 bg-primary-container/20 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-primary-container">emoji_events</span>
              </div>
            </div>
            <div className="text-on-surface-variant text-sm font-medium">Consecutive days</div>
          </div>
        </div>

        {/* Today's Sessions */}
        <div className="bg-surface-container-low rounded-[28px] p-8 clay-shadow border border-black/5">
          <h3 className="font-headline text-xl font-bold text-on-surface mb-6">Today's Sessions</h3>
          <div className="space-y-4">
            {sessions.length === 0 ? (
              <p className="text-on-surface-variant text-sm">No sessions yet today.</p>
            ) : (
              sessions.map((s: AnyRecord, idx: number) => {
                const inTime = formatTime(s.checkInTime as string);
                const dur = formatDuration(sessionWorkingMs(s));
                const breakCount = ((s.breaks as unknown[]) || []).length;
                const breakInfo = breakCount > 0 ? breakCount + ' break' + (breakCount > 1 ? 's' : '') : 'No breaks';
                let badge = <span className="px-3 py-1 rounded-full bg-surface-container-highest text-on-surface-variant text-xs font-bold">Completed</span>;
                if (!s.checkOutTime) {
                  badge = isOnBreak(s)
                    ? <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-bold">On Break</span>
                    : <span className="px-3 py-1 rounded-full bg-primary-container text-on-primary-container text-xs font-bold">Working</span>;
                }
                return (
                  <div key={idx} className="flex items-center justify-between p-4 bg-surface-container rounded-2xl">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center font-bold text-sm text-on-surface-variant">
                        #{idx + 1}
                      </div>
                      <div>
                        <p className="font-bold text-on-surface text-sm">
                          {inTime} &mdash;{' '}
                          {s.checkOutTime
                            ? formatTime(s.checkOutTime as string)
                            : <span className="text-primary font-bold">Active</span>
                          }
                        </p>
                        <p className="text-on-surface-variant text-xs mt-1">{dur} worked &middot; {breakInfo}</p>
                      </div>
                    </div>
                    {badge}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Attendance History */}
        <div className="bg-surface-container-low rounded-[28px] p-8 clay-shadow border border-black/5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-headline text-xl font-bold text-on-surface">Attendance History</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="p-2 rounded-xl hover:bg-surface-container-high transition-colors"
                onClick={() => {
                  const m = new Date(historyMonth);
                  m.setMonth(m.getMonth() - 1);
                  setHistoryMonth(m);
                }}
              >
                <span className="material-symbols-outlined text-on-surface-variant">chevron_left</span>
              </button>
              <span className="font-bold text-sm text-on-surface min-w-[120px] text-center">{historyMonthLabel}</span>
              <button
                type="button"
                className="p-2 rounded-xl hover:bg-surface-container-high transition-colors"
                onClick={() => {
                  const m = new Date(historyMonth);
                  m.setMonth(m.getMonth() + 1);
                  setHistoryMonth(m);
                }}
              >
                <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-high/30">
                  <th className="px-4 py-3 font-headline text-xs font-bold text-on-surface-variant">Date</th>
                  <th className="px-4 py-3 font-headline text-xs font-bold text-on-surface-variant">Check In</th>
                  <th className="px-4 py-3 font-headline text-xs font-bold text-on-surface-variant">Check Out</th>
                  <th className="px-4 py-3 font-headline text-xs font-bold text-on-surface-variant">Breaks</th>
                  <th className="px-4 py-3 font-headline text-xs font-bold text-on-surface-variant">Hours</th>
                  <th className="px-4 py-3 font-headline text-xs font-bold text-on-surface-variant">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {historyLoading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-on-surface-variant text-sm">Loading...</td></tr>
                ) : historyRecords.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-on-surface-variant text-sm">No records for this month</td></tr>
                ) : (
                  historyRecords.map((r, i) => {
                    const dateLabel = new Date(r.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                    const s = r.sessions || [];
                    const firstIn = s.length ? formatTime(s[0].checkInTime) : '--';
                    let lastOut = '--';
                    for (let j = s.length - 1; j >= 0; j--) {
                      if (s[j].checkOutTime) { lastOut = formatTime(s[j].checkOutTime!); break; }
                    }
                    const totalBreaks = s.reduce((sum, sess) => sum + ((sess.breaks || []).length), 0);
                    const hoursStr = (r.hoursWorked || 0).toFixed(1);
                    const statusClass = r.status === 'Present'
                      ? 'px-2 py-1 rounded-full text-xs font-bold bg-primary-container text-on-primary-container'
                      : r.status === 'Half-day'
                        ? 'px-2 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800'
                        : 'px-2 py-1 rounded-full text-xs font-bold bg-surface-container-high text-on-surface-variant';
                    return (
                      <tr key={i} className="hover:bg-black/[0.02]">
                        <td className="px-4 py-3 text-sm font-bold text-on-surface">{dateLabel}</td>
                        <td className="px-4 py-3 text-sm text-on-surface-variant">{firstIn}</td>
                        <td className="px-4 py-3 text-sm text-on-surface-variant">{lastOut}</td>
                        <td className="px-4 py-3 text-sm text-on-surface-variant">{totalBreaks}</td>
                        <td className="px-4 py-3 text-sm font-bold text-on-surface">{hoursStr}h</td>
                        <td className="px-4 py-3"><span className={statusClass}>{r.status}</span></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Consistency Streak */}
        <div className="bg-surface-container-low rounded-[28px] p-8 clay-shadow flex items-center justify-between border border-black/5">
          <div className="flex items-center gap-6">
            <div className="p-5 bg-surface-container-highest rounded-2xl">
              <span className="material-symbols-outlined text-primary text-4xl">emoji_events</span>
            </div>
            <div>
              <h4 className="text-2xl font-headline font-bold text-on-surface leading-tight">Consistency Streak</h4>
              <p className="text-on-surface-variant text-base mt-1">
                {stats?.streak
                  ? `You've maintained a ${stats.streak}-day streak. Keep it up!`
                  : 'Keep checking in daily to build your streak!'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden live timer span */}
      <span id="session-timer" className="sr-only">{timerDisplay}</span>
    </div>
  );
}
