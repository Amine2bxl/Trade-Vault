import { useEffect } from "react";
import { Bot, X, ArrowRight, CheckCircle2, Lightbulb } from "lucide-react";
import { Modal } from "@/shared/ui";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import type { AppNotification } from "@/modules/notifications/types";

/**
 * NotificationDetailModal — le popup centré (fond flouté) qui s'ouvre quand on
 * clique une notification. Tout est au nom de Jarvis : résumé de la
 * notification, l'essentiel chiffré, un CTA contextuel qui navigue vers la
 * bonne page, et un plan d'action très court (quoi faire ensuite).
 */

interface Props {
  notification: AppNotification;
  onClose: () => void;
  onMarkRead?: (id: string) => void;
}

const CATEGORY_LABEL: Record<string, string> = {
  discipline: "Discipline",
  goals: "Goals",
  risk: "Risk",
  jarvis: "Jarvis",
  economic: "Economic News",
  activity: "Activity",
  system: "System",
};

/** L'essentiel, chiffré — dérivé du payload structuré de la notification. */
function essentials(n: AppNotification): Array<[string, string]> {
  const d = n.data ?? {};
  const rows: Array<[string, string]> = [];
  if (typeof d.streak === "number") rows.push(["Pertes consécutives", `${d.streak}`]);
  if (typeof d.mistake === "string") rows.push(["Erreur", d.mistake]);
  if (typeof d.days === "number") rows.push(["Jours sans session", `${d.days}`]);
  if (typeof d.winRate === "number") rows.push(["Win rate", `${Math.round(d.winRate * 100)}%`]);
  if (typeof d.pnl === "number") rows.push(["P&L", `${Math.round(d.pnl)}$`]);
  return rows;
}

function pageFrom(n: AppNotification): string {
  const cta = (n.data?.ctaPage as string | undefined) ?? "";
  if (
    [
      "dashboard",
      "inbox",
      "journal",
      "checklist",
      "calendar",
      "analytics",
      "mistakes",
      "missed",
      "insights",
      "news",
      "seasonality",
      "calculator",
      "settings",
      "reports",
      "goals",
      "tradingplan",
      "appearance",
      "subscription",
      "profile",
    ].includes(cta)
  )
    return cta;
  const url = n.url ?? "";
  if (url.startsWith("/journal")) return "journal";
  if (url.startsWith("/mistakes")) return "mistakes";
  if (url.startsWith("/checklist")) return "checklist";
  if (url.startsWith("/reports")) return "reports";
  if (url.startsWith("/inbox")) return "inbox";
  return "dashboard";
}

export default function NotificationDetailModal({ notification: n, onClose, onMarkRead }: Props) {
  const { t } = useT();

  // Marquer lue dès l'ouverture — le badge se désincrémente en direct.
  useEffect(() => {
    onMarkRead?.(n.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ctaLabel = (n.data?.ctaLabel as string | undefined) ?? t("inbox.ctaDefault");
  const plan = (n.data?.plan as string | undefined) ?? t("inbox.planDefault");
  const catLabel = CATEGORY_LABEL[n.category] ?? "Jarvis";
  const rows = essentials(n);

  const go = () => {
    window.dispatchEvent(new CustomEvent("tv:navigate", { detail: { page: pageFrom(n) } }));
    onClose();
  };

  return (
    <Modal open onClose={onClose} wrapperClassName="z-[90]" className="md:max-w-md">
      {/* En-tête Jarvis — la notification est signée, comme chaque message. */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
        <div className="relative shrink-0">
          <span className="absolute -inset-1 rounded-xl bg-cyan-500/30 blur-md" />
          <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600">
            <Bot className="w-5 h-5 text-white" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-bold text-white tracking-tight truncate">Jarvis</h2>
            <span
              className={cn(
                "shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider",
                n.severity === "success" &&
                  "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20",
                n.severity === "warning" &&
                  "bg-amber-500/10 text-amber-300 border border-amber-500/20",
                n.severity === "error" && "bg-red-500/10 text-red-300 border border-red-500/20",
                n.severity === "info" && "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20",
              )}
            >
              {catLabel}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 truncate">
            {new Date(n.createdAt).toLocaleString()}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label={t("common.close")}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-5 py-4 space-y-4 max-h-[52vh] overflow-y-auto">
        {/* Résumé */}
        <div>
          <h3 className="text-lg font-bold text-white leading-snug">{n.title}</h3>
          <p className="text-[13.5px] text-slate-300 leading-relaxed mt-1.5">{n.body}</p>
        </div>

        {/* L'essentiel, chiffré */}
        {rows.length > 0 && (
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] divide-y divide-white/[0.05]">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-3.5 py-2">
                <span className="text-[11.5px] text-slate-500">{k}</span>
                <span className="text-[13px] font-bold text-white tabular-nums">{v}</span>
              </div>
            ))}
          </div>
        )}

        {/* Plan d'action — quoi faire ensuite, en une phrase. */}
        <div className="flex items-start gap-2.5 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.05] px-3.5 py-3">
          <Lightbulb className="w-4 h-4 text-cyan-300 shrink-0 mt-0.5" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-400/80 mb-0.5">
              {t("inbox.plan")}
            </div>
            <p className="text-[12.5px] text-slate-300 leading-relaxed">{plan}</p>
          </div>
        </div>
      </div>

      {/* CTA contextuel — navigue vers la bonne page */}
      <div className="flex items-center gap-2 px-5 py-4 border-t border-white/[0.06]">
        <button
          onClick={go}
          className="flex-1 h-11 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 transition inline-flex items-center justify-center gap-1.5"
        >
          {ctaLabel}
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={onClose}
          className="h-11 px-4 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors inline-flex items-center gap-1.5"
        >
          <CheckCircle2 className="w-4 h-4" />
          {t("inbox.later")}
        </button>
      </div>
    </Modal>
  );
}
