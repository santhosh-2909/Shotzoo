import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import './styles/base.css';

// After a Vercel redeploy, Vite's hashed chunk filenames change and the old
// ones are removed from the CDN. Tabs that loaded the previous build 404 when
// they try to lazy-import a route. Catch the resulting vite:preloadError,
// swallow it (preventDefault) and reload once to pick up the new index.html.
// A timestamp guard prevents reload-loops on genuine errors.
globalThis.addEventListener('vite:preloadError', (event: Event) => {
  event.preventDefault();
  const key    = 'shotzoo_preload_reload_at';
  const lastAt = Number(sessionStorage.getItem(key) ?? '0');
  if (Date.now() - lastAt > 30_000) {
    sessionStorage.setItem(key, String(Date.now()));
    globalThis.location.reload();
  } else {
    console.error('[vite] preload error persisted after reload:', event);
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
