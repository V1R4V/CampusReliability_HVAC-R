/*
 * RouteErrorBoundary — keeps one page's render error from blanking the whole app.
 *
 * The template's ErrorReporterProvider only *reports* errors; it is not a React error
 * boundary. This class catches render/lazy-load errors below it, shows the standard
 * PanelState error with a Retry, and forwards the error to Genesis the same way the
 * provider does. Give it `key={location.pathname}` so navigating away resets it.
 */

import React from 'react';

import { PanelState } from '@/components/Panel/Panel';

interface RouteErrorBoundaryProps {
  /** Shown in the error headline, e.g. "This page". */
  name?: string;
  children: React.ReactNode;
}

interface RouteErrorBoundaryState {
  error: Error | null;
}

export default class RouteErrorBoundary extends React.Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error): void {
    window.parent?.postMessage(
      {
        type: 'GENESIS_ERROR_REPORT',
        payload: {
          message: error.message,
          stack: error.stack,
          file: 'RouteErrorBoundary',
          line: 0,
          column: 0,
          timestamp: new Date().toISOString(),
        },
      },
      '*',
    );
  }

  render(): React.ReactNode {
    const { error } = this.state;
    if (error) {
      return (
        <div className="p-6">
          <PanelState
            state="error"
            title={`${this.props.name ?? 'This page'} couldn’t render`}
            message={error.message}
            onRetry={() => this.setState({ error: null })}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
