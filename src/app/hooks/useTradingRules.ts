import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { loadTradingRules, type TradingRule } from "../utils/tradingRules";

/**
 * The trader's own rules, kept live.
 *
 * `App.tsx` already loads them into a ref for the anti-bias checker and the
 * Profile editor broadcasts `tv-rules-updated` on every change. Jarvis needs
 * the same list — a coach that does not know the standard the trader set for
 * themselves can only give generic advice — so this hook reuses that exact
 * contract instead of introducing a second source of truth.
 *
 * Best-effort: a failed read degrades to "no rules", never to a broken coach.
 */
export function useTradingRules(): TradingRule[] {
  const { user } = useAuth();
  const [rules, setRules] = useState<TradingRule[]>([]);

  useEffect(() => {
    if (!user?.id) {
      setRules([]);
      return;
    }
    let active = true;
    loadTradingRules(user.id)
      .then((r) => {
        if (active) setRules(r);
      })
      .catch(() => {});
    const onUpdate = (e: Event) => {
      setRules((e as CustomEvent<TradingRule[]>).detail ?? []);
    };
    window.addEventListener("tv-rules-updated", onUpdate);
    return () => {
      active = false;
      window.removeEventListener("tv-rules-updated", onUpdate);
    };
  }, [user?.id]);

  return rules;
}
