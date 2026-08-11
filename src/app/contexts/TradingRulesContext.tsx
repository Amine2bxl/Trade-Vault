import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { loadTradingRules, type TradingRule } from "../utils/tradingRules";

interface TradingRulesContextValue {
  rules: TradingRule[];
  refresh: () => Promise<void>;
}

const TradingRulesContext = createContext<TradingRulesContextValue | null>(null);

export function TradingRulesProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const [rules, setRules] = useState<TradingRule[]>([]);

  const refresh = useCallback(async () => {
    const loaded = await loadTradingRules(userId);
    setRules(loaded);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Même raison que ToastContext : sans mémo, l'objet de contexte change à
  // chaque rendu du fournisseur et tous les consommateurs re-rendent, même
  // quand ni les règles ni `refresh` n'ont bougé.
  const value = useMemo(() => ({ rules, refresh }), [rules, refresh]);

  return <TradingRulesContext.Provider value={value}>{children}</TradingRulesContext.Provider>;
}

export function useTradingRulesContext(): TradingRulesContextValue {
  const ctx = useContext(TradingRulesContext);
  if (!ctx) throw new Error("useTradingRulesContext must be used within TradingRulesProvider");
  return ctx;
}
