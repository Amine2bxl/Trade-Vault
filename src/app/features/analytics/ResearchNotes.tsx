import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { researchNotesKey } from "./useResearchNotes";
import type { Trade } from "@/app/types";
import { useAuth } from "@/app/contexts/AuthContext";
import { useToast } from "@/app/contexts/ToastContext";
import { useT } from "@/app/i18n/LanguageContext";
import { intlLocale } from "@/app/i18n/locale";
import { appendResearchResult, archiveResearchNote, type ResearchNote } from "@/app/store/research";
import { formatPnl } from "@/domain/tradeCalcs";
import { evaluateProtocol, type ProtocolEvaluation } from "@/modules/research";
import { Badge, Button, cn } from "@/shared/ui";

/**
 * HYPOTHÈSES SUIVIES — Research Notebook (lot 2), sous EdgeLab.
 *
 * Chaque note est réévaluée sur l'historique COMPLET du compte (un filtre de
 * période fausserait l'empreinte d'apprentissage) ; une évaluation qui change
 * est AJOUTÉE à l'historique de la note, jamais réécrite.
 */

export function ResearchNotes({
  notes,
  allTrades,
  cellLabel,
}: {
  notes: ResearchNote[];
  allTrades: Trade[];
  cellLabel: (note: ResearchNote) => string;
}) {
  const { t, lang } = useT();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const dateFmt = new Intl.DateTimeFormat(intlLocale(lang), {
    dateStyle: "medium",
    timeZone: "UTC",
  });

  const evaluated = useMemo(
    () => notes.map((n) => ({ note: n, e: evaluateProtocol(n.protocol, allTrades) })),
    [notes, allTrades],
  );

  // Une évaluation nouvelle s'ajoute à l'historique de la note — une fois.
  // Chaque évaluation n'est TENTÉE qu'une fois par session : un ajout refusé
  // (table absente, réseau) ne relance pas une boucle d'écritures.
  const attempted = useRef(new Set<string>());
  useEffect(() => {
    if (!user) return;
    const changed = evaluated.filter(({ note, e }) => {
      const key = `${note.id}:${e.verdict}:${e.holdoutN}`;
      if (attempted.current.has(key)) return false;
      return (
        !note.lastResult ||
        note.lastResult.verdict !== e.verdict ||
        note.lastResult.holdoutN !== e.holdoutN
      );
    });
    if (changed.length === 0) return;
    for (const { note, e } of changed)
      attempted.current.add(`${note.id}:${e.verdict}:${e.holdoutN}`);
    void Promise.allSettled(
      changed.map(({ note, e }) =>
        appendResearchResult(user.id, note.id, {
          verdict: e.verdict,
          holdoutN: e.holdoutN,
          holdoutSessions: e.holdoutSessions,
        }),
      ),
    ).then((results) => {
      if (results.some((r) => r.status === "fulfilled")) {
        void queryClient.invalidateQueries({ queryKey: researchNotesKey(user.id) });
      }
    });
  }, [evaluated, user, queryClient]);

  const archive = async (id: string) => {
    if (!user) return;
    try {
      await archiveResearchNote(user.id, id);
      await queryClient.invalidateQueries({ queryKey: researchNotesKey(user.id) });
    } catch {
      toast(t("research.saveFailed"), "error");
    }
  };

  if (evaluated.length === 0) return null;
  return (
    <div className="border-t border-white/[0.06] px-4 py-3 md:px-5">
      <p className="tv-label text-slate-500">{t("research.title")}</p>
      <ul className="mt-2 space-y-3">
        {evaluated.map(({ note, e }) => (
          <li key={note.id} className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-slate-200">
                <span className="font-bold">{cellLabel(note)}</span> — {note.protocol.hypothesis}
              </p>
              <p className="tv-prose mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-400">
                <Badge variant={badgeOf(e)}>{t(`research.verdict.${e.verdict}`)}</Badge>
                <span>
                  {t("research.holdoutFrom").replace(
                    "{date}",
                    dateFmt.format(new Date(`${note.protocol.holdoutStart}T00:00:00Z`)),
                  )}
                </span>
                <span className="tv-figure">
                  {t("research.progress")
                    .replace("{n}", String(e.holdoutN))
                    .replace("{sessions}", String(e.holdoutSessions))}
                </span>
                {e.holdoutExpectancy !== null && (
                  <span
                    className={cn(
                      "tv-figure",
                      e.holdoutExpectancy >= 0 ? "text-emerald-400" : "text-red-400",
                    )}
                  >
                    {formatPnl(e.holdoutExpectancy)}
                  </span>
                )}
              </p>
              {e.verdict === "insufficient" && (
                <p className="tv-hint">
                  {t("research.missing")
                    .replace("{trades}", String(e.missingTrades))
                    .replace("{sessions}", String(e.missingSessions))}
                </p>
              )}
              {(e.trainingChanged || e.methodChanged) && (
                <p className="tv-hint text-amber-300">
                  {e.trainingChanged ? t("research.trainingChanged") : t("research.methodChanged")}
                </p>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => void archive(note.id)}>
              {t("research.archive")}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function badgeOf(e: ProtocolEvaluation) {
  if (e.verdict === "supported") return "profit" as const;
  if (e.verdict === "contradicted") return "loss" as const;
  if (e.verdict === "inconclusive") return "warning" as const;
  return "neutral" as const;
}
