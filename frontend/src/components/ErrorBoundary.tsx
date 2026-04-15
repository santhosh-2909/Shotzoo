import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Errors thrown by a lazy() chunk that 404'd after a deploy. The only way
// to recover is a full page reload so the browser re-fetches index.html.
function isChunkLoadError(error: Error | null): boolean {
  if (!error) return false;
  const msg = error.message ?? '';
  return /dynamically imported module|Failed to fetch dynamically|ChunkLoadError|Loading chunk \d+ failed/i.test(msg);
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ShotZoo] Unhandled error:', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      // Stale chunk after a deploy — offer a proper reload, not a retry.
      if (isChunkLoadError(this.state.error)) {
        return (
          <div className="flex min-h-screen items-center justify-center bg-surface p-8">
            <div className="max-w-md text-center">
              <span className="material-symbols-outlined text-5xl text-primary-container">sync</span>
              <h1 className="mt-4 text-2xl font-bold font-headline text-on-surface">
                App Updated
              </h1>
              <p className="mt-2 text-sm text-on-surface-variant">
                A newer version of ShotZoo is available. Reload the page to get the latest build.
              </p>
              <button
                className="mt-6 rounded-xl bg-primary-container px-6 py-3 font-bold text-on-primary-container"
                onClick={() => globalThis.location.reload()}
              >
                Reload
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-surface p-8">
          <div className="max-w-md text-center">
            <span className="material-symbols-outlined text-5xl text-error">error</span>
            <h1 className="mt-4 text-2xl font-bold font-headline text-on-surface">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm text-on-surface-variant">
              {this.state.error?.message ?? 'An unexpected error occurred.'}
            </p>
            <button
              className="mt-6 rounded-xl bg-primary-container px-6 py-3 font-bold text-on-primary-container"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
