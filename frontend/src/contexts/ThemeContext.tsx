import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────

export type Portal = 'employee' | 'admin' | 'auth';

interface ThemeContextValue {
  portal:    Portal;
  setPortal: (p: Portal) => void;
}

// ─── Context ───────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [portal, setPortalState] = useState<Portal>('auth');

  const setPortal = useCallback((p: Portal) => {
    setPortalState(p);

    const html = document.documentElement;

    /**
     * Three-way CSS variable selector switch.
     * Each portal removes the other portals' classes before adding its own:
     *
     *   admin    → no extra class  (:root vars — blue-tinted light)
     *   employee → html.dark       (employee vars — green-tinted light)
     *   auth     → html.auth       (auth vars — true dark jungle aesthetic)
     */
    html.classList.remove('dark', 'auth');

    if (p === 'employee') html.classList.add('dark');
    if (p === 'auth')     html.classList.add('auth');
  }, []);

  return (
    <ThemeContext.Provider value={{ portal, setPortal }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
