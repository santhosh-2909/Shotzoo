import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { reportsApi } from '@/utils/api';

type ReportType = 'BOD' | 'MOD' | 'EOD';

const TITLES: Record<ReportType, string> = {
  BOD: 'Beginning of Day Report',
  MOD: 'Middle of Day Report',
  EOD: 'End of Day Report',
};

const WINDOWS: Record<ReportType, [number, number]> = {
  BOD: [9, 13],
  MOD: [14, 18],
  EOD: [18, 21],
};

const WINDOW_LABELS: Record<ReportType, string> = {
  BOD: 'BOD window is 9:00 AM – 1:00 PM',
  MOD: 'MOD window is 2:00 PM – 6:00 PM',
  EOD: 'EOD window is after 6:00 PM',
};

interface ReportStatus {
  submitted: boolean;
  submittedAt?: string;
  isLate?: boolean;
  windowStatus?: 'open' | 'closed' | 'upcoming';
}

function getWindowStatus(type: ReportType): 'open' | 'closed' | 'upcoming' {
  const h = new Date().getHours();
  const [start, end] = WINDOWS[type];
  if (h >= start && h < end) return 'open';
  if (h >= end) return 'closed';
  return 'upcoming';
}


function formatTimeShort(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function DailyReports() {
  const { setPortal } = useTheme();
  useEffect(() => { setPortal('employee'); }, [setPortal]);

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
    const h = now.getHours();
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API response
      const data = await reportsApi.today() as any;
      if (data.statuses) {
        const newSubmitted: Partial<Record<ReportType, ReportStatus>> = {};
        (['BOD', 'MOD', 'EOD'] as ReportType[]).forEach(type => {
          const s: ReportStatus = data.statuses[type];
          if (s.submitted) newSubmitted[type] = s;
        });
        setSubmittedReports(newSubmitted);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => { loadTodayReports(); }, [loadTodayReports]);

  // Switch tabs — clear form
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
    if (!reportBody.trim()) { setFormError('Please enter the report details.'); return; }

    setFormError('');
    setSubmitting(true);
    try {
      await reportsApi.submit({ type: currentTab, title: reportTitle.trim(), description: reportBody.trim() });
      setReportTitle('');
      setReportBody('');
      setFormSuccess(currentTab + ' Report submitted successfully!');
      await loadTodayReports();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  // Status card helpers
  const getStatusIcon = (type: ReportType): { icon: string; cls: string; label: string; sub?: string } => {
    const s = submittedReports[type];
    if (s?.submitted) {
      const timeStr = formatTimeShort(s.submittedAt);
      if (s.isLate) {
        return { icon: 'warning', cls: 'text-error', label: 'Late', sub: 'Submitted at ' + timeStr };
      }
      return { icon: 'check_circle', cls: 'text-primary', label: 'On Time', sub: 'Submitted at ' + timeStr };
    }
    const ws = getWindowStatus(type);
    if (ws === 'open') return { icon: 'edit_note', cls: 'text-primary', label: 'Open Now' };
    if (ws === 'closed') return { icon: 'cancel', cls: 'text-error', label: 'Missed' };
    return { icon: 'schedule', cls: 'text-on-surface-variant', label: 'Pending' };
  };

  // Form state for current tab
  const alreadySubmitted = !!submittedReports[currentTab];
  const windowStatus = getWindowStatus(currentTab);
  const isOpen = windowStatus === 'open' && !alreadySubmitted;
  const isLocked = alreadySubmitted || windowStatus !== 'open';

  const submitBtnClass = isOpen
    ? 'w-full h-14 bg-primary-container text-on-primary-container font-extrabold text-lg rounded-full shadow-[0_10px_20px_rgba(173,211,102,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-transform flex items-center justify-center gap-3'
    : 'w-full h-14 bg-surface-container-high text-on-surface-variant font-extrabold text-lg rounded-full flex items-center justify-center gap-3 opacity-50 cursor-not-allowed';

  const barSegmentClass = (type: ReportType) => {
    const st = barStatus[type];
    if (st === 'active') return 'flex-1 bg-primary-container flex items-center justify-center rounded-full text-on-primary-container font-bold text-sm shadow-sm';
    if (st === 'past') return 'flex-1 bg-surface-container flex items-center justify-center rounded-full text-on-surface-variant/60 font-medium text-sm';
    return 'flex-1 flex items-center justify-center rounded-full text-on-surface-variant font-medium text-xs md:text-sm transition-all';
  };

  const BAR_LABELS: Record<ReportType, string> = { BOD: 'BOD (9am-1pm)', MOD: 'MOD (2-6pm)', EOD: 'EOD (6-9pm)' };
  const STATUS_WINDOWS: Record<ReportType, string> = { BOD: '9 AM - 1 PM', MOD: '2 PM - 6 PM', EOD: '6 PM - 9 PM' };

  return (
    <div className="animate-fade-in">
      <main className="min-h-screen p-6 md:p-10 overflow-x-hidden">
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
        </div>
      </main>
    </div>
  );
}
