import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { notifApi } from '@/utils/api';

type FilterType = 'All' | 'Unread' | 'Announcement' | 'Reminder' | 'Alert' | 'Task Update';

interface Notif {
  id: string;
  type: string;
  title: string;
  message: string;
  from: string;
  time: string;
  createdAt: string;
  read: boolean;
  urgent: boolean;
}

interface TypeMeta {
  icon: string;
  cls: string;
}

const TYPE_META: Record<string, TypeMeta> = {
  'Announcement': { icon: 'campaign', cls: 'icon-blue' },
  'Reminder':     { icon: 'schedule', cls: 'icon-yellow' },
  'Alert':        { icon: 'warning', cls: 'icon-red' },
  'Task Update':  { icon: 'task_alt', cls: 'icon-green' },
  'System':       { icon: 'info', cls: 'icon-blue' },
  'Message':      { icon: 'mail', cls: 'icon-blue' },
  'Deadline':     { icon: 'schedule', cls: 'icon-yellow' },
  'Overdue':      { icon: 'warning', cls: 'icon-red' },
  'Completion':   { icon: 'task_alt', cls: 'icon-green' },
};

const DEFAULT_META: TypeMeta = { icon: 'notifications', cls: 'icon-blue' };

const PAGE_SIZE = 6;

function formatStamp(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const datePart = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return datePart + ', ' + timePart;
}

export default function Notifications() {
  const { setPortal } = useTheme();
  useEffect(() => { setPortal('employee'); }, [setPortal]);

  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [currentFilter, setCurrentFilter] = useState<FilterType>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API response
      const data = await notifApi.list() as any;
      const items: Notif[] = ((data.notifications || []) as {
        _id: string; type: string; title: string; message: string; createdAt: string; read?: boolean; urgent?: boolean;
      }[]).map(n => ({
        id: n._id,
        type: n.type,
        title: n.title,
        message: n.message,
        from: 'Admin',
        time: formatStamp(n.createdAt),
        createdAt: n.createdAt,
        read: !!n.read,
        urgent: !!n.urgent,
      }));
      setNotifs(items);
    } catch {
      setLoadError('Failed to load notifications. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const filteredList = currentFilter === 'All'
    ? notifs
    : currentFilter === 'Unread'
      ? notifs.filter(n => !n.read)
      : notifs.filter(n => n.type === currentFilter);

  const unreadCount = notifs.filter(n => !n.read).length;
  const totalPages = Math.max(1, Math.ceil(filteredList.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageItems = filteredList.slice(start, start + PAGE_SIZE);

  const handleRowClick = async (id: string) => {
    const n = notifs.find(x => x.id === id);
    if (n && !n.read) {
      setNotifs(prev => prev.map(x => x.id === id ? { ...x, read: true } : x));
      notifApi.markRead(id).catch(() => {});
    }
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleMarkAll = () => {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    notifApi.markAll().catch(() => {});
  };

  const handleFilterChange = (f: FilterType) => {
    setCurrentFilter(f);
    setCurrentPage(1);
  };

  const FILTERS: FilterType[] = ['All', 'Unread', 'Announcement', 'Reminder', 'Alert', 'Task Update'];

  return (
    <div className="animate-fade-in">
      <main className="px-12 pt-12 pb-20 max-w-5xl">
        {/* Top bar */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="font-headline text-5xl font-bold tracking-tighter text-on-surface">Notifications</h1>
            <p className="text-on-surface-variant mt-2 font-medium">Keep track of your latest updates and alerts.</p>
          </div>
          <button
            type="button"
            onClick={handleMarkAll}
            className="text-[#6B7280] hover:text-[#3C5600] font-bold text-sm transition-colors"
          >
            Mark All as Read
          </button>
        </div>

        {/* Unread badge hint */}
        {unreadCount > 0 && (
          <div className="mb-4 text-xs font-bold text-primary">
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </div>
        )}

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {FILTERS.map(f => (
            <button
              key={f}
              type="button"
              onClick={() => handleFilterChange(f)}
              className={currentFilter === f ? 'filter-pill active' : 'filter-pill'}
            >
              {f === 'Announcement' ? 'Announcements' : f === 'Task Update' ? 'Task Updates' : f}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white rounded-[20px] clay-shadow px-6 py-12 text-center text-sm text-[#6B7280]">Loading...</div>
        ) : loadError ? (
          <div className="bg-white rounded-[20px] clay-shadow px-6 py-12 text-center text-sm text-[#6B7280]">{loadError}</div>
        ) : filteredList.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16">
            <div className="w-40 h-40 mb-6 rounded-full bg-[#F0F2EA] flex items-center justify-center">
              <span className="material-symbols-outlined text-6xl text-[#A8CD62]">notifications_off</span>
            </div>
            <h3 className="font-headline text-2xl font-bold text-on-surface mb-2">No notifications yet</h3>
            <p className="text-[#6B7280] max-w-sm font-medium">When you get new announcements or alerts, they will show up here.</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-[20px] clay-shadow overflow-hidden">
              {pageItems.map(n => {
                const meta = TYPE_META[n.type] || DEFAULT_META;
                const isOpen = expanded[n.id];
                return (
                  <div
                    key={n.id}
                    onClick={() => handleRowClick(n.id)}
                    className={[
                      'notif-row',
                      !n.read ? 'unread' : '',
                      n.urgent ? 'urgent' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <div className={`icon-circle ${meta.cls}`}>
                      <span className="material-symbols-outlined">{meta.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[15px] text-on-surface">{n.title}</div>
                      {isOpen ? (
                        <>
                          <div className="text-[13px] font-bold text-[#3C5600] mt-2">{formatStamp(n.createdAt)}</div>
                          <div className="text-sm text-[#444939] mt-2 leading-relaxed whitespace-pre-wrap">{n.message}</div>
                        </>
                      ) : (
                        <div className="truncate-1 text-sm text-[#6B7280] mt-1">{n.message}</div>
                      )}
                      <div className="text-xs text-[#6B7280] mt-2 font-semibold">From {n.from} &bull; {n.time}</div>
                    </div>
                    {!n.read && <div className="unread-dot" title="Unread" />}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-6">
              <span className="text-sm text-[#6B7280] font-semibold">
                Showing {start + 1}–{Math.min(start + PAGE_SIZE, filteredList.length)} of {filteredList.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-bold text-[#6B7280] hover:bg-[#F7F8F4] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-bold text-[#6B7280] hover:bg-[#F7F8F4] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
