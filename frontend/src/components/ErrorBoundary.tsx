import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
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
