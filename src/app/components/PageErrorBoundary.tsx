import { Component, type ReactNode } from "react";
import { RotateCw } from "lucide-react";
import { EmptyState } from "@/shared/ui";
import { reportAppError } from "@/shared/error-reporting";
import { useT } from "../i18n/LanguageContext";

/**
 * PageErrorBoundary — isolates a single page's render crash.
 *
 * Without it, a throw inside any page bubbles to the router's root error
 * boundary and replaces the ENTIRE app with the full-screen 500 screen (nav,
 * coach, everything gone). Here the shell survives: only the page area shows a
 * retryable fallback, so "one broken request" never takes down the whole app
 * (reliability requirement). It auto-resets when `resetKey` changes — i.e. the
 * user navigating to another page clears a stuck error with no reload.
 */
interface Props {
  children: ReactNode;
  /** Changing this value resets the boundary (we pass the current page id). */
  resetKey: string;
}
interface State {
  error: Error | null;
}

function PageErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useT();
  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <EmptyState
        title={t("error.pageTitle")}
        description={t("error.pageBody")}
        action={
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/25 hover:brightness-110 transition-all"
          >
            <RotateCw className="w-4 h-4" /> {t("error.retry")}
          </button>
        }
      />
    </div>
  );
}

export default class PageErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    reportAppError(error, { boundary: "page_error_boundary", page: this.props.resetKey });
  }

  componentDidUpdate(prev: Props) {
    // A navigation (resetKey change) clears a stuck page error automatically.
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return <PageErrorFallback onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}
