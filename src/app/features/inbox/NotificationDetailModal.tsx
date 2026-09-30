import { useEffect } from "react";
import { Bot, X, ArrowRight, CheckCircle2, Lightbulb } from "lucide-react";
import { Modal } from "@/shared/ui";
import { useT } from "@/app/i18n/LanguageContext";
import { cn } from "@/shared/ui/cn";
import type { AppNotification } from "@/modules/notifications/types";
import { CATEGORY_LABEL, WHY_KEY, notificationTarget } from "./notificationMeta";
import type { TKey } from "@/app/i18n/translations";
import { formatMoney } from "@/shared/currency";

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

/** L'essentiel, chiffré — dérivé du payload structuré de la notification. */
function essentials(n: AppNotification, t: (k: TKey) => string): Array<[string, string]> {
  const d = n.data ?? {};
  const rows: Array<[string, string]> = [];
  if (typeof d.streak === "number") rows.push([t("inbox.essStreak"), `${d.streak}`]);
  if (typeof d.mistake === "string") rows.push([t("inbox.essMistake"), d.mistake]);
  if (typeof d.days === "number") rows.push([t("inbox.essDays"), `${d.days}`]);
  if (typeof d.winRate === "number")
    rows.push([t("inbox.essWinRate"), `${Math.round(d.winRate * 100)}%`]);
  if (typeof d.pnl === "number")
    rows.push([t("inbox.essPnl"), formatMoney(d.pnl, { signed: true })]);
  return rows;
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
  const catLabel = t(CATEGORY_LABEL[n.category] ?? "inbox.filterJarvis");
  const rows = essentials(n, t);

  const go = () => {
    window.dispatchEvent(new CustomEvent("tv:navigate", { detail: notificationTarget(n) }));
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      wrapperClassName="z-[var(--tv-z-modal-nested)]"
      className="md:max-w-md"
    >
      {/* En-tête Jarvis — la notification est signée, comme chaque message. */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
        <div className="tv-accent-fill grid h-10 w-10 shrink-0 place-items-center rounded-xl">
          <Bot className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="tv-title tracking-tight truncate">Jarvis</h2>
            <span
              className={cn(
                "tv-label shrink-0 px-2 py-0.5 rounded-full",
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
          <p className="tv-row-label truncate">{new Date(n.createdAt).toLocaleString()}</p>
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
          <h3 className="tv-title leading-snug">{n.title}</h3>
          <p className="text-[13px] text-slate-300 leading-relaxed mt-1.5">{n.body}</p>
          {WHY_KEY[n.kind] && (
            <p className="mt-2 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-400">{t("inbox.why")}</span>{" "}
              {t(WHY_KEY[n.kind]!)}
            </p>
          )}
        </div>

        {/* L'essentiel, chiffré */}
        {rows.length > 0 && (
          <div className="tv-relief-inset rounded-xl border border-[var(--tv-border)] divide-y divide-white/[0.05]">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-3.5 py-2">
                <span className="text-[11px] text-slate-500">{k}</span>
                <span className="tv-figure text-[13px] text-white">{v}</span>
              </div>
            ))}
          </div>
        )}

        {/* Plan d'action — quoi faire ensuite, en une phrase. */}
        <div className="flex items-start gap-2.5 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.05] px-3.5 py-3">
          <Lightbulb className="w-4 h-4 text-cyan-300 shrink-0 mt-0.5" />
          <div>
            <div className="tv-label text-cyan-400/80 mb-0.5">{t("inbox.plan")}</div>
            <p className="text-[13px] text-slate-300 leading-relaxed">{plan}</p>
          </div>
        </div>
      </div>

      {/* CTA contextuel — navigue vers la bonne page */}
      <div className="flex items-center gap-2 px-5 py-4 border-t border-white/[0.06]">
        <button
          onClick={go}
          className="flex-1 h-11 rounded-xl text-sm font-bold tv-accent-fill transition inline-flex items-center justify-center gap-1.5"
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
