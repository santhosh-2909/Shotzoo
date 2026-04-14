import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { adminApi, uploadUrl } from '@/utils/api';

type NotifType = 'Announcement' | 'Reminder' | 'Alert' | 'Task Update';

interface EmployeeLite {
  id: string;
  name: string;
  employeeId: string;
  avatar: string;
}

interface SentGroup {
  type: NotifType;
  title: string;
  message: string;
  audience: 'All' | 'Some';
  recipientCount: number;
  recipientNames?: string[];
  urgent?: boolean;
  createdAt: string;
}

const TYPE_BADGE: Record<NotifType, string> = {
  'Announcement': 'badge-blue',
  'Reminder':     'badge-yellow',
  'Alert':        'badge-red',
  'Task Update':  'badge-green',
};

function formatAt(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const datePart = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timePart = d.toLocaleTimeString('en-US',  { hour: 'numeric', minute: '2-digit', hour12: true });
  return datePart + ', ' + timePart;
}

export default function SendNotification() {
  const { setPortal } = useTheme();
  useEffect(() => { setPortal('admin'); }, [setPortal]);

  const [employees,    setEmployees]    = useState<EmployeeLite[]>([]);
  const [history,      setHistory]      = useState<SentGroup[]>([]);
  const [sendToAll,    setSendToAll]    = useState(true);
  const [selected,     setSelected]     = useState<Record<string, boolean>>({});
  const [search,       setSearch]       = useState('');
  const [notifType,    setNotifType]    = useState<NotifType>('Announcement');
  const [title,        setTitle]        = useState('');
  const [message,      setMessage]      = useState('');
  const [isUrgent,     setIsUrgent]     = useState(false);
  const [schLater,     setSchLater]     = useState(false);
  const [schDate,      setSchDate]      = useState('');
  const [schTime,      setSchTime]      = useState('');
  const [sending,      setSending]      = useState(false);
  const [formError,    setFormError]    = useState('');
  const [successMsg,   setSuccessMsg]   = useState('');
  const [slideOpen,    setSlideOpen]    = useState(false);
  const [slideIdx,     setSlideIdx]     = useState<number | null>(null);

  const loadEmployees = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- shape from API
      const d = await adminApi.employees() as any;
      const list: EmployeeLite[] = ((d.employees || []) as any[]).map((u) => ({
        id:         u._id,
        name:       u.fullName || 'Unnamed',
        employeeId: u.employeeId || '',
        avatar:     u.photo ? uploadUrl(u.photo) : '',
      }));
      setEmployees(list);
    } catch (err) {
      console.error('[SendNotification] loadEmployees failed:', err);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- shape from API
      const d = await adminApi.notifications() as any;
      setHistory((d.groups || []) as SentGroup[]);
    } catch (err) {
      console.error('[SendNotification] loadHistory failed:', err);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
    loadHistory();
  }, [loadEmployees, loadHistory]);

  const filteredEmployees = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter(e => e.name.toLowerCase().includes(q));
  }, [employees, search]);

  const selectedIds = Object.keys(selected);
  const selectedCount = selectedIds.length;

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  };

  const removeChip = (id: string) => {
    setSelected(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleSend = async () => {
    setFormError(''); setSuccessMsg('');
    const t = title.trim(), m = message.trim();
    if (!t) { setFormError('Please enter a notification title.'); return; }
    if (!m) { setFormError('Please enter a message.'); return; }
    if (!sendToAll && selectedCount === 0) { setFormError('Please select at least one employee.'); return; }

    const userIds = sendToAll ? [] : selectedIds;
    const payload = { userIds, title: t, message: m, type: notifType, urgent: isUrgent };

    setSending(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- shape from API
      const d = await adminApi.notify(payload) as any;
      setSuccessMsg('Notification sent to ' + (d.sent ?? 0) + ' employee(s).');
      setTitle(''); setMessage(''); setSelected({});
      loadHistory();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const handleDraft = () => {
    setFormError('Draft saving is not yet wired to the backend.');
  };

  const openSlide = (i: number) => { setSlideIdx(i); setSlideOpen(true); };
  const closeSlide = () => { setSlideOpen(false); setSlideIdx(null); };

  const slideData = slideIdx !== null ? history[slideIdx] : null;

  const typeBadgeClass = (t: string) => TYPE_BADGE[t as NotifType] || 'badge-grey';

  return (
    <div className="animate-fade-in">
      <header className="mb-6">
        <h1 className="text-4xl font-extrabold tracking-tighter text-on-surface font-headline">Send Notification</h1>
        <p className="text-[#6B7280] mt-2 font-medium">Send announcements, reminders, or alerts to your team</p>
      </header>

      <div className="max-w-5xl space-y-8 pb-20">
        {/* Recipient Selection */}
        <section className="clay-card p-8">
          <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant block mb-3">Send To</label>
          <div className="flex gap-3 mb-5">
            <button type="button" className={sendToAll ? 'pill active' : 'pill'} onClick={() => setSendToAll(true)}>All Employees</button>
            <button type="button" className={!sendToAll ? 'pill active' : 'pill'} onClick={() => setSendToAll(false)}>Select Employees</button>
          </div>

          {sendToAll ? (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#DCFCE7] border border-[#A8CD62]/30">
              <span className="material-symbols-outlined text-[#166534] text-[20px]">check_circle</span>
              <span className="text-sm font-semibold text-[#166534]">This notification will be sent to all {employees.length} employees</span>
            </div>
          ) : (
            <div>
              <div className="relative mb-3">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-[20px]">search</span>
                <input
                  className="soft-input pl-10"
                  placeholder="Search employees..."
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Selected</span>
                <span className="px-3 py-1 rounded-full bg-[#A8CD62]/20 text-[#3C5600] text-xs font-bold">{selectedCount} selected</span>
              </div>
              <div className="flex flex-wrap gap-2 min-h-[40px] p-3 bg-[#F0F2EA] rounded-xl mb-3">
                {selectedIds.length === 0 ? (
                  <span className="text-xs text-[#6B7280] self-center">No employees selected</span>
                ) : (
                  selectedIds.map(id => {
                    const e = employees.find(x => x.id === id);
                    if (!e) return null;
                    const initial = (e.name[0] || '?').toUpperCase();
                    return (
                      <span key={id} className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full pl-1 pr-2 py-1 shadow-sm">
                        {e.avatar
                          ? <img src={e.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                          : <div className="w-6 h-6 rounded-full bg-[#A8CD62]/20 text-[#3C5600] flex items-center justify-center text-[10px] font-bold">{initial}</div>
                        }
                        <span className="text-xs font-semibold">{e.name}</span>
                        <button type="button" onClick={() => removeChip(id)} className="text-[#6B7280] hover:text-[#EF4444] ml-1" aria-label={`Remove ${e.name}`}>
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </span>
                    );
                  })
                )}
              </div>
              <div className="max-h-72 overflow-y-auto border border-gray-100 rounded-xl divide-y">
                {filteredEmployees.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-[#6B7280]">No employees found</div>
                ) : (
                  filteredEmployees.map(e => {
                    const initial = (e.name[0] || '?').toUpperCase();
                    const checked = !!selected[e.id];
                    return (
                      <label key={e.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#F7F8F4] transition-colors">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelect(e.id)}
                          className="w-4 h-4 rounded text-[#A8CD62] focus:ring-[#A8CD62] border-gray-300"
                        />
                        {e.avatar
                          ? <img src={e.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                          : <div className="w-8 h-8 rounded-full bg-[#A8CD62]/20 text-[#3C5600] flex items-center justify-center text-xs font-bold">{initial}</div>
                        }
                        <span className="text-sm font-semibold">{e.name}</span>
                        {e.employeeId && <span className="text-xs text-[#6B7280] ml-auto">{e.employeeId}</span>}
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </section>

        {/* Notification Details */}
        <section className="clay-card p-8 space-y-6">
          <h3 className="text-lg font-bold text-on-surface">Notification Details</h3>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant block mb-3">Notification Type</label>
            <div className="flex flex-wrap gap-2">
              {(['Announcement', 'Reminder', 'Alert', 'Task Update'] as NotifType[]).map(t => {
                const active = notifType === t;
                const cls = active ? TYPE_BADGE[t] : 'inactive';
                return (
                  <button key={t} type="button" className={`type-pill ${cls}`} onClick={() => setNotifType(t)}>
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="notif-title" className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Title</label>
            <input id="notif-title" className="soft-input" type="text" placeholder="e.g. Team Meeting at 3PM"
              value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div>
            <label htmlFor="notif-message" className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Message</label>
            <textarea id="notif-message" className="soft-textarea" rows={4} placeholder="Write your message here..."
              value={message} onChange={e => setMessage(e.target.value)} />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant block mb-3">Priority</label>
            <div className="flex gap-3">
              <button type="button" className={!isUrgent ? 'pill active' : 'pill'} onClick={() => setIsUrgent(false)}>Normal</button>
              <button type="button" className={isUrgent  ? 'pill active' : 'pill'} onClick={() => setIsUrgent(true)}>Urgent</button>
            </div>
          </div>
        </section>

        {/* Schedule */}
        <section className="clay-card p-8">
          <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant block mb-3">Schedule</label>
          <div className="flex gap-3 mb-5">
            <button type="button" className={!schLater ? 'pill active' : 'pill'} onClick={() => setSchLater(false)}>Send Now</button>
            <button type="button" className={schLater  ? 'pill active' : 'pill'} onClick={() => setSchLater(true)}>Schedule Later</button>
          </div>
          {schLater && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="sch-date" className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Date</label>
                <input id="sch-date" className="soft-input" type="date" value={schDate} onChange={e => setSchDate(e.target.value)} />
              </div>
              <div>
                <label htmlFor="sch-time" className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Time</label>
                <input id="sch-time" className="soft-input" type="time" value={schTime} onChange={e => setSchTime(e.target.value)} />
              </div>
            </div>
          )}
        </section>

        {formError && (
          <div className="px-5 py-3 rounded-2xl bg-error-container text-on-error-container font-semibold text-sm">
            {formError}
          </div>
        )}
        {successMsg && (
          <div className="px-5 py-3 rounded-2xl bg-[#DCFCE7] text-[#166534] font-semibold text-sm flex items-center gap-2">
            <span className="material-symbols-outlined">check_circle</span>
            {successMsg}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col md:flex-row gap-3">
          <button type="button" disabled={sending} onClick={handleSend} className="flex-1 bg-[#A8CD62] hover:brightness-110 active:scale-[0.99] transition-all text-[#131F00] font-extrabold text-sm uppercase tracking-wider px-8 h-[56px] rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-[#A8CD62]/30 disabled:opacity-60 disabled:cursor-not-allowed">
            <span className="material-symbols-outlined">{sending ? 'progress_activity' : 'send'}</span>
            <span>{sending ? 'Sending...' : 'Send Notification'}</span>
          </button>
          <button type="button" onClick={handleDraft} className="md:flex-none px-8 h-[56px] rounded-2xl border-2 border-[#A8CD62] text-[#3C5600] font-bold hover:bg-[#A8CD62]/5 transition-all">
            Save as Draft
          </button>
        </div>

        {/* History Table */}
        <div className="mt-16">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-2xl font-extrabold tracking-tighter text-on-surface font-headline">Sent Notifications</h2>
            <span className="px-3 py-1 rounded-full bg-[#A8CD62]/20 text-[#3C5600] text-xs font-bold">{history.length}</span>
          </div>
          <div className="clay-card overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-[#F0F2EA] text-[11px] uppercase tracking-widest text-[#6B7280] font-bold">
                <tr>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Title</th>
                  <th className="px-6 py-4">Sent To</th>
                  <th className="px-6 py-4">Sent At</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {history.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-[#6B7280]">No notifications sent yet.</td></tr>
                ) : (
                  history.map((h, i) => {
                    const to = h.audience === 'All'
                      ? 'All Employees'
                      : h.recipientCount + ' Employee' + (h.recipientCount === 1 ? '' : 's');
                    return (
                      <tr key={i} className="hover:bg-[#F7F8F4] cursor-pointer" onClick={() => openSlide(i)}>
                        <td className="px-6 py-4"><span className={`type-badge ${typeBadgeClass(h.type)}`}>{h.type}</span></td>
                        <td className="px-6 py-4 font-semibold">
                          {h.title}
                          {h.urgent && <span className="ml-1 inline-block px-1.5 py-0.5 bg-[#FEE2E2] text-[#991B1B] text-[10px] font-bold rounded">URGENT</span>}
                        </td>
                        <td className="px-6 py-4 text-[#6B7280]">{to}</td>
                        <td className="px-6 py-4 text-[#6B7280]">{formatAt(h.createdAt)}</td>
                        <td className="px-6 py-4"><span className="status-badge status-delivered">Delivered</span></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Slide-over */}
      {slideOpen && slideData && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={closeSlide} />
          <aside className="fixed top-0 right-0 h-screen w-full max-w-md bg-white z-50 shadow-2xl flex flex-col slide-over open">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h3 className="text-lg font-bold">Notification Details</h3>
              <button type="button" aria-label="Close details" className="p-2 hover:bg-gray-100 rounded-full" onClick={closeSlide}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div>
                <span className={`type-badge ${typeBadgeClass(slideData.type)}`}>{slideData.type}</span>
                {slideData.urgent && <span className="ml-2 inline-block px-2 py-1 bg-[#FEE2E2] text-[#991B1B] text-[10px] font-bold rounded">URGENT</span>}
              </div>
              <h2 className="text-2xl font-extrabold tracking-tighter">{slideData.title}</h2>
              <div className="text-xs text-[#6B7280] font-semibold">{formatAt(slideData.createdAt)}</div>
              <div className="bg-[#F7F8F4] rounded-2xl p-5 text-sm leading-relaxed text-[#1a1c15] whitespace-pre-wrap">{slideData.message}</div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-[#6B7280] mb-2">Recipients</div>
                <div className="text-sm font-semibold">
                  {slideData.audience === 'All'
                    ? 'All ' + slideData.recipientCount + ' employees'
                    : (slideData.recipientNames && slideData.recipientNames.length
                        ? slideData.recipientNames.join(', ')
                        : slideData.recipientCount + ' employees')}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-[#6B7280] mb-2">Status</div>
                <span className="status-badge status-delivered">Delivered</span>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
