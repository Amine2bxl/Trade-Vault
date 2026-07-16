import { useCallback, useEffect, useState } from "react";
import { Star, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useT } from "../i18n/LanguageContext";
import {
  loadTrustpilotState,
  markTrustpilotPrompted,
  saveTrustpilotStatus,
  type TrustpilotState,
} from "../store";
import { TRUSTPILOT_REVIEW_URL, type Page } from "../types";
import { cn } from "../utils/cn";

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const TRADE_THRESHOLD = 20;

/**
 * Discreet Trustpilot review nudge.
 *
 * Golden rule: never interrupts an active flow — hidden while a modal is open
 * or on the pre-market checklist page.
 *
 * Triggers (any): ≥20 logged trades, or the `tv:trustpilot-nudge` event fired
 * when the user views a positive monthly report.
 *
 * Respect: `trustpilot_status` on the profile is terminal — once the user
 * rates or dismisses, the prompt never comes back. Otherwise a shown prompt
 * re-arms at most once every 14 days (`trustpilot_prompted_at`).
 */
export default function TrustpilotPrompt({
  tradeCount,
  page,
  modalOpen,
}: {
  tradeCount: number;
  page: Page;
  modalOpen: boolean;
}) {
  const { user } = useAuth();
  const { t } = useT();
  const [state, setState] = useState<TrustpilotState | null>(null);
  const [nudged, setNudged] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    loadTrustpilotState(user.id)
      .then((s) => {
        if (active) setState(s);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.id]);

  // Positive monthly report viewed → immediate eligibility.
  useEffect(() => {
    const onNudge = () => setNudged(true);
    window.addEventListener("tv:trustpilot-nudge", onNudge);
    return () => window.removeEventListener("tv:trustpilot-nudge", onNudge);
  }, []);

  useEffect(() => {
    if (!user || !state || visible) return;
    if (state.status) return; // rated or dismissed — never again
    const cooledDown =
      !state.promptedAt || Date.now() - new Date(state.promptedAt).getTime() > TWO_WEEKS_MS;
    if (!cooledDown) return;
    if (!(nudged || tradeCount >= TRADE_THRESHOLD)) return;
    setVisible(true);
    // Stamp the ask so an ignored banner respects the 14-day cool-down.
    markTrustpilotPrompted(user.id).catch(() => {});
    setState((s) => (s ? { ...s, promptedAt: new Date().toISOString() } : s));
  }, [user, state, nudged, tradeCount, visible]);

  const close = useCallback(
    (status: "rated" | "dismissed") => {
      setVisible(false);
      setState((s) => (s ? { ...s, status } : s));
      if (user) saveTrustpilotStatus(user.id, status).catch(() => {});
    },
    [user],
  );

  const rate = useCallback(() => {
    window.open(TRUSTPILOT_REVIEW_URL, "_blank", "noopener,noreferrer");
    close("rated");
  }, [close]);

  // Golden rule: invisible during active flows.
  if (!visible || modalOpen || page === "checklist") return null;

  return (
    <div
      role="dialog"
      aria-label={t("trustpilot.title")}
      className={cn(
        "fixed z-[80] left-4 right-4 md:left-auto md:right-6 md:w-[360px]",
        "bottom-[calc(env(safe-area-inset-bottom,0px)+96px)] md:bottom-6",
        "glass-strong rounded-2xl border border-emerald-500/20 shadow-2xl shadow-black/50 p-4 animate-slide-up",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shrink-0">
          <Star className="w-5 h-5 text-emerald-400 fill-emerald-400/60" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white">{t("trustpilot.title")}</div>
          <p className="text-xs text-slate-400 leading-relaxed mt-0.5">{t("trustpilot.body")}</p>
        </div>
        <button
          onClick={() => close("dismissed")}
          aria-label={t("trustpilot.never")}
          className="w-11 h-11 -m-2 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={rate}
          className="flex-1 h-11 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-lg shadow-emerald-500/20 transition-all"
        >
          {t("trustpilot.cta")}
        </button>
        <button
          onClick={() => close("dismissed")}
          className="h-11 px-4 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/[0.05] transition-all"
        >
          {t("trustpilot.never")}
        </button>
      </div>
    </div>
  );
}
