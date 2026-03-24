import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = this.state.error?.message || 'An unexpected error occurred.';
      try {
        const parsedError = JSON.parse(errorMessage);
        if (parsedError.error) {
          errorMessage = parsedError.error;
        }
      } catch (e) {
        // Not a JSON error, keep original message
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-nude)] p-4">
          <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-[var(--color-nude-dark)] text-center">
            <h2 className="text-2xl font-serif text-[var(--color-terracotta)] mb-4">Ops, algo deu errado.</h2>
            <p className="text-[var(--color-ink-light)] mb-6">{errorMessage}</p>
            <button
              className="px-6 py-2 bg-[var(--color-sage)] text-white rounded-full hover:bg-[var(--color-sage-dark)] transition-colors"
              onClick={() => window.location.reload()}
            >
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
