import type { Trade } from "../types";
import { checkTradeAgainstRules, type TradingRule } from "./ruleCheck";
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

  // Trades du même jour, requis par le vérificateur pour les règles de volume
  // (`max_trades_day`, `stop_after_losses`).
  const byDay = new Map<string, Trade[]>();
  for (const t of window) {
    const list = byDay.get(t.date) ?? [];
    list.push(t);
    byDay.set(t.date, list);
  }

  const stats = new Map<string, { applicable: number; kept: number }>();

  for (const trade of window) {
    const sameDay = (byDay.get(trade.date) ?? []).filter((t) => t.id !== trade.id);
    for (const rule of checkable) {
      // Une règle à la fois : sinon impossible de savoir laquelle a été violée.
      const violations = checkTradeAgainstRules(trade, [rule], {
        sameDayTrades: sameDay,
        accountBalance,
      });
      // Le vérificateur ne se prononce que sur ce qu'il peut évaluer : s'il ne
      // renvoie rien, c'est soit un respect, soit une donnée manquante (heure
      // d'entrée vide…). On compte le trade comme applicable dans les deux cas,
      // ce qui est le choix PRUDENT — il ne peut que sous-estimer l'adhérence,
      // jamais la flatter.
      const s = stats.get(rule.id) ?? { applicable: 0, kept: 0 };
      s.applicable++;
      if (violations.length === 0) s.kept++;
      stats.set(rule.id, s);
    }
  }

  const out: RuleAdherence[] = [];
  for (const rule of checkable) {
    const s = stats.get(rule.id);
    if (!s || s.applicable === 0) continue;
    out.push({
      ruleId: rule.id,
      text: rule.text,
      applicable: s.applicable,
      kept: s.kept,
      ratePct: Math.round((s.kept / s.applicable) * 100),
    });
  }
  // La règle la MOINS tenue en premier : c'est celle sur laquelle le coach doit
  // parler. Un bilan qui ouvre sur les réussites laisse le problème invisible.
  return out.sort((a, b) => a.ratePct - b.ratePct);
}
