import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  componentName?: string;
  resetKeys?: any[];
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
    console.error(`[ErrorBoundary:${this.props.componentName || 'Component'}] caught an error:`, error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && this.props.resetKeys && prevProps.resetKeys) {
      const hasChanged = this.props.resetKeys.some(
        (key, idx) => key !== prevProps.resetKeys?.[idx]
      );
      if (hasChanged) {
        this.reset();
      }
    }
  }

  private isComponentMounted = false;

  componentDidMount(): void {
    this.isComponentMounted = true;
  }

  componentWillUnmount(): void {
    this.isComponentMounted = false;
  }

  reset = (): void => {
    const nextState = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
    this.state = nextState;
    if (this.isComponentMounted) {
      this.setState(nextState);
    }
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error, this.reset);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const componentName = this.props.componentName || 'Component';

      return (
        <div className="bg-red-50/70 border border-red-200 rounded-xl p-6 my-4 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-red-100 rounded-lg text-red-600 flex-shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-red-900 mb-1" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                Error in {componentName}
              </h3>
              <p className="text-sm text-red-700 mb-3">
                {this.state.error.message || 'An unexpected error occurred during rendering.'}
              </p>

              {this.state.errorInfo?.componentStack && (
                <details className="mt-2 mb-4">
                  <summary className="text-xs text-red-600 font-medium cursor-pointer hover:underline mb-2">
                    View technical stack trace
                  </summary>
                  <pre className="text-xs font-mono bg-red-100/80 text-red-900 p-3 rounded-lg overflow-x-auto max-h-48 whitespace-pre-wrap">
                    {this.state.error.stack || this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}

              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={this.reset}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded-lg flex items-center gap-2 transition-colors shadow-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Try Again
                </button>
                <button
                  onClick={() => {
                    window.location.href = '/';
                  }}
                  className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Home className="w-3.5 h-3.5" />
                  Return to Home
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
