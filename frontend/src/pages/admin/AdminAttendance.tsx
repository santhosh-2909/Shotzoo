import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { useTheme } from '@/contexts/ThemeContext';
import { adminApi, attendanceApi } from '@/utils/api';
import type { Attendance, AttendanceBreak, AttendanceSession, User } from '@/types';

// ─── Row type for team table ──────────────────────────────────────────────
interface TeamRow {
  userId: string;
  name: string;
  employeeId: string;
  role: string;
  checkIn: string | null;
  checkOut: string | null;
  checkInDisplay: string;
  checkOutDisplay: string;
  hours: number;
  status: 'Present' | 'Late' | 'Absent';
}

type TeamStatus = TeamRow['status'];

// ─── Helpers ──────────────────────────────────────────────────────────────
function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function fmtTodayLong(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function isoDateToday(): string {
  const d = new Date();
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

function totalBreakMinutes(att: Attendance | null): number {
  if (!att?.sessions) return 0;
  let totalMs = 0;
  for (const s of att.sessions) {
    if (!s.breaks) continue;
    for (const b of s.breaks) {
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

function classifyStatus(rec: Attendance | null): TeamStatus {
  if (!rec?.sessions?.length) return 'Absent';
  const first = rec.sessions[0];
  if (!first.checkInTime) return 'Absent';
  const d = new Date(first.checkInTime);
  const minutes = d.getHours() * 60 + d.getMinutes();
  if (minutes > 9 * 60 + 30) return 'Late';
  return 'Present';
}

interface AttendanceTodayResponse { success: boolean; attendance: Attendance | null; message?: string }
interface AdminAttendanceResponse { success: boolean; records: Attendance[]; message?: string }
interface EmployeesResponse { success: boolean; employees: User[]; message?: string }

export default function AdminAttendance() {
  const { setPortal } = useTheme();
  useEffect(() => { setPortal('admin'); }, [setPortal]);

  // ─── State ────────────────────────────────────────────────────────────
  const [myAtt, setMyAtt] = useState<Attendance | null>(null);
  const [teamRows, setTeamRows] = useState<TeamRow[]>([]);
  const [teamDate, setTeamDate] = useState(isoDateToday());
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamError, setTeamError] = useState('');
  const [busyIn, setBusyIn] = useState(false);
  const [busyOut, setBusyOut] = useState(false);
  const [busyBreak, setBusyBreak] = useState(false);
  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  }, []);

  // ─── Derived: my state ────────────────────────────────────────────────
  const firstSession: AttendanceSession | null = myAtt?.sessions?.[0] ?? null;
  const lastSession: AttendanceSession | null =
    myAtt?.sessions?.[myAtt.sessions.length - 1] ?? null;
  const openSession = lastSession && !lastSession.checkOutTime ? lastSession : null;
  const openBreak: AttendanceBreak | null =
    openSession?.breaks?.find(b => !b.endTime) ?? null;

  let pillText = 'Not Checked In';
  let pillClass = 'bg-stone-100 text-stone-500';
  if (openBreak) {
    pillText = 'On Break';
    pillClass = 'bg-[#FEF3C7] text-[#92400E]';
  } else if (openSession) {
    pillText = 'Checked In';
    pillClass = 'bg-[#DCFCE7] text-[#166534]';
  } else if (firstSession) {
    pillText = 'Checked Out';
    pillClass = 'bg-[#F0F2EA] text-[#3C5600]';
  }

  // Break button label
  let breakLabel = 'Log Break';
  if (openBreak) breakLabel = 'On Break since ' + fmtTime(openBreak.startTime);

  const disableCheckIn = !!openSession;
  const disableCheckOut = !openSession || !!openBreak;
  const disableBreak = !openSession;
  const showResume = !!openBreak;

  // Last completed break summary
  let lastBreakLine = '';
  if (myAtt?.sessions) {
    let lastClosed: AttendanceBreak | null = null;
    for (let si = myAtt.sessions.length - 1; si >= 0 && !lastClosed; si--) {
      const brks = myAtt.sessions[si].breaks || [];
      for (let bi = brks.length - 1; bi >= 0; bi--) {
        if (brks[bi].endTime) { lastClosed = brks[bi]; break; }
      }
    }
    if (lastClosed?.endTime) {
      const mins = Math.max(
        1,
        Math.round((new Date(lastClosed.endTime).getTime() - new Date(lastClosed.startTime).getTime()) / 60000),
      );
      lastBreakLine = 'Last break: ' + fmtMinutes(mins);
    }
  }

  // ─── Loaders ──────────────────────────────────────────────────────────
  const loadMy = useCallback(() => {
    (attendanceApi.today() as Promise<AttendanceTodayResponse>)
      .then(d => {
        if (d.success) setMyAtt(d.attendance);
        else setMyAtt(null);
      })
      .catch(() => setMyAtt(null));
  }, []);

  const loadTeam = useCallback((date: string) => {
    setTeamLoading(true);
    setTeamError('');
    Promise.all([
      adminApi.attendance(date) as Promise<AdminAttendanceResponse>,
      adminApi.employees() as Promise<EmployeesResponse>,
    ])
      .then(([attRes, empRes]) => {
        if (!empRes.success) {
          setTeamError('Failed to load employees');
          setTeamRows([]);
          return;
        }
        const byId: Record<string, Attendance> = {};
        (attRes.records || []).forEach(rec => {
          const u = rec.user;
          const uid = typeof u === 'object' ? u?._id : u;
          if (uid) byId[uid] = rec;
        });

        const rows: TeamRow[] = (empRes.employees || []).map(emp => {
          const rec = byId[emp._id] || null;
          const first = rec?.sessions?.[0] ?? null;
          const last = rec?.sessions?.[rec.sessions.length - 1] ?? null;
          return {
            userId: emp._id,
            name: emp.fullName || '—',
            employeeId: emp.employeeId || '',
            role: emp.role || 'Employee',
            checkIn: first?.checkInTime ?? null,
            checkOut: last?.checkOutTime ?? null,
            checkInDisplay: first ? fmtTime(first.checkInTime) : '—',
            checkOutDisplay: last?.checkOutTime ? fmtTime(last.checkOutTime) : '—',
            hours: typeof rec?.hoursWorked === 'number' ? rec.hoursWorked : 0,
            status: classifyStatus(rec),
          };
        });

        rows.sort((a, b) => {
          if (!a.checkIn && !b.checkIn) return a.name.localeCompare(b.name);
          if (!a.checkIn) return 1;
          if (!b.checkIn) return -1;
          return new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime();
        });

        setTeamRows(rows);
      })
      .catch(() => {
        setTeamError('Failed to load attendance.');
        setTeamRows([]);
      })
      .finally(() => setTeamLoading(false));
  }, []);

  useEffect(() => { loadMy(); }, [loadMy]);
  useEffect(() => { loadTeam(teamDate); }, [loadTeam, teamDate]);

  // ─── Actions ──────────────────────────────────────────────────────────
  async function handleCheckIn() {
    setBusyIn(true);
    try {
      const d = await (attendanceApi.checkIn() as Promise<AttendanceTodayResponse>);
      if (!d.success) { showToast(d.message || 'Check-in failed'); return; }
      setMyAtt(d.attendance);
      showToast('Checked in successfully');
      loadTeam(teamDate);
    } catch {
      showToast('Network error');
    } finally { setBusyIn(false); }
  }

  async function handleCheckOut() {
    setBusyOut(true);
    try {
      const d = await (attendanceApi.checkOut() as Promise<AttendanceTodayResponse>);
      if (!d.success) { showToast(d.message || 'Check-out failed'); return; }
      setMyAtt(d.attendance);
      showToast('Checked out successfully');
      loadTeam(teamDate);
    } catch {
      showToast('Network error');
    } finally { setBusyOut(false); }
  }

  async function handleToggleBreak(label: string) {
    setBusyBreak(true);
    try {
      const d = await (attendanceApi.toggleBreak() as Promise<AttendanceTodayResponse>);
      if (!d.success) { showToast(d.message || (label + ' failed')); return; }
      setMyAtt(d.attendance);
      showToast(label);
    } catch {
      showToast('Network error');
    } finally { setBusyBreak(false); }
  }

  // ─── Export ───────────────────────────────────────────────────────────
  function exportXlsx() {
    if (!teamRows.length) { showToast('No data to export'); return; }
    const headers = ['Employee Name', 'Employee ID', 'Check In', 'Check Out', 'Hours Worked', 'Status'];
    const rows = teamRows.map(r => [
      r.name,
      r.employeeId,
      r.checkInDisplay,
      r.checkOutDisplay,
      Number(r.hours.toFixed(2)),
      r.status,
    ]);
    const aoa = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    XLSX.writeFile(wb, 'shotzoo-attendance-' + teamDate + '.xlsx');
    showToast('Excel exported successfully');
  }

  // ─── Derived stats ────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const present = teamRows.filter(r => r.status === 'Present').length;
    const late = teamRows.filter(r => r.status === 'Late').length;
    const absent = teamRows.filter(r => r.status === 'Absent').length;
    return { present, late, absent, total: teamRows.length };
  }, [teamRows]);

  const hoursDisplay = typeof myAtt?.hoursWorked === 'number' ? myAtt.hoursWorked.toFixed(2) : '0.00';
  const breakDisplay = fmtMinutes(totalBreakMinutes(myAtt));

  function badge(status: TeamStatus) {
    if (status === 'Present') return 'bg-[#DCFCE7] text-[#166534]';
    if (status === 'Late') return 'bg-[#FEF3C7] text-[#92400E]';
    return 'bg-[#FEE2E2] text-[#991B1B]';
  }

  return (
    <div className="animate-fade-in">
      {/* Toast */}
      <div
        className={`fixed top-6 right-6 bg-[#2A313D] text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-2 z-[999] transition-all duration-300 pointer-events-none ${
          toastVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-5'
        }`}
      >
        <span className="material-symbols-outlined text-[#a8cd62]">info</span>
        <span className="font-bold text-sm">{toast}</span>
      </div>

      {/* Header */}
      <header className="flex justify-between items-center px-12 py-8 w-full sticky top-0 z-40 bg-[#F7F8F4]">
        <div>
          <h1 className="font-bold tracking-tight text-3xl text-stone-900">Attendance</h1>
          <p className="text-stone-500 text-sm font-medium mt-1">
            Your check-in plus today&apos;s team overview
          </p>
        </div>
      </header>

      <div className="px-12 space-y-10 pb-20">
        {/* My Attendance */}
        <section className="clay-card p-8">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#a8cd62] text-3xl">how_to_reg</span>
              <div>
                <h2 className="text-2xl font-extrabold tracking-tighter">My Attendance</h2>
                <p className="text-[#6B7280] text-sm font-medium">{fmtTodayLong()}</p>
              </div>
            </div>
            <span className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider ${pillClass}`}>
              {pillText}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-[#F0F2EA] rounded-2xl p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280] mb-2">Check In</p>
              <p className="text-2xl font-extrabold font-mono tracking-tight">
                {firstSession ? fmtTime(firstSession.checkInTime) : '—'}
              </p>
            </div>
            <div className="bg-[#F0F2EA] rounded-2xl p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280] mb-2">Check Out</p>
              <p className="text-2xl font-extrabold font-mono tracking-tight">
                {lastSession?.checkOutTime ? fmtTime(lastSession.checkOutTime) : '—'}
              </p>
            </div>
            <div className="bg-[#F0F2EA] rounded-2xl p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280] mb-2">Hours Worked</p>
              <p className="text-2xl font-extrabold font-mono tracking-tight">{hoursDisplay}</p>
            </div>
            <div className="bg-[#F0F2EA] rounded-2xl p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280] mb-2">Total Break</p>
              <p className="text-2xl font-extrabold font-mono tracking-tight">{breakDisplay}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCheckIn}
              disabled={busyIn || disableCheckIn}
              className="flex-1 min-w-[180px] bg-[#A8CD62] hover:brightness-110 active:scale-[0.99] transition-all text-[#131F00] font-extrabold text-sm uppercase tracking-wider px-8 h-[56px] rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-[#A8CD62]/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined">login</span> Check In
            </button>

            {!showResume && (
              <button
                type="button"
                onClick={() => handleToggleBreak('Break started')}
                disabled={busyBreak || disableBreak}
                className="flex-1 min-w-[180px] bg-white border-2 border-[#A8CD62] hover:bg-[#F0F2EA] active:scale-[0.99] transition-all text-[#3C5600] font-extrabold text-sm uppercase tracking-wider px-8 h-[56px] rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined">free_breakfast</span> {breakLabel}
              </button>
            )}

            {showResume && (
              <button
                type="button"
                onClick={() => handleToggleBreak('Resumed work')}
                disabled={busyBreak}
                className="flex-1 min-w-[180px] bg-[#A8CD62] hover:brightness-110 active:scale-[0.99] transition-all text-[#131F00] font-extrabold text-sm uppercase tracking-wider px-8 h-[56px] rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-[#A8CD62]/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined">play_arrow</span> Resume
              </button>
            )}

            <button
              type="button"
              onClick={handleCheckOut}
              disabled={busyOut || disableCheckOut}
              className="flex-1 min-w-[180px] bg-[#2A313D] hover:brightness-110 active:scale-[0.99] transition-all text-white font-extrabold text-sm uppercase tracking-wider px-8 h-[56px] rounded-2xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined">logout</span> Check Out
            </button>
          </div>
          {lastBreakLine && (
            <p className="mt-3 text-xs font-semibold text-[#6B7280]">{lastBreakLine}</p>
          )}
        </section>

        {/* Team Attendance */}
        <section className="clay-card p-8">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#a8cd62] text-3xl">groups</span>
              <h2 className="text-2xl font-extrabold tracking-tighter">Team Attendance</h2>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <label htmlFor="team-date" className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280]">
                Date
              </label>
              <input
                id="team-date"
                type="date"
                value={teamDate}
                onChange={e => setTeamDate(e.target.value || isoDateToday())}
                className="bg-[#F0F2EA] border-none rounded-xl text-sm font-bold text-stone-900 focus:ring-2 focus:ring-[#A8CD62] px-4 h-[42px]"
              />
              <button
                type="button"
                onClick={exportXlsx}
                disabled={!teamRows.length}
                className="bg-[#A8CD62] hover:brightness-110 transition-all text-[#131F00] font-extrabold text-xs uppercase tracking-wider px-5 h-[42px] rounded-xl flex items-center gap-2 shadow-md shadow-[#A8CD62]/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-base">table_view</span> Export Excel
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-[#DCFCE7] rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#166534]">Present</p>
              <p className="text-2xl font-extrabold font-mono mt-1 text-[#166534]">{stats.present}</p>
            </div>
            <div className="bg-[#FEE2E2] rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#991B1B]">Absent</p>
              <p className="text-2xl font-extrabold font-mono mt-1 text-[#991B1B]">{stats.absent}</p>
            </div>
            <div className="bg-[#FEF3C7] rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#92400E]">Late</p>
              <p className="text-2xl font-extrabold font-mono mt-1 text-[#92400E]">{stats.late}</p>
            </div>
            <div className="bg-[#F0F2EA] rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280]">Total</p>
              <p className="text-2xl font-extrabold font-mono mt-1">{stats.total}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#F0F2EA]">
            <table className="w-full text-left">
              <thead className="bg-[#F0F2EA] text-[10px] uppercase tracking-widest text-[#6B7280] font-bold">
                <tr>
                  <th className="px-6 py-4">Employee Name</th>
                  <th className="px-6 py-4">Employee ID</th>
                  <th className="px-6 py-4">Check In</th>
                  <th className="px-6 py-4">Check Out</th>
                  <th className="px-6 py-4">Hours</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F2EA] text-sm">
                {teamLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-[#6B7280] text-sm">
                      Loading attendance…
                    </td>
                  </tr>
                ) : teamError ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-[#991B1B] text-sm">
                      {teamError}
                    </td>
                  </tr>
                ) : teamRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-[#6B7280] text-sm">
                      No employees found for this date.
                    </td>
                  </tr>
                ) : (
                  teamRows.map(r => (
                    <tr key={r.userId} className="hover:bg-[#F7F8F4] transition-colors">
                      <td className="px-6 py-4 font-bold text-stone-900">{r.name}</td>
                      <td className="px-6 py-4 font-mono text-xs font-bold text-stone-700">
                        {r.employeeId || '—'}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">{r.checkInDisplay}</td>
                      <td className="px-6 py-4 font-mono text-xs">{r.checkOutDisplay}</td>
                      <td className="px-6 py-4 font-mono text-xs font-bold">{r.hours.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${badge(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
