import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { loadTradingRules, type TradingRule } from "../utils/tradingRules";

interface TradingRulesContextValue {
  rules: TradingRule[];
  refresh: () => Promise<void>;
}

const TradingRulesContext = createContext<TradingRulesContextValue | null>(null);

export function TradingRulesProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [rules, setRules] = useState<TradingRule[]>([]);

  const refresh = useCallback(async () => {
    const loaded = await loadTradingRules(userId);
    setRules(loaded);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <TradingRulesContext.Provider value={{ rules, refresh }}>
      {children}
    </TradingRulesContext.Provider>
  );
}

export function useTradingRulesContext(): TradingRulesContextValue {
  const ctx = useContext(TradingRulesContext);
  if (!ctx) throw new Error("useTradingRulesContext must be used within TradingRulesProvider");
  return ctx;
}
