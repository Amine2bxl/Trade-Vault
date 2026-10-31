import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Trade } from "@/app/types";
import { useAuth } from "@/app/contexts/AuthContext";
import { useAccounts } from "@/app/contexts/AccountContext";
import { useToast } from "@/app/contexts/ToastContext";
import { useT } from "@/app/i18n/LanguageContext";
import { intlLocale } from "@/app/i18n/locale";
import {
  closeExperiment,
  loadExperiments,
  startExperiment,
  type StoredExperiment,
} from "@/app/store/experiments";
import { formatPnl } from "@/domain/tradeCalcs";
import { draftExperiment, evaluateExperiment } from "@/modules/research";
import { todayLocalDate } from "@/shared/calendar-date";
import { Badge, Button, Card, SelectPicker } from "@/shared/ui";

/**
 * EXPÉRIENCE DE PROGRESSION (lot 4) — « je teste une pause après N pertes ».
 *
 * Le protocole se fige au démarrage (base : `progress_experiment_frozen`) ;
 * l'écran mesure le RESPECT vérifiable séance par séance et décrit le P&L face
 * aux séances d'avant, sans jamais conclure d'effet. Modifier = clore cette
 * version et en démarrer une nouvelle, liée à la précédente.
 */

const LOSSES = ["2", "3", "4"] as const;
const SESSIONS = ["10", "20", "30"] as const;

const key = (userId: string | undefined) => ["progress-experiments", userId ?? null] as const;

export function ProgressExperimentCard({ trades }: { trades: Trade[] }) {
  const { t, lang } = useT();
  const { user } = useAuth();
  const { activeId } = useAccounts();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: key(user?.id),
    queryFn: () => loadExperiments(user!.id),
    enabled: !!user,
    staleTime: 60_000,
  });
  const [losses, setLosses] = useState<(typeof LOSSES)[number]>("2");
  const [sessions, setSessions] = useState<(typeof SESSIONS)[number]>("20");
  const accountId = activeId ?? null;
  const active = (query.data?.experiments ?? []).find(
    (e) => e.status === "active" && e.accountId === accountId,
  );
  const result = useMemo(
    () => (active ? evaluateExperiment(active.protocol, trades) : null),
    [active, trades],
  );
  const dateFmt = new Intl.DateTimeFormat(intlLocale(lang), {
    dateStyle: "medium",
    timeZone: "UTC",
  });

  if (!query.data?.available) return null;

  const refresh = () => queryClient.invalidateQueries({ queryKey: key(user?.id) });
  const start = async (supersedes: StoredExperiment | null) => {
    if (!user) return;
    try {
      if (supersedes && result) await closeExperiment(user.id, supersedes.id, "abandoned", result);
      const protocol = draftExperiment(
        { maxLosses: Number(losses), targetSessions: Number(sessions) },
        todayLocalDate(),
      );
      await startExperiment(user.id, accountId, protocol, supersedes?.id ?? null);
      await refresh();
    } catch {
      toast(t("experiment.saveFailed"), "error");
    }
  };
  const close = async (status: "completed" | "abandoned") => {
    if (!user || !active || !result) return;
    try {
      await closeExperiment(user.id, active.id, status, result);
      await refresh();
    } catch {
      toast(t("experiment.saveFailed"), "error");
    }
  };

  const pickers = (
    <div className="flex flex-wrap gap-2">
      <SelectPicker
        label={t("experiment.after")}
        value={losses}
        onChange={setLosses}
        options={LOSSES.map((v) => ({ value: v, label: t("behavior.afterN").replace("{n}", v) }))}
      />
      <SelectPicker
        label={t("experiment.duration")}
        value={sessions}
        onChange={setSessions}
        options={SESSIONS.map((v) => ({
          value: v,
          label: t("experiment.sessionsN").replace("{n}", v),
        }))}
      />
    </div>
  );

  return (
    <Card className="p-4 md:p-5">
      <h3 className="tv-title flex flex-wrap items-center gap-2">
        {t("experiment.title")}
        {active && <Badge variant="accent">{t("experiment.running")}</Badge>}
      </h3>
      <p className="tv-row-label mt-1 max-w-xl">{t("experiment.subtitle")}</p>

      {!active || !result ? (
        <div className="mt-3 space-y-3">
          {pickers}
          <Button size="sm" onClick={() => void start(null)}>
            {t("experiment.start")}
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-1.5">
          <p className="tv-prose text-slate-300">
            {t("experiment.protocol")
              .replace("{n}", String(active.protocol.maxLosses))
              .replace("{sessions}", String(active.protocol.targetSessions))
              .replace("{date}", dateFmt.format(new Date(`${active.protocol.startDay}T00:00:00Z`)))}
          </p>
          <p className="tv-prose text-slate-300">
            {t("experiment.progress")
              .replace("{observed}", String(result.sessionsObserved))
              .replace("{target}", String(active.protocol.targetSessions))
              .replace("{complied}", String(result.complied))
              .replace("{tested}", String(result.complied + result.violated))
              .replace("{notTriggered}", String(result.notTriggered))
              .replace("{unknown}", String(result.unknown))}
          </p>
          {result.avgSessionPnl !== null && (
            <p className="tv-prose text-slate-300">
              {t("experiment.pnl")}{" "}
              <span className="tv-figure">{formatPnl(result.avgSessionPnl)}</span>
              {result.baselineAvgSessionPnl !== null && (
                <>
                  {" · "}
                  {t("experiment.baseline").replace("{n}", String(result.baselineSessions))}{" "}
                  <span className="tv-figure">{formatPnl(result.baselineAvgSessionPnl)}</span>
                </>
              )}
            </p>
          )}
          {result.lowPower && <p className="tv-hint">{t("experiment.lowPower")}</p>}
          <p className="tv-hint">{t("experiment.caveat")}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {result.status === "complete" && (
              <Button size="sm" onClick={() => void close("completed")}>
                {t("experiment.complete")}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => void close("abandoned")}>
              {t("experiment.abandon")}
            </Button>
          </div>
          <details className="pt-1">
            <summary className="tv-prose cursor-pointer text-slate-400">
              {t("experiment.modify")}
            </summary>
            <div className="mt-2 space-y-2">
              {pickers}
              <Button size="sm" variant="ghost" onClick={() => void start(active)}>
                {t("experiment.restart")}
              </Button>
            </div>
          </details>
        </div>
      )}
    </Card>
  );
}
