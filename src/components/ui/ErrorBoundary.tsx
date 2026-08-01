import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Shown above the message so the reader knows which part failed. */
  label?: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors so one broken view cannot blank the whole archive — the exact
 * failure mode the legacy single-file build suffered from. The reader keeps working
 * navigation and an explicit recovery action.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Big Blue Archive] render error', error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="error-boundary">
        <div className="error-boundary__card">
          <h1>{this.props.label ?? 'Something went wrong'}</h1>
          <p>
            This section failed to render. The rest of the archive is unaffected — you can retry
            this view or navigate elsewhere.
          </p>
          <pre>{error.message}</pre>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn btn--primary" onClick={this.reset}>
              Retry this view
            </button>
            <button type="button" className="btn" onClick={() => window.location.reload()}>
              Reload the archive
            </button>
          </div>
        </div>
      </div>
    );
  }
}
