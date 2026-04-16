import { useCallback, useEffect, useRef, useState } from 'react';
import { notifApi } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';

interface Toast {
  id: string;
  title: string;
  message: string;
}

interface ApiNotif {
  _id: string;
  title: string;
  message: string;
  createdAt: string;
  read?: boolean;
}

interface ListResponse {
  notifications?: ApiNotif[];
}

const POLL_MS   = 30_000;
const TOAST_MS  = 4_000;
const MAX_STACK = 3;

export default function NotificationToaster() {
  const { token } = useAuth();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seenIds     = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    if (!token) {
      // Reset on logout so next login starts clean.
      seenIds.current = new Set();
      initialized.current = false;
      setToasts([]);
      return;
    }
    let cancelled = false;

    async function fetchOnce() {
      try {
        const data = (await notifApi.list()) as ListResponse;
        if (cancelled) return;
        const items = data.notifications ?? [];

        if (!initialized.current) {
          for (const n of items) seenIds.current.add(n._id);
          initialized.current = true;
          return;
        }

        const fresh: Toast[] = [];
        for (const n of items) {
          if (!seenIds.current.has(n._id)) {
            seenIds.current.add(n._id);
            fresh.push({ id: n._id, title: n.title, message: n.message });
          }
        }
        if (fresh.length) {
          setToasts(prev => [...prev, ...fresh].slice(-MAX_STACK));
          for (const t of fresh) {
            setTimeout(() => dismiss(t.id), TOAST_MS);
          }
        }
      } catch {
        /* silent */
      }
    }

    fetchOnce();
    const interval = setInterval(fetchOnce, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token, dismiss]);

  if (!toasts.length) return null;

  return (
    <div
      className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      <style>{`
        @keyframes szToastIn {
          from { transform: translateX(16px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
      {toasts.map(t => (
        <div
          key={t.id}
          role="status"
          className="pointer-events-auto w-80 rounded-2xl border-l-4 border-primary-container bg-white px-4 py-3 shadow-[0_10px_30px_rgba(21,28,39,0.15)]"
          style={{ animation: 'szToastIn 0.22s ease' }}
        >
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-primary-container mt-0.5">
              notifications_active
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-on-surface truncate">{t.title}</div>
              <div className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">{t.message}</div>
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
