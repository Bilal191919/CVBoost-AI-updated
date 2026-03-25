import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children?: ReactNode;
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
      let isFirestoreError = false;

      try {
        const parsedError = JSON.parse(errorMessage);
        if (parsedError && parsedError.error && parsedError.operationType) {
          isFirestoreError = true;
          errorMessage = `Database Error (${parsedError.operationType}): ${parsedError.error}`;
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-xl border border-red-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 to-red-600"></div>
            <div className="flex items-center gap-4 text-red-600 mb-6 mt-2">
              <div className="bg-red-50 p-3 rounded-2xl shadow-sm">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-bold font-display tracking-tight text-slate-900">Something went wrong</h1>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6 font-mono text-sm text-slate-700 overflow-auto max-h-48 shadow-inner">
              {errorMessage}
            </div>

            {isFirestoreError && (
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                This looks like a database permissions issue. Please ensure you are logged in and have the correct permissions.
              </p>
            )}

            <button
              onClick={() => window.location.reload()}
              className="w-full bg-slate-900 text-white py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors shadow-sm"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
