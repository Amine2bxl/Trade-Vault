import { Component, type ReactNode } from "react";
import { reportAppError } from "@/shared/error-reporting";

/**
 * PageErrorBoundary — silences a single page's render crash so the shell
 * (nav, coach, sidebar) survives and the user can navigate elsewhere.
 *
 * Instead of showing a scary error card, it logs the error and renders
 * nothing in the content area — the user sees the shell and can click
 * another nav item to move on. A navigation (resetKey change) clears
 * the error automatically.
 */
interface Props {
  children: ReactNode;
  resetKey: string;
  /** Optional fallback to render instead of nothing. Defaults to null. */
  fallback?: ReactNode;
}
interface State {
  error: Error | null;
}

export default class PageErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    reportAppError(error, { boundary: "page_error_boundary", page: this.props.resetKey });
    // Auto-recover after 2 seconds — the page will re-render and might
    // work (e.g. a transient Supabase connection issue resolved itself).
    setTimeout(() => {
      if (this.state.error) this.setState({ error: null });
    }, 2000);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      // Render nothing — the shell (nav, sidebar, coach) stays visible
      // and the user can navigate away. No scary messages.
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
