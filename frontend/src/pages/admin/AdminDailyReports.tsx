import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { reportsApi, adminApi } from '@/utils/api';
import type { User } from '@/types';

type ReportType = 'BOD' | 'MOD' | 'EOD';

const TITLES: Record<ReportType, string> = {
  BOD: 'Beginning of Day Report',
  MOD: 'Middle of Day Report',
  EOD: 'End of Day Report',
};

const WINDOWS: Record<ReportType, [number, number]> = {
  BOD: [9, 11],
  MOD: [14, 18],
  EOD: [18, 21],
};

const WINDOW_LABELS: Record<ReportType, string> = {
  BOD: 'Upload window for BOD is 9:00 AM – 11:00 AM. Please try again during that time.',
  MOD: 'Upload window for MOD is 2:00 PM – 6:00 PM. Please try again during that time.',
  EOD: 'Upload window for EOD is 6:00 PM – 9:00 PM. Please try again during that time.',
};

interface ReportStatus {
  submitted: boolean;
  submittedAt?: string;
  isLate?: boolean;
  windowStatus?: 'open' | 'closed' | 'upcoming';
}

interface ReportCell {
  title:       string;
  description: string;
  isLate:      boolean;
  submittedAt: string;
}

interface ReportEmployee {
  user:   User;
  bod:    ReportCell | null;
  mod:    ReportCell | null;
  eod:    ReportCell | null;
  status: 'Completed' | 'Partial' | 'Not Submitted';
}

type TeamFilter = 'All' | 'Submitted' | 'Partial' | 'Pending';

interface ModalState {
  employee: User;
  type:     ReportType;
  cell:     ReportCell | null;
}

function getISTHour(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour:     'numeric',
    hour12:   false,
  }).formatToParts(new Date());
  const h = Number(parts.find(p => p.type === 'hour')?.value ?? '0');
  return h === 24 ? 0 : h;
}

function getWindowStatus(type: ReportType): 'open' | 'closed' | 'upcoming' {
  const h = getISTHour();
  const [start, end] = WINDOWS[type];
  if (h >= start && h < end) return 'open';
  if (h >= end) return 'closed';
  return 'upcoming';
}

function formatTimeShort(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatSubmittedAt(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function cellPreview(cell: ReportCell | null): string {
  if (!cell) return '–';
  const s = cell.title?.trim() || cell.description?.trim() || 'Submitted';
  return s.length > 36 ? s.slice(0, 36) + '…' : s;
}

function initialsOf(name?: string): string {
  return (name || '?').split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function AdminDailyReports() {
  const { setPortal } = useTheme();
  useEffect(() => { setPortal('admin'); }, [setPortal]);

  // ─── Self-submission state (mirrors employee page) ──────────────────
  const [currentTab, setCurrentTab] = useState<ReportType>('BOD');
  const [submittedReports, setSubmittedReports] = useState<Partial<Record<ReportType, ReportStatus>>>({});
  const [reportTitle, setReportTitle] = useState('');
  const [reportBody, setReportBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [liveDate, setLiveDate] = useState('');
  const [liveTime, setLiveTime] = useState('');
  const [barStatus, setBarStatus] = useState<Record<ReportType, string>>({ BOD: '', MOD: '', EOD: '' });

  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const minuteRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateClock = useCallback(() => {
    const now = new Date();
    setLiveDate(now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }));
    setLiveTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    const h = getISTHour();
    setBarStatus({
      BOD: h >= WINDOWS.BOD[0] && h < WINDOWS.BOD[1] ? 'active' : h >= WINDOWS.BOD[1] ? 'past' : 'future',
      MOD: h >= WINDOWS.MOD[0] && h < WINDOWS.MOD[1] ? 'active' : h >= WINDOWS.MOD[1] ? 'past' : 'future',
      EOD: h >= WINDOWS.EOD[0] && h < WINDOWS.EOD[1] ? 'active' : h >= WINDOWS.EOD[1] ? 'past' : 'future',
    });
  }, []);

  useEffect(() => {
    updateClock();
    clockRef.current = setInterval(updateClock, 1000);
    minuteRef.current = setInterval(updateClock, 60000);
    return () => {
      if (clockRef.current) clearInterval(clockRef.current);
      if (minuteRef.current) clearInterval(minuteRef.current);
    };
  }, [updateClock]);

  const loadTodayReports = useCallback(async () => {
    try {
      const data = await reportsApi.today() as { success: boolean; statuses?: Record<ReportType, ReportStatus> };
      if (data.statuses) {
        const newSubmitted: Partial<Record<ReportType, ReportStatus>> = {};
        (['BOD', 'MOD', 'EOD'] as ReportType[]).forEach(type => {
          const s = data.statuses?.[type];
          if (s?.submitted) newSubmitted[type] = s;
        });
        setSubmittedReports(newSubmitted);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => { loadTodayReports(); }, [loadTodayReports]);

  useEffect(() => {
    if (!formSuccess) return;
    const t = setTimeout(() => setFormSuccess(''), 3500);
    return () => clearTimeout(t);
  }, [formSuccess]);

  const handleTabSwitch = (tab: ReportType) => {
    setCurrentTab(tab);
    setReportTitle('');
    setReportBody('');
    setFormError('');
    setFormSuccess('');
  };

  const handleSubmit = async () => {
    if (getWindowStatus(currentTab) !== 'open') {
      setFormError(WINDOW_LABELS[currentTab]);
      return;
    }
    if (!reportTitle.trim()) { setFormError('Please enter a task title.'); return; }
    if (!reportBody.trim())  { setFormError('Please enter the report details.'); return; }

    setFormError('');
    setSubmitting(true);
    try {
      await reportsApi.submit({ type: currentTab, title: reportTitle.trim(), description: reportBody.trim() });
      setReportTitle('');
      setReportBody('');
      setFormSuccess('Updated successfully');
      await loadTodayReports();
      loadTeamReports(teamDate);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Admin team-view state ─────────────────────────────────────────
  const [teamDate, setTeamDate] = useState(new Date().toISOString().split('T')[0]);
  const [teamEmployees, setTeamEmployees] = useState<ReportEmployee[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('All');
  const [teamSearch, setTeamSearch] = useState('');
  const [modal, setModal] = useState<ModalState | null>(null);

  const loadTeamReports = useCallback((date: string) => {
    setTeamLoading(true);
    (adminApi.reportsToday(date) as Promise<{ success?: boolean; employees?: ReportEmployee[] }>)
      .then(res => {
        if (res.success && res.employees) setTeamEmployees(res.employees);
        else setTeamEmployees([]);
      })
      .catch(() => setTeamEmployees([]))
      .finally(() => setTeamLoading(false));
  }, []);

  useEffect(() => { loadTeamReports(teamDate); }, [loadTeamReports, teamDate]);

  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModal(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal]);

  const filteredTeam = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    return teamEmployees.filter(e => {
      const matchStatus =
        teamFilter === 'All' ||
        (teamFilter === 'Submitted' && e.status === 'Completed') ||
        (teamFilter === 'Partial'   && e.status === 'Partial') ||
        (teamFilter === 'Pending'   && e.status === 'Not Submitted');
      if (!matchStatus) return false;
      if (!q) return true;
      const name = (e.user.fullName ?? '').toLowerCase();
      const emp  = (e.user.employeeId ?? '').toLowerCase();
      return name.includes(q) || emp.includes(q);
    });
  }, [teamEmployees, teamFilter, teamSearch]);

  // ─── Derived UI state (self-submission) ────────────────────────────
  const getStatusIcon = (type: ReportType): { icon: string; cls: string; label: string; sub?: string } => {
    const s = submittedReports[type];
    if (s?.submitted) {
      const timeStr = formatTimeShort(s.submittedAt);
      if (s.isLate) return { icon: 'warning', cls: 'text-error', label: 'Late', sub: 'Submitted at ' + timeStr };
      return { icon: 'check_circle', cls: 'text-primary', label: 'On Time', sub: 'Submitted at ' + timeStr };
    }
    const ws = getWindowStatus(type);
    if (ws === 'open')   return { icon: 'edit_note', cls: 'text-primary', label: 'Open Now' };
    if (ws === 'closed') return { icon: 'cancel', cls: 'text-error', label: 'Missed' };
    return { icon: 'schedule', cls: 'text-on-surface-variant', label: 'Pending' };
  };

  const alreadySubmitted = !!submittedReports[currentTab];
  const windowStatus     = getWindowStatus(currentTab);
  const isOpen   = windowStatus === 'open' && !alreadySubmitted;
  const isLocked = alreadySubmitted || windowStatus !== 'open';

  const submitBtnClass = isOpen
    ? 'w-full h-14 bg-primary-container text-on-primary-container font-extrabold text-lg rounded-full shadow-[0_10px_20px_rgba(173,211,102,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-transform flex items-center justify-center gap-3'
    : 'w-full h-14 bg-surface-container-high text-on-surface-variant font-extrabold text-lg rounded-full flex items-center justify-center gap-3 opacity-50 cursor-not-allowed';

  const barSegmentClass = (type: ReportType) => {
    const st = barStatus[type];
    if (st === 'active') return 'flex-1 bg-primary-container flex items-center justify-center rounded-full text-on-primary-container font-bold text-sm shadow-sm';
    if (st === 'past')   return 'flex-1 bg-surface-container flex items-center justify-center rounded-full text-on-surface-variant/60 font-medium text-sm';
    return 'flex-1 flex items-center justify-center rounded-full text-on-surface-variant font-medium text-xs md:text-sm transition-all';
  };

  const BAR_LABELS: Record<ReportType, string> = { BOD: 'BOD (9-11am)', MOD: 'MOD (2-6pm)', EOD: 'EOD (6-9pm)' };
  const STATUS_WINDOWS: Record<ReportType, string> = { BOD: '9 AM - 11 AM', MOD: '2 PM - 6 PM', EOD: '6 PM - 9 PM' };

  // ─── Team-view badge colors ─────────────────────────────────────────
  const teamStatusLabel: Record<ReportEmployee['status'], string> = {
    Completed:        'Submitted',
    Partial:          'Partial',
    'Not Submitted':  'Not Submitted',
  };
  const teamStatusColor: Record<ReportEmployee['status'], string> = {
    Completed:        'text-green-700 bg-green-50',
    Partial:          'text-amber-700 bg-amber-50',
    'Not Submitted':  'text-red-600 bg-red-50',
  };

  const FILTERS: TeamFilter[] = ['All', 'Submitted', 'Partial', 'Pending'];

  return (
    <div className="animate-fade-in">
      <main className="min-h-screen p-6 md:p-10 overflow-x-hidden">
        {/* Header */}
        <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h2 className="font-headline text-4xl font-bold tracking-tight text-on-surface">Daily Reports</h2>
            <p className="text-on-surface-variant mt-1">Submit your BOD, MOD, and EOD updates on time</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-on-surface-variant bg-surface-container-high px-4 py-2 rounded-full">{liveDate || '--'}</span>
            <span className="text-sm font-bold text-primary bg-primary-container/30 px-4 py-2 rounded-full tabular-nums">{liveTime || '--:-- --'}</span>
          </div>
        </header>

        <div className="space-y-8">
          {/* Time Status Bar */}
          <section className="clay-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Submission Window</h3>
            </div>
            <div className="flex w-full bg-surface-container-high rounded-full h-12 md:h-14 p-1 md:p-1.5 gap-1 md:gap-2">
              {(['BOD', 'MOD', 'EOD'] as ReportType[]).map(type => (
                <div key={type} className={barSegmentClass(type)}>{BAR_LABELS[type]}</div>
              ))}
            </div>
          </section>

          {/* Today's Summary */}
          <section className="clay-card p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">Today's Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(['BOD', 'MOD', 'EOD'] as ReportType[]).map(type => {
                const info = getStatusIcon(type);
                return (
                  <div key={type} className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full bg-outline-variant/10 flex items-center justify-center ${info.cls}`}>
                        <span className="material-symbols-outlined">{info.icon}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold">{type}</p>
                        <p className="text-[10px] text-on-surface-variant">{info.sub || STATUS_WINDOWS[type]}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-extrabold uppercase ${info.cls}`}>{info.label}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Form Area */}
          <div className="max-w-3xl space-y-6">
            <section className="clay-card overflow-hidden">
              {/* Tabs */}
              <div className="flex border-b border-surface-container-high">
                {(['BOD', 'MOD', 'EOD'] as ReportType[]).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => handleTabSwitch(tab)}
                    className={
                      currentTab === tab
                        ? 'report-tab flex-1 py-5 text-sm font-bold text-primary border-b-4 border-primary'
                        : 'report-tab flex-1 py-5 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low transition-colors border-b-4 border-transparent'
                    }
                  >
                    {tab} Report
                  </button>
                ))}
              </div>

              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-xl font-bold text-on-surface">{TITLES[currentTab]}</h4>
                  <div className={`flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                    alreadySubmitted
                      ? 'bg-primary/10 text-primary'
                      : isOpen
                        ? 'bg-secondary-container text-on-secondary-container'
                        : 'bg-surface-container-high text-on-surface-variant'
                  }`}>
                    <span className="w-2 h-2 rounded-full bg-primary mr-2" />
                    {alreadySubmitted ? 'Already submitted' : isOpen ? 'Submission open' : WINDOW_LABELS[currentTab]}
                  </div>
                </div>

                {formError && (
                  <div className="px-4 py-3 rounded-xl bg-error-container text-on-error-container text-sm font-semibold">
                    {formError}
                  </div>
                )}
                {formSuccess && (
                  <div className="px-4 py-3 rounded-xl bg-primary-container/40 text-on-primary-container text-sm font-semibold">
                    {formSuccess}
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label htmlFor="report-title" className="text-xs font-bold text-on-surface-variant ml-1 uppercase tracking-wider">Task Title</label>
                    <input
                      id="report-title"
                      disabled={isLocked}
                      value={reportTitle}
                      onChange={e => setReportTitle(e.target.value)}
                      className="w-full h-12 px-5 bg-surface-container-low border-transparent rounded-2xl focus:ring-2 focus:ring-primary-container focus:bg-white transition-all outline-none text-on-surface placeholder:text-outline-variant disabled:opacity-55 disabled:cursor-not-allowed"
                      placeholder="e.g. Warehouse Inventory Audit"
                      type="text"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="report-body" className="text-xs font-bold text-on-surface-variant ml-1 uppercase tracking-wider">Detailed Scope (What / Why / How / When)</label>
                    <textarea
                      id="report-body"
                      disabled={isLocked}
                      value={reportBody}
                      onChange={e => setReportBody(e.target.value)}
                      className="w-full p-5 bg-surface-container-low border-transparent rounded-2xl focus:ring-2 focus:ring-primary-container focus:bg-white transition-all outline-none text-on-surface resize-none placeholder:text-outline-variant disabled:opacity-55 disabled:cursor-not-allowed"
                      placeholder="Describe the objectives and strategy..."
                      rows={6}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isLocked || submitting}
                  onClick={handleSubmit}
                  className={submitBtnClass}
                >
                  {alreadySubmitted ? (
                    <><span className="material-symbols-outlined">check_circle</span> {currentTab} Report Submitted</>
                  ) : isOpen ? (
                    <><span className="material-symbols-outlined">send</span> {submitting ? 'Submitting...' : 'Submit Report'}</>
                  ) : (
                    <><span className="material-symbols-outlined">lock</span> {WINDOW_LABELS[currentTab]}</>
                  )}
                </button>
              </div>
            </section>
          </div>

          {/* ─── Admin-only: Team Daily Reports ───────────────────────── */}
          <section className="clay-card p-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">Team Daily Reports</h3>
                <p className="text-sm text-on-surface-variant">View every employee's BOD/MOD/EOD for the selected date.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={teamDate}
                  onChange={e => setTeamDate(e.target.value)}
                  aria-label="Select date"
                  className="bg-surface-container-high rounded-full px-4 py-2 text-sm font-semibold text-on-surface border-0 focus:ring-2 focus:ring-primary-container outline-none"
                />
                <button
                  type="button"
                  onClick={() => setTeamDate(new Date().toISOString().split('T')[0])}
                  className="bg-surface-container-high hover:bg-primary-container/30 text-on-surface-variant px-4 py-2 rounded-full text-xs font-bold transition-colors"
                >
                  Today
                </button>
              </div>
            </div>

            {/* Filters row */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3 mb-4">
              <div className="flex-1 bg-surface-container-high rounded-full px-4 py-2 flex items-center gap-2 w-full md:max-w-xs">
                <span className="material-symbols-outlined text-on-surface-variant text-base">search</span>
                <input
                  type="text"
                  value={teamSearch}
                  onChange={e => setTeamSearch(e.target.value)}
                  placeholder="Search employee…"
                  aria-label="Search employees"
                  className="bg-transparent border-none focus:ring-0 text-on-surface text-sm w-full placeholder:text-on-surface-variant outline-none"
                />
                {teamSearch && (
                  <button type="button" onClick={() => setTeamSearch('')} aria-label="Clear search" className="text-on-surface-variant hover:text-on-surface">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {FILTERS.map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setTeamFilter(f)}
                    className={
                      teamFilter === f
                        ? 'px-4 py-1.5 rounded-full bg-primary-container text-on-primary-container text-xs font-extrabold uppercase tracking-wider shadow-sm'
                        : 'px-4 py-1.5 rounded-full bg-surface-container-high text-on-surface-variant text-xs font-bold uppercase tracking-wider hover:bg-primary-container/20 transition-colors'
                    }
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Team table */}
            <div className="bg-surface-container-low rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-container-high/50">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Employee</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">BOD</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">MOD</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">EOD</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {teamLoading ? (
                      <tr><td colSpan={5} className="px-6 py-10 text-center text-on-surface-variant text-sm">Loading reports…</td></tr>
                    ) : filteredTeam.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-10 text-center text-on-surface-variant text-sm">No employees match these filters.</td></tr>
                    ) : (
                      filteredTeam.map(emp => {
                        const cells: { key: 'bod' | 'mod' | 'eod'; label: ReportType; cell: ReportCell | null }[] = [
                          { key: 'bod', label: 'BOD', cell: emp.bod },
                          { key: 'mod', label: 'MOD', cell: emp.mod },
                          { key: 'eod', label: 'EOD', cell: emp.eod },
                        ];
                        return (
                          <tr key={emp.user._id} className="hover:bg-primary-container/5 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-primary-container flex items-center justify-center font-bold text-on-primary-container text-xs">
                                  {initialsOf(emp.user.fullName)}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-on-surface leading-tight">{emp.user.fullName || '—'}</p>
                                  <p className="text-[11px] text-on-surface-variant font-mono mt-0.5">{emp.user.employeeId || '—'}</p>
                                </div>
                              </div>
                            </td>
                            {cells.map(({ key, label, cell }) => (
                              <td key={key} className="px-6 py-4 text-sm">
                                <button
                                  type="button"
                                  onClick={() => setModal({ employee: emp.user, type: label, cell })}
                                  className={
                                    cell
                                      ? 'text-left text-on-surface font-medium hover:text-primary hover:underline underline-offset-2 transition-colors'
                                      : 'text-on-surface-variant/50 hover:text-on-surface-variant transition-colors'
                                  }
                                  aria-label={`View ${label} report for ${emp.user.fullName || 'employee'}`}
                                >
                                  {cellPreview(cell)}
                                </button>
                              </td>
                            ))}
                            <td className="px-6 py-4 text-center">
                              <span className={`px-2.5 py-1 rounded text-xs font-bold ${teamStatusColor[emp.status]}`}>
                                {teamStatusLabel[emp.status]}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Report detail modal */}
      {modal && (
        <div
          className="fixed inset-0 bg-black/45 z-[9998] flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setModal(null); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-detail-title"
        >
          <div className="bg-surface rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-surface flex items-center justify-between px-8 py-6 border-b border-outline-variant/20 z-10">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-1">
                  {modal.type} Report
                </p>
                <h3 id="report-detail-title" className="text-xl font-headline font-extrabold tracking-tight text-on-surface">
                  {modal.employee.fullName || 'Employee'}
                </h3>
                <p className="text-xs text-on-surface-variant mt-1 font-mono">{modal.employee.employeeId || '—'}</p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setModal(null)}
                className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
              >
                <span className="material-symbols-outlined text-on-surface-variant">close</span>
              </button>
            </div>

            <div className="p-8 space-y-5">
              {!modal.cell ? (
                <div className="rounded-xl bg-surface-container-low px-4 py-6 text-center text-sm font-semibold text-on-surface-variant">
                  No report submitted for this window.
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary font-bold uppercase tracking-wider">
                      <span className="material-symbols-outlined text-[14px]">schedule</span>
                      Submitted {formatSubmittedAt(modal.cell.submittedAt)}
                    </span>
                    {modal.cell.isLate && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-bold uppercase tracking-wider">
                        <span className="material-symbols-outlined text-[14px]">warning</span>
                        Late
                      </span>
                    )}
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Task Title</p>
                    <p className="text-base font-bold text-on-surface">{modal.cell.title || '—'}</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Details</p>
                    <div className="whitespace-pre-wrap text-sm text-on-surface leading-relaxed bg-surface-container-low rounded-xl p-4">
                      {modal.cell.description?.trim() || '—'}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
