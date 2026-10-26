import type { Trade } from "./trade";

/**
 * Vérification des règles du trader — logique PURE.
 *
 * Séparée de `tradingRules.ts` (qui parle à Supabase) pour une raison
 * concrète : ce vérificateur définit ce que « violer une règle » veut dire
 * dans tout le produit — temps réel ET bilan d'adhérence. Tant qu'il était
 * mêlé aux accès base, il était impossible de le tester sans client Supabase,
 * donc impossible de garantir la règle la plus importante du coach.
 *
 * `tradingRules.ts` ré-exporte tout ce fichier : aucun appelant n'a changé.
 */

export type RuleKind =
  | "no_trade_after" // value = "HH:MM" — no entries at/after this local time
  | "no_trade_before" // value = "HH:MM" — no entries before this local time
  | "max_risk_pct" // value = % of account balance risked per trade
  | "max_trades_day" // value = max trades in one day
  | "stop_after_losses" // value = stop after N losing trades in the day
  | "custom"; // free-text commitment, not auto-checked

export interface TradingRule {
  id: string;
  kind: RuleKind;
  /** Numeric or "HH:MM" parameter depending on kind; unused for custom. */
  value: string;
  /** The rule in the trader's own words (shown back to them verbatim). */
  text: string;
  enabled: boolean;
}

export interface Violation {
  rule: TradingRule;
  /** Kind-but-firm push body: states the breach, restates THEIR rule, cites
   *  the statistical risk, and sets the intention for the next session. */
  message: string;
}

// ── Storage (profiles.trading_rules jsonb) ──────────────────────────────────
const toMinutes = (hhmm: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
};

export interface RuleContext {
  /** Trades already logged for the same day (excluding the one being saved). */
  sameDayTrades: Trade[];
  /** Account balance used for %-risk checks (starting balance + PnL). */
  accountBalance: number;
}

function fr(): boolean {
  try {
    return (localStorage.getItem("tv.lang") ?? "en") === "fr";
  } catch {
    return false;
  }
}

/** Builds the kind-but-firm coaching message for one violated rule. */
function violationMessage(rule: TradingRule, detail: string, stat: string): string {
  return fr()
    ? `${detail} Ta règle, écrite par toi : « ${rule.text} ». ${stat} Ce trade est loggé — la prochaine session repart propre, avec ta règle en tête. 💙`
    : `${detail} Your rule, in your own words: "${rule.text}". ${stat} This trade is logged — next session starts clean, with your rule in mind. 💙`;
}

export function checkTradeAgainstRules(
  trade: Trade,
  rules: TradingRule[],
  ctx: RuleContext,
): Violation[] {
  const violations: Violation[] = [];
  const isFr = fr();

  for (const rule of rules) {
    if (!rule.enabled || rule.kind === "custom") continue;

    switch (rule.kind) {
      case "no_trade_after": {
        const limit = toMinutes(rule.value);
        const entry = trade.entryTime ? toMinutes(trade.entryTime) : null;
        if (limit !== null && entry !== null && entry >= limit) {
          violations.push({
            rule,
            message: violationMessage(
              rule,
              isFr
                ? `Trade pris à ${trade.entryTime}, après ta limite de ${rule.value}.`
                : `Trade taken at ${trade.entryTime}, past your ${rule.value} cutoff.`,
              isFr
                ? "Statistiquement, les trades hors de ta fenêtre ont un taux de réussite nettement plus faible : fatigue + faible liquidité = edge dégradé."
                : "Statistically, trades outside your window win far less often: fatigue + thin liquidity = degraded edge.",
            ),
          });
        }
        break;
      }
      case "no_trade_before": {
        const limit = toMinutes(rule.value);
        const entry = trade.entryTime ? toMinutes(trade.entryTime) : null;
        if (limit !== null && entry !== null && entry < limit) {
          violations.push({
            rule,
            message: violationMessage(
              rule,
              isFr
                ? `Trade pris à ${trade.entryTime}, avant ton heure de départ de ${rule.value}.`
                : `Trade taken at ${trade.entryTime}, before your ${rule.value} start time.`,
              isFr
                ? "Les entrées avant ta fenêtre sautent ta préparation — c'est exactement là que naissent les trades impulsifs."
                : "Entries before your window skip your preparation — that's exactly where impulsive trades are born.",
            ),
          });
        }
        break;
      }
      case "max_risk_pct": {
        const maxPct = parseFloat(rule.value);
        if (
          Number.isFinite(maxPct) &&
          maxPct > 0 &&
          ctx.accountBalance > 0 &&
          trade.riskAmount > 0
        ) {
          const pct = (trade.riskAmount / ctx.accountBalance) * 100;
          if (pct > maxPct + 1e-9) {
            violations.push({
              rule,
              message: violationMessage(
                rule,
                isFr
                  ? `Risque de ${pct.toFixed(1)}% sur ce trade — au-dessus de ta limite de ${maxPct}%.`
                  : `${pct.toFixed(1)}% risked on this trade — above your ${maxPct}% cap.`,
                isFr
                  ? `À ce niveau de risque, une série de 5 pertes coûte ~${Math.min(99, Math.round(pct * 5))}% du compte. Le sur-risque est la première cause de compte cramé.`
                  : `At this risk level, a 5-loss streak costs ~${Math.min(99, Math.round(pct * 5))}% of the account. Oversizing is the #1 account killer.`,
              ),
            });
          }
        }
        break;
      }
      case "max_trades_day": {
        const max = parseInt(rule.value, 10);
        const count = ctx.sameDayTrades.length + 1;
        if (Number.isFinite(max) && max > 0 && count > max) {
          violations.push({
            rule,
            message: violationMessage(
              rule,
              isFr
                ? `${count}e trade de la journée — ta limite est de ${max}.`
                : `Trade #${count} of the day — your limit is ${max}.`,
              isFr
                ? "Au-delà de ta limite, chaque trade supplémentaire a statistiquement une espérance plus faible : c'est l'overtrading qui parle, pas ton edge."
                : "Past your limit, each extra trade statistically carries lower expectancy: that's overtrading talking, not your edge.",
            ),
          });
        }
        break;
      }
      case "stop_after_losses": {
        const maxLosses = parseInt(rule.value, 10);
        if (Number.isFinite(maxLosses) && maxLosses > 0) {
          const losses = ctx.sameDayTrades.filter((t) => t.direction !== "be" && t.pnl < 0).length;
          if (losses >= maxLosses) {
            violations.push({
              rule,
              message: violationMessage(
                rule,
                isFr
                  ? `Trade pris après ${losses} pertes aujourd'hui — ta règle disait stop à ${maxLosses}.`
                  : `Trade taken after ${losses} losses today — your rule said stop at ${maxLosses}.`,
                isFr
                  ? "Après une série de pertes, le cerveau passe en mode récupération : les décisions suivantes sont statistiquement les pires de la journée."
                  : "After a losing streak, the brain flips into recovery mode: the next decisions are statistically the worst of the day.",
              ),
            });
          }
        }
        break;
      }
    }
  }
  return violations;
}

/** Explicit rule verdict. An empty list of violations is NOT proof if
 * an input needed for verification is missing. */
export type RuleVerdict = "PASS" | "FAIL" | "UNKNOWN";
export interface RuleEvaluation {
  status: RuleVerdict;
  violations: Violation[];
  reason?: string;
}
const unknownRule = (reason: string): RuleEvaluation => ({
  status: "UNKNOWN",
  violations: [],
  reason,
});

function verifiedTime(value: string): boolean {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value?.trim() ?? "");
  return m !== null;
}

/** Compatibility: the legacy violations-only API remains unchanged.
 * Use this function for historic adherence and numerical evidence. */
export function evaluateTradeRule(
  trade: Trade,
  rule: TradingRule,
  context: RuleContext,
): RuleEvaluation {
  if (!rule.enabled || rule.kind === "custom") return unknownRule("unverifiable_rule");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trade.date)) return unknownRule("missing_date");
  switch (rule.kind) {
    case "no_trade_after":
    case "no_trade_before":
      if (!verifiedTime(rule.value)) return unknownRule("invalid_rule_time");
      if (!verifiedTime(trade.entryTime)) return unknownRule("missing_entry_time");
      break;
    case "max_risk_pct":
      if (!Number.isFinite(Number(rule.value)) || Number(rule.value) <= 0)
        return unknownRule("invalid_risk_limit");
      if (!Number.isFinite(context.accountBalance) || context.accountBalance <= 0)
        return unknownRule("unknown_account_balance");
      if (!Number.isFinite(trade.riskAmount) || trade.riskAmount <= 0)
        return unknownRule("unknown_initial_risk");
      break;
    case "max_trades_day":
    case "stop_after_losses":
      if (!Number.isInteger(Number(rule.value)) || Number(rule.value) <= 0)
        return unknownRule("invalid_daily_limit");
      if (
        !Array.isArray(context.sameDayTrades) ||
        context.sameDayTrades.some((previous) => previous.date !== trade.date)
      )
        return unknownRule("unknown_day_history");
      if (
        rule.kind === "stop_after_losses" &&
        context.sameDayTrades.some((previous) => !Number.isFinite(previous.pnl))
      )
        return unknownRule("unknown_previous_result");
      break;
    default:
      return unknownRule("unsupported_rule");
  }
  const violations = checkTradeAgainstRules(trade, [rule], context);
  return { status: violations.length ? "FAIL" : "PASS", violations };
}

