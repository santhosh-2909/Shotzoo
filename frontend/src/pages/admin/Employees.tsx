import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { useTheme } from '@/contexts/ThemeContext';
import { adminApi } from '@/utils/api';
import type { User } from '@/types';
import AddEmployeeModal from '@/components/admin/AddEmployeeModal';

interface AttendanceStats {
  present: number;
  absent: number;
  totalEmployees: number;
}

export default function Employees() {
  const { setPortal } = useTheme();
  const [allEmployees, setAllEmployees] = useState<User[]>([]);
  const [filtered, setFiltered] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [attendance, setAttendance] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  useEffect(() => { setPortal('admin'); }, [setPortal]);

  function handleEmployeeCreated(newEmployee: User) {
    setAllEmployees(prev => [newEmployee, ...prev]);
    setAddModalOpen(false);
    showToast('Employee account created');
  }

  useEffect(() => {
    Promise.all([
      adminApi.employees() as Promise<{ success: boolean; employees: User[] }>,
      adminApi.attendance() as Promise<{ success: boolean; present: number; absent: number; totalEmployees: number }>,
    ])
      .then(([empRes, attRes]) => {
        if (empRes.success) {
          setAllEmployees(empRes.employees || []);
          setFiltered(empRes.employees || []);
        }
        if (attRes.success) setAttendance({ present: attRes.present, absent: attRes.absent, totalEmployees: attRes.totalEmployees });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(allEmployees.filter(e =>
      (e.fullName || '').toLowerCase().includes(q) ||
      (e.employeeId || '').toLowerCase().includes(q) ||
      (e.role || '').toLowerCase().includes(q)
    ));
  }, [search, allEmployees]);

  function showToast(msg: string) {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  }

  function exportCsv() {
    const rows = filtered.map(e => ({
      Name: e.fullName || '',
      ID: e.employeeId || '',
      Role: e.role || '',
      Type: e.employeeType || '',
      Email: e.email || '',
      Joined: e.createdAt ? new Date(e.createdAt).toLocaleDateString() : '',
    }));
    const header = Object.keys(rows[0]).join(',');
    const body = rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'employees.csv';
    a.click();
    showToast('Exported as CSV');
    setShowDownloadMenu(false);
  }

  function exportXlsx() {
    const rows = filtered.map(e => ({
      Name: e.fullName || '',
      ID: e.employeeId || '',
      Role: e.role || '',
      Type: e.employeeType || '',
      Email: e.email || '',
      Joined: e.createdAt ? new Date(e.createdAt).toLocaleDateString() : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(wb, 'employees.xlsx');
    showToast('Exported as Excel');
    setShowDownloadMenu(false);
  }

  const total = attendance?.totalEmployees ?? allEmployees.length;
  const present = attendance?.present ?? 0;
  const absent = attendance?.absent ?? 0;
  const offline = Math.max(0, total - present - absent);

  const circumference = 502;
  const presentPct = total > 0 ? Math.round((present / total) * 100) : 0;
  const presentOffset = circumference - (circumference * presentPct / 100);

  return (
    <div className="animate-fade-in min-h-screen bg-[#F7F8F4]">
      {/* Toast */}
      <div
        className={`fixed top-6 right-6 bg-[#2A313D] text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-2 z-[999] transition-all duration-300 pointer-events-none ${
          toastVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-5'
        }`}
      >
        <span className="material-symbols-outlined text-[18px] text-[#A8CD62]">info</span>
        <span className="font-bold text-xs">{toast}</span>
      </div>

      {/* Header */}
      <header className="flex justify-between items-center px-8 h-20 w-full sticky top-0 z-40 bg-[#F7F8F4]">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-headline font-extrabold tracking-tighter text-stone-900">
            Employees <span className="text-stone-400 ml-1 font-mono text-lg">[{allEmployees.length}]</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">search</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-[#f0f3ff] border-none rounded-lg pl-10 pr-4 py-2 text-sm w-64 focus:ring-2 focus:ring-[#a8cd62] outline-none transition-all"
              placeholder="Search employees…"
              type="text"
            />
          </div>
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-2 px-5 h-11 bg-[#A8CD62] text-[#131F00] font-extrabold text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-[#A8CD62]/30 hover:brightness-110 active:scale-[0.98] transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            <span>Add Employee</span>
          </button>
        </div>
      </header>

      <div className="p-8 space-y-10">
        {/* Stats */}
        <section className="grid grid-cols-4 gap-6">
          {[
            { label: 'Total Employees', val: total, badge: 'ALL SYSTEMS', badgeClass: 'text-[#A8CD62] bg-[#A8CD62]/10' },
            { label: 'Active Now', val: present, badge: 'PRESENT', badgeClass: 'text-emerald-600 bg-emerald-100' },
            { label: 'Absent Today', val: absent, badge: 'ABSENT', badgeClass: 'text-amber-600 bg-amber-100' },
            { label: 'Offline', val: offline, badge: 'IDLE', badgeClass: 'text-stone-400 bg-stone-100' },
          ].map(card => (
            <div key={card.label} className="bg-white p-6 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 transition-all duration-300">
              <p className="text-stone-500 text-xs font-semibold uppercase tracking-wider mb-2">{card.label}</p>
              <div className="flex items-end justify-between">
                <h3 className="text-3xl font-headline font-bold text-stone-900">{loading ? '…' : card.val}</h3>
                <span className={`px-2 py-1 rounded text-[10px] font-mono ${card.badgeClass}`}>{card.badge}</span>
              </div>
            </div>
          ))}
        </section>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Personnel Directory */}
          <section className="w-full lg:flex-1 lg:min-w-0 space-y-6">
            <div className="bg-white rounded-xl p-8 shadow-[0_8px_24px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)]">
              <div className="flex flex-wrap justify-between items-center gap-3 mb-8">
                <h2 className="text-xl font-headline font-bold text-stone-900">Personnel Directory</h2>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-[18px] pointer-events-none">search</span>
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      type="text"
                      placeholder="Search employees…"
                      className="bg-[#f0f3ff] border-none rounded-full pl-9 pr-4 py-2 text-sm font-medium text-stone-700 w-56 focus:ring-2 focus:ring-[#A8CD62] focus:bg-white transition-all"
                    />
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowDownloadMenu(v => !v)}
                      className="p-2 rounded-full hover:bg-[#f0f3ff] transition-colors"
                      aria-label="Download"
                    >
                      <span className="material-symbols-outlined text-stone-500">download</span>
                    </button>
                    {showDownloadMenu && (
                      <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-stone-100 z-50 overflow-hidden">
                        <button
                          type="button"
                          onClick={exportCsv}
                          className="w-full text-left px-4 py-3 text-sm font-semibold text-stone-700 hover:bg-[#f0f3ff] transition-colors flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[18px] text-stone-500">description</span> Export as CSV
                        </button>
                        <button
                          type="button"
                          onClick={exportXlsx}
                          className="w-full text-left px-4 py-3 text-sm font-semibold text-stone-700 hover:bg-[#f0f3ff] transition-colors flex items-center gap-2 border-t border-stone-100"
                        >
                          <span className="material-symbols-outlined text-[18px] text-stone-500">table_view</span> Export as Excel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-y-4">
                  <thead>
                    <tr className="text-stone-400 text-xs font-label uppercase tracking-widest">
                      <th className="px-4 py-2 font-semibold">Employee</th>
                      <th className="px-4 py-2 font-semibold">ID Code</th>
                      <th className="px-4 py-2 font-semibold text-center">Type</th>
                      <th className="px-4 py-2 font-semibold text-right">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={4} className="px-4 py-12 text-center text-stone-400 text-sm">Loading…</td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-12 text-center text-stone-400 text-sm">No employees found</td></tr>
                    ) : (
                      filtered.map(emp => {
                        const initials = (emp.fullName || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                        const joined = emp.createdAt ? new Date(emp.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
                        return (
                          <tr key={emp._id} className="group cursor-pointer">
                            <td className="px-4 py-3 bg-[#F0F3FF]/50 rounded-l-xl group-hover:bg-[#F0F3FF] transition-colors">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg bg-[#a8cd62] flex items-center justify-center font-bold text-[#3c5600] text-sm">{initials}</div>
                                <div>
                                  <p className="font-bold text-sm leading-tight text-stone-900">{emp.fullName || '—'}</p>
                                  <p className="text-stone-500 text-xs mt-0.5">{emp.role || 'Employee'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 bg-[#F0F3FF]/50 group-hover:bg-[#F0F3FF] transition-colors">
                              <span className="font-mono text-xs font-bold px-2 py-1 rounded text-stone-600 bg-white">{emp.employeeId || '—'}</span>
                            </td>
                            <td className="px-4 py-3 bg-[#F0F3FF]/50 group-hover:bg-[#F0F3FF] transition-colors text-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-tighter bg-[#A8CD62] text-stone-900">{emp.employeeType || 'Office'}</span>
                            </td>
                            <td className="px-4 py-3 bg-[#F0F3FF]/50 rounded-r-xl group-hover:bg-[#F0F3FF] transition-colors text-right">
                              <span className="font-mono text-sm font-bold text-stone-900">{joined}</span>
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

          {/* Attendance Donut */}
          <aside className="w-full lg:w-80 lg:flex-shrink-0 space-y-8">
            <div className="bg-[#2A313D] rounded-xl p-8">
              <h3 className="text-lg font-headline font-bold text-white mb-6">Team Attendance</h3>
              <div className="relative flex justify-center items-center py-4">
                <svg className="w-48 h-48 -rotate-90" viewBox="0 0 192 192">
                  <circle cx="96" cy="96" fill="transparent" r="80" stroke="#4B5563" strokeWidth="18" />
                  <circle
                    cx="96" cy="96" fill="transparent" r="80"
                    stroke="#A8CD62"
                    strokeDasharray={circumference}
                    strokeDashoffset={presentOffset}
                    strokeWidth="18"
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="font-headline font-extrabold text-4xl text-[#A8CD62] leading-none">{presentPct}%</span>
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-1">Attendance</span>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <div className="flex justify-between items-center text-xs text-white/70">
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#A8CD62] inline-block" /> Present</span>
                  <span className="font-mono font-bold text-white">{String(present).padStart(2, '0')}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-white/70">
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-stone-400 inline-block" /> Absent</span>
                  <span className="font-mono font-bold text-white">{String(absent).padStart(2, '0')}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <AddEmployeeModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={handleEmployeeCreated}
      />
    </div>
  );
}
