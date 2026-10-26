import type { Trade } from "../types";
import { evaluateTradeRule, type TradingRule } from "@/domain/ruleCheck";
import { localDateOf } from "@/shared/calendar-date";

/**
 * ADHÉRENCE AUX RÈGLES — le maillon qui ferme la boucle du produit.
 *
 * Pourquoi ce module existe
 * -------------------------
 * TradeVault savait déjà détecter qu'un trade viole une règle
 * (`checkTradeAgainstRules`, utilisé en temps réel par le moteur de
 * discipline pour notifier). Mais personne ne mesurait la TENUE DANS LE
 * TEMPS. Or c'est exactement la différence entre un outil qui gronde et un
 * coach qui accompagne :
 *
 *   « Tu as violé ta règle »        → un rappel, ponctuel, vite ignoré.
 *   « Tu l'as tenue 11 fois sur 12 » → une progression, qui donne envie de
 *                                      continuer.
 *
 * C'est aussi le cœur du moat : la boucle règle → tenue → mesure ne peut pas
 * être copiée depuis le code, elle exige l'historique du trader.
 *
 * AUCUNE LOGIQUE DE DÉTECTION N'EST RÉÉCRITE : ce module orchestre le
 * vérificateur existant sur l'historique. Une seule définition de « violer une
 * règle » dans tout le produit — le temps réel et le bilan ne peuvent pas
 * diverger.
 */

/** Fenêtre de mesure. Alignée sur la tendance des erreurs (`behavioral.ts`)
 *  pour que le trader lise partout la même notion de « récemment ». */
export const ADHERENCE_WINDOW_DAYS = 30;

export interface RuleAdherence {
  ruleId: string;
  /** La règle telle que le trader l'a écrite. */
  text: string;
  /** Trades de la fenêtre auxquels la règle s'appliquait. */
  applicable: number;
  /** Ceux qui l'ont respectée. */
  kept: number;
  /** Part vérifiée des observations, hors UNKNOWN. */
  observations: number;
  unknown: number;
  coveragePct: number;
  /** 0–100, arrondi. */
  ratePct: number;
}

function isoDaysBefore(ref: string, n: number): string {
  const d = new Date(ref + "T12:00:00");
  d.setDate(d.getDate() - n);
  return localDateOf(d);
}

/**
 * Mesure la tenue de chaque règle sur la fenêtre récente.
 *
 * TROIS DÉCISIONS, qui sont l'essentiel :
 *
 * 1. **Les règles `custom` sont EXCLUES.** Un engagement en texte libre n'est
 *    pas vérifiable par machine. Afficher « tenue 100 % » pour une règle que
 *    personne ne peut contrôler serait un mensonge flatteur — exactement ce que
 *    ce produit refuse.
 *
 * 2. **La fenêtre s'adosse à la dernière date TRADÉE**, pas à aujourd'hui. Un
 *    trader en pause afficherait sinon une adhérence parfaite pour n'avoir
 *    rien fait, et le produit le féliciterait d'avoir arrêté.
 *
 * 3. **Sans aucun trade dans la fenêtre, la règle est OMISE** — jamais
 *    rapportée à 100 %. Rien n'a été éprouvé, il n'y a donc rien à créditer.
 *
 *    Limite assumée : l'« applicabilité » reste GROSSIÈRE — tout trade de la
 *    fenêtre compte pour toute règle vérifiable. Une règle « pas de trade
 *    après 16h » est donc créditée par une matinée respectée. C'est le choix
 *    prudent (il sous-estime plutôt qu'il ne flatte), mais une applicabilité
 *    par type de règle serait plus juste — à faire quand les kinds se
 *    diversifieront.
 */
export function computeRuleAdherence(
  trades: Trade[],
  rules: TradingRule[],
  accountBalance: number,
  windowDays: number = ADHERENCE_WINDOW_DAYS,
): RuleAdherence[] {
  const checkable = rules.filter((r) => r.enabled && r.kind !== "custom");
  if (checkable.length === 0 || trades.length === 0) return [];

  const lastDate = trades.reduce((a, t) => (t.date > a ? t.date : a), trades[0].date);
  const cutoff = isoDaysBefore(lastDate, windowDays);
  const window = trades.filter((t) => t.date > cutoff);
  if (window.length === 0) return [];

  const entryMinute = (time: string): number | null => {
    const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time ?? "");
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  };
  const byDay = new Map<string, Trade[]>();
  for (const tr of window) {
    const day = byDay.get(tr.date) ?? [];
    day.push(tr);
    byDay.set(tr.date, day);
  }

  const stats = new Map<string, { checked: number; kept: number; unknown: number; total: number }>();
  for (const dayTrades of byDay.values()) {
    const ordered = [...dayTrades].sort((a, b) =>
      (entryMinute(a.entryTime) ?? Infinity) - (entryMinute(b.entryTime) ?? Infinity) ||
      a.id.localeCompare(b.id),
    );
    // A minute-level timestamp cannot order entries sharing the same minute.
    // In that case cumulative day-rules stay UNKNOWN instead of using a fake order.
    const deterministic = ordered.every((tr, i) => {
      const minute = entryMinute(tr.entryTime);
      return minute !== null &&
        (i === 0 || (entryMinute(ordered[i - 1].entryTime) ?? Infinity) < minute);
    });
    const earlier: Trade[] = [];
    for (const tr of ordered) {
      for (const rule of checkable) {
        const cumulative = rule.kind === "max_trades_day" || rule.kind === "stop_after_losses";
        const verdict = cumulative && !deterministic
          ? "UNKNOWN"
          : evaluateTradeRule(tr, rule, { sameDayTrades: earlier, accountBalance }).status;
        const s = stats.get(rule.id) ?? { checked: 0, kept: 0, unknown: 0, total: 0 };
        s.total++;
        if (verdict === "UNKNOWN") s.unknown++;
        else {
          s.checked++;
          if (verdict === "PASS") s.kept++;
        }
        stats.set(rule.id, s);
      }
      earlier.push(tr);
    }
  }

  const out: RuleAdherence[] = [];
  for (const rule of checkable) {
    const s = stats.get(rule.id);
    // Existing consumers expect a numeric rate. If all evidence is unknown,
    // omit the rate rather than falsely claiming 100% adherence.
    if (!s || s.checked === 0) continue;
    out.push({
      ruleId: rule.id,
      text: rule.text,
      applicable: s.checked,
      kept: s.kept,
      observations: s.total,
      unknown: s.unknown,
      coveragePct: Math.round((100 * s.checked) / s.total),
      ratePct: Math.round((100 * s.kept) / s.checked),
    });
  }
  // La règle la MOINS tenue en premier : c'est celle sur laquelle le coach doit
  // parler. Un bilan qui ouvre sur les réussites laisse le problème invisible.
  return out.sort((a, b) => a.ratePct - b.ratePct);
}
