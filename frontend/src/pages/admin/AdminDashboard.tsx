import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { useTheme } from '@/contexts/ThemeContext';
import { adminApi, reportsApi } from '@/utils/api';
import type { Task, User } from '@/types';

interface AdminStats {
  completedToday: number;
  openTasks: number;
  totalEmployees: number;
  overdueCount: number;
}

type ReportKey = 'bod' | 'mod' | 'eod';
type ReportLabel = 'BOD' | 'MOD' | 'EOD';

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

type ReportFilter = 'All' | 'Submitted' | 'Partial' | 'Pending';

interface ModalState {
  employee: User;
  type:     ReportLabel;
  cell:     ReportCell | null;
}

export default function AdminDashboard() {
  const { setPortal } = useTheme();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const [reportEmployees, setReportEmployees] = useState<ReportEmployee[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportFilter, setReportFilter] = useState<ReportFilter>('All');
  const [modal, setModal] = useState<ModalState | null>(null);

  const [bodText, setBodText] = useState('');
  const [modText, setModText] = useState('');
  const [eodText, setEodText] = useState('');
  const [dailyReportSubmitting, setDailyReportSubmitting] = useState(false);
  const [mySubmitted, setMySubmitted] = useState<Record<string, boolean>>({});

  useEffect(() => { setPortal('admin'); }, [setPortal]);

  useEffect(() => {
    Promise.all([
      adminApi.stats() as Promise<{ success: boolean; stats: AdminStats }>,
      adminApi.tasks() as Promise<{ success: boolean; tasks: Task[] }>,
    ])
      .then(([statsRes, tasksRes]) => {
        if (statsRes.success) setStats(statsRes.stats);
        if (tasksRes.success) setTasks(tasksRes.tasks || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reportsApi.allToday()
      .then(res => {
        const r = res as { success?: boolean; employees?: ReportEmployee[] };
        if (r.success && r.employees) setReportEmployees(r.employees);
      })
      .catch(() => {})
      .finally(() => setReportsLoading(false));
  }, []);

  useEffect(() => {
    reportsApi.today()
      .then(res => {
        const r = res as { success?: boolean; reports?: { type: string; title: string; description: string }[] };
        if (r.success && r.reports) {
          const sub: Record<string, boolean> = {};
          for (const rpt of r.reports) {
            sub[rpt.type] = true;
            if (rpt.type === 'BOD') setBodText(rpt.title);
            if (rpt.type === 'MOD') setModText(rpt.title);
            if (rpt.type === 'EOD') setEodText(rpt.title);
          }
          setMySubmitted(sub);
        }
      })
      .catch(() => {});
  }, []);

  const filteredEmployees = useMemo(() => {
    if (reportFilter === 'All')       return reportEmployees;
    if (reportFilter === 'Submitted') return reportEmployees.filter(e => e.status === 'Completed');
    if (reportFilter === 'Partial')   return reportEmployees.filter(e => e.status === 'Partial');
    return reportEmployees.filter(e => e.status === 'Not Submitted');
  }, [reportEmployees, reportFilter]);

  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModal(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal]);

  function showToast(msg: string) {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  }

  function refreshReports() {
    reportsApi.allToday()
      .then(res => {
        const r = res as { success?: boolean; employees?: ReportEmployee[] };
        if (r.success && r.employees) setReportEmployees(r.employees);
      })
      .catch(() => {});
  }

  async function handleDailyReportSubmit() {
    const entries = [
      { type: 'BOD' as const, text: bodText },
      { type: 'MOD' as const, text: modText },
      { type: 'EOD' as const, text: eodText },
    ].filter(e => e.text.trim());

    if (!entries.length) return;
    setDailyReportSubmitting(true);

    try {
      const results = await Promise.allSettled(
        entries.map(({ type, text }) => {
          const body = { type, title: text.trim(), description: '' };
          return mySubmitted[type] ? reportsApi.upsert(body) : reportsApi.submit(body);
        }),
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const firstFail = results.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;

      if (succeeded > 0) {
        setBodText('');
        setModText('');
        setEodText('');
        refreshReports();
        reportsApi.today()
          .then(res => {
            const r = res as { success?: boolean; reports?: { type: string; title: string }[] };
            if (r.success && r.reports) {
              const sub: Record<string, boolean> = {};
              for (const rpt of r.reports) sub[rpt.type] = true;
              setMySubmitted(sub);
            }
          })
          .catch(() => {});
      }

      if (firstFail) {
        showToast(firstFail.reason instanceof Error ? firstFail.reason.message : 'Some reports failed');
      } else {
        showToast('Report submitted successfully');
      }
    } catch {
      showToast('Failed to submit reports');
    } finally {
      setDailyReportSubmitting(false);
    }
  }

  function exportCsv() {
    if (!tasks.length) return;
    const rows = tasks.map(t => ({
      Employee: typeof t.user === 'object' ? (t.user as User).fullName : t.user,
      Title: t.title,
      Deadline: t.deadline ? new Date(t.deadline).toLocaleDateString() : '',
      Status: t.status,
      Priority: t.priority,
    }));
    const header = Object.keys(rows[0]).join(',');
    const body = rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tasks.csv';
    a.click();
    showToast('CSV exported successfully');
  }

  function exportXlsx() {
    if (!tasks.length) return;
    const rows = tasks.map(t => ({
      Employee: typeof t.user === 'object' ? (t.user as User).fullName : t.user,
      Title: t.title,
      Deadline: t.deadline ? new Date(t.deadline).toLocaleDateString() : '',
      Status: t.status,
      Priority: t.priority,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
    XLSX.writeFile(wb, 'tasks.xlsx');
    showToast('Excel exported successfully');
  }

  const reportStatusLabel: Record<ReportEmployee['status'], string> = {
    Completed:        'Submitted',
    Partial:          'Partial',
    'Not Submitted':  'Not Submitted',
  };
  const reportStatusColor: Record<ReportEmployee['status'], string> = {
    Completed:        'text-green-700 bg-green-50',
    Partial:          'text-amber-700 bg-amber-50',
    'Not Submitted':  'text-red-600 bg-red-50',
  };

  function initialsFor(name?: string): string {
    return (name || '?').split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  function formatSubmittedAt(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  }

  function cellPreview(cell: ReportCell | null): string {
    if (!cell) return '–';
    const s = cell.title?.trim() || cell.description?.trim() || 'Submitted';
    return s.length > 36 ? s.slice(0, 36) + '…' : s;
  }

  const FILTERS: ReportFilter[] = ['All', 'Submitted', 'Partial', 'Pending'];

  return (
    <div className="animate-fade-in p-12">
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
      <header className="flex justify-between items-center mb-12 w-full">
        <div>
          <h1 className="text-4xl font-bold tracking-tight font-headline text-black">Dashboard</h1>
          <p className="text-stone-500 mt-1">Editorial oversight &amp; operations control center.</p>
        </div>
      </header>

      {/* Stats Grid */}
      <section className="grid grid-cols-3 gap-6 mb-12">
        <div className="bg-white p-8 rounded-xl flex flex-col gap-4">
          <span className="material-symbols-outlined text-[#a8cd62] text-3xl">trending_up</span>
          <div>
            <p className="text-stone-400 text-xs font-medium uppercase tracking-wider mb-1">Completed Today</p>
            <h3 className="text-3xl font-bold font-headline">{loading ? '—' : (stats?.completedToday ?? 0)}</h3>
          </div>
          <div className="text-xs font-bold text-[#a8cd62]">tasks finished</div>
        </div>
        <div className="bg-white p-8 rounded-xl flex flex-col gap-4">
          <span className="material-symbols-outlined text-[#ffb044] text-3xl">pending_actions</span>
          <div>
            <p className="text-stone-400 text-xs font-medium uppercase tracking-wider mb-1">Open Tasks</p>
            <h3 className="text-3xl font-bold font-headline">{loading ? '—' : (stats?.openTasks ?? 0)}</h3>
          </div>
          <div className="text-xs font-bold text-stone-400">
            {stats && stats.overdueCount > 0 ? `${stats.overdueCount} Overdue` : ''}
          </div>
        </div>
        <div className="bg-white p-8 rounded-xl flex flex-col gap-4">
          <span className="material-symbols-outlined text-[#0058be] text-3xl">group</span>
          <div>
            <p className="text-stone-400 text-xs font-medium uppercase tracking-wider mb-1">Total Employees</p>
            <h3 className="text-3xl font-bold font-headline">{loading ? '—' : (stats?.totalEmployees ?? 0)}</h3>
          </div>
          <div className="text-xs font-bold text-stone-400">registered accounts</div>
        </div>
      </section>

      {/* Daily Report */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold font-headline">Daily Report</h2>
        <p className="text-stone-500 text-sm mt-1 mb-6">Submit your BOD, MOD, and EOD for today.</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2 block">
              BOD — Beginning of Day
            </label>
            <textarea
              value={bodText}
              onChange={e => setBodText(e.target.value)}
              placeholder="What are you focusing on today?"
              className="w-full bg-white rounded-xl p-4 text-sm text-stone-800 placeholder:text-stone-400 resize-none focus:ring-2 focus:ring-[#a8cd62] focus:outline-none border border-stone-200"
              rows={4}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2 block">
              MOD — Middle of Day
            </label>
            <textarea
              value={modText}
              onChange={e => setModText(e.target.value)}
              placeholder="Progress update / blockers"
              className="w-full bg-white rounded-xl p-4 text-sm text-stone-800 placeholder:text-stone-400 resize-none focus:ring-2 focus:ring-[#a8cd62] focus:outline-none border border-stone-200"
              rows={4}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2 block">
              EOD — End of Day
            </label>
            <textarea
              value={eodText}
              onChange={e => setEodText(e.target.value)}
              placeholder="What got shipped today?"
              className="w-full bg-white rounded-xl p-4 text-sm text-stone-800 placeholder:text-stone-400 resize-none focus:ring-2 focus:ring-[#a8cd62] focus:outline-none border border-stone-200"
              rows={4}
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={dailyReportSubmitting || (!bodText.trim() && !modText.trim() && !eodText.trim())}
            onClick={handleDailyReportSubmit}
            className="text-sm font-bold text-white bg-[#a8cd62] hover:brightness-110 flex items-center gap-2 px-5 py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-sm">send</span>
            {dailyReportSubmitting ? 'Submitting…' : 'Submit Report'}
          </button>
        </div>
      </section>

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-8">

          {/* Reporting Overview */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold font-headline">Reporting Overview</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportCsv}
                  disabled={!tasks.length}
                  className="text-sm font-bold text-[#496800] flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[#a8cd62]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-sm">download</span> Export CSV
                </button>
                <button
                  type="button"
                  onClick={exportXlsx}
                  disabled={!tasks.length}
                  className="text-sm font-bold text-white bg-[#a8cd62] hover:brightness-110 flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-sm">table_view</span> Export Excel
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              {FILTERS.map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setReportFilter(f)}
                  className={
                    reportFilter === f
                      ? 'px-4 py-1.5 rounded-full bg-[#a8cd62] text-[#131F00] text-xs font-extrabold uppercase tracking-wider shadow-sm'
                      : 'px-4 py-1.5 rounded-full bg-white text-stone-500 text-xs font-bold uppercase tracking-wider hover:bg-[#a8cd62]/10 transition-colors'
                  }
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#f0f3ff]">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-stone-500">Employee</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-stone-500">BOD</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-stone-500">MOD</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-stone-500">EOD</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-stone-500 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {reportsLoading ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-stone-400 text-sm">Loading reports…</td></tr>
                  ) : filteredEmployees.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-stone-400 text-sm">No employees match this filter.</td></tr>
                  ) : (
                    filteredEmployees.map(emp => {
                      const cells: { key: ReportKey; label: ReportLabel; cell: ReportCell | null }[] = [
                        { key: 'bod', label: 'BOD', cell: emp.bod },
                        { key: 'mod', label: 'MOD', cell: emp.mod },
                        { key: 'eod', label: 'EOD', cell: emp.eod },
                      ];
                      return (
                        <tr key={emp.user._id} className="hover:bg-[#a8cd62]/5 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-[#a8cd62] flex items-center justify-center font-bold text-[#3c5600] text-xs">
                                {initialsFor(emp.user.fullName)}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-stone-900 leading-tight">{emp.user.fullName || '—'}</p>
                                <p className="text-[11px] text-stone-400 font-mono mt-0.5">{emp.user.employeeId || '—'}</p>
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
                                    ? 'text-left text-stone-700 font-medium hover:text-[#3c5600] hover:underline underline-offset-2 transition-colors'
                                    : 'text-stone-300 hover:text-stone-500 transition-colors'
                                }
                                aria-label={`View ${label} report for ${emp.user.fullName || 'employee'}`}
                              >
                                {cellPreview(cell)}
                              </button>
                            </td>
                          ))}
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2.5 py-1 rounded text-xs font-bold ${reportStatusColor[emp.status]}`}>
                              {reportStatusLabel[emp.status]}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Report detail modal */}
        {modal && (
          <div
            className="fixed inset-0 bg-black/45 z-[9998] flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setModal(null); }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-detail-title"
          >
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
              <div className="sticky top-0 bg-white flex items-center justify-between px-8 py-6 border-b border-stone-100 z-10">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a8cd62] mb-1">
                    {modal.type} Report
                  </p>
                  <h3 id="report-detail-title" className="text-xl font-headline font-extrabold tracking-tight text-stone-900">
                    {modal.employee.fullName || 'Employee'}
                  </h3>
                  <p className="text-xs text-stone-500 mt-1 font-mono">{modal.employee.employeeId || '—'}</p>
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setModal(null)}
                  className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <span className="material-symbols-outlined text-stone-500">close</span>
                </button>
              </div>

              <div className="p-8 space-y-5">
                {!modal.cell ? (
                  <div className="rounded-xl bg-stone-50 border border-stone-100 px-4 py-6 text-center text-sm font-semibold text-stone-500">
                    No report submitted for this window.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#a8cd62]/10 text-[#3c5600] font-bold uppercase tracking-wider">
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
                      <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1.5">Task Title</p>
                      <p className="text-base font-bold text-stone-900">{modal.cell.title || '—'}</p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1.5">Details</p>
                      <div className="whitespace-pre-wrap text-sm text-stone-700 leading-relaxed bg-[#f8faf3] border border-[#a8cd62]/20 rounded-xl p-4">
                        {modal.cell.description?.trim() || '—'}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Right Column: Urgent Deadlines */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-8">
          <section>
            <h2 className="text-2xl font-bold font-headline mb-6">Urgent Deadlines</h2>
            <div className="bg-white p-8 rounded-xl flex flex-col gap-8">
              {tasks.filter(t => t.status === 'Overdue' || t.status === 'In Progress').slice(0, 2).length === 0 ? (
                <p className="text-stone-400 text-sm">No urgent deadlines.</p>
              ) : (
                tasks.filter(t => t.status === 'Overdue' || t.status === 'In Progress').slice(0, 2).map(t => {
                  const isOverdue = t.status === 'Overdue';
                  const dl = t.deadline ? new Date(t.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
                  return (
                    <div
                      key={t._id}
                      className={`relative pl-6 before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:rounded-full ${isOverdue ? 'before:bg-[#ba1a1a]' : 'before:bg-[#ffb044]'}`}
                    >
                      <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isOverdue ? 'text-[#ba1a1a]' : 'text-[#ffb044]'}`}>{dl}</p>
                      <h4 className="text-lg font-bold font-headline">{t.title}</h4>
                      <p className="text-sm text-stone-500 mt-2">{t.description || 'No description.'}</p>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
