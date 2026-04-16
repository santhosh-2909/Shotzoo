import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface LogoutModalProps {
  onClose: () => void;
}

/**
 * Centered confirmation modal for logging out.
 * Mirrors the vanilla JS confirmLogout() in the original api.js.
 */
export default function LogoutModal({ onClose }: LogoutModalProps) {
  const { logout, isAdmin } = useAuth();
  const navigate   = useNavigate();

  const handleConfirm = useCallback(() => {
    const target = isAdmin ? '/admin/signin' : '/signin';
    onClose();
    navigate(target, { replace: true });
    logout();
  }, [logout, navigate, onClose, isAdmin]);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="logout-title"
        className="w-full max-w-[420px] rounded-3xl bg-white p-8 text-center shadow-[0_25px_60px_rgba(0,0,0,0.25)]"
        style={{ animation: 'szPop 0.22s ease' }}
      >
        <style>{`
          @keyframes szPop {
            from { transform: scale(0.92); opacity: 0; }
            to   { transform: scale(1);    opacity: 1; }
          }
        `}</style>

        {/* Icon */}
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <span className="material-symbols-outlined text-3xl text-red-500">logout</span>
        </div>

        {/* Heading */}
        <h2
          id="logout-title"
          className="mb-2 font-headline text-2xl font-extrabold tracking-tight text-[#151c27]"
        >
          Log Out?
        </h2>
        <p className="mb-6 text-sm leading-relaxed text-gray-500">
          Are you sure you want to log out of your account?
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border-2 border-gray-200 bg-white py-3.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 rounded-2xl border-none bg-primary-container py-3.5 text-sm font-extrabold text-on-primary-container shadow-[0_4px_12px_rgba(168,205,98,0.35)] transition-all hover:brightness-105"
          >
            Yes, Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
