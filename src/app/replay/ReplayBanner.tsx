/**
 * ReplayBanner — le bandeau « mode rejeu » persistant.
 *
 * Présent sur TOUTES les pages tant que le rejeu est actif : on sait d'un coup
 * d'œil qu'on opère sur le compte de rejeu, où en est l'horloge, et comment
 * rejoindre le terminal ou sortir. C'est ce qui fait du rejeu une app dans
 * l'app — les autres pages restent entièrement utilisables, branchées sur le
 * compte de rejeu.
 */

import { History, LogOut, Play } from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import { useReplayMode } from "./ReplayModeContext";

export default function ReplayBanner({ onGoTerminal }: { onGoTerminal: () => void }) {
  const { t } = useT();
  const { session, modeActive, exit } = useReplayMode();
  // Le bandeau suit le MODE, pas la séance : dès que le compte de rejeu est
  // sélectionné, tout le site vit en rejeu — même avant d'avoir lancé une
  // séance.
  if (!modeActive) return null;

  const pnl = session.quote?.realizedPnl ?? 0;
  const pnlTone = pnl >= 0 ? "text-[var(--tv-chart-green)]" : "text-[var(--tv-chart-red)]";

  return (
    <div className="flex items-center gap-2 border-b border-[var(--tv-accent)]/30 bg-[var(--tv-accent)]/10 px-4 py-1.5 text-[11px]">
      <span className="inline-flex items-center gap-1.5 font-bold text-[var(--tv-accent)]">
        <History className="h-3.5 w-3.5" />
        {t("rt.modeTitle")}
      </span>
      <span className="text-[var(--tv-text-muted)]">
        {session.account?.name ?? t("rt.modeTitle")}
      </span>
      <span className="hidden tv-figure text-[var(--tv-text-muted)] sm:inline">
        {session.active ? session.clockLabel || "–" : "—"}
      </span>
      {session.active && (
        <span className={cn2("hidden tv-figure font-semibold sm:inline", pnlTone)}>
          {pnl >= 0 ? "+" : ""}
          {pnl.toFixed(0)} $
        </span>
      )}
      <span className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={onGoTerminal}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--tv-accent)]/40 px-2 py-1 font-semibold text-[var(--tv-accent)] hover:bg-[var(--tv-accent)]/10"
        >
          <Play className="h-3 w-3" />
          {t("rt.terminal")}
        </button>
        <button
          type="button"
          onClick={() => void exit()}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-[var(--tv-text-muted)] hover:text-[var(--tv-danger)]"
        >
          <LogOut className="h-3 w-3" />
          {t("rt.exit")}
        </button>
      </span>
    </div>
  );
}

function cn2(...parts: string[]): string {
  return parts.filter(Boolean).join(" ");
}
