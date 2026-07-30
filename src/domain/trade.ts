export type TradeDirection = "long" | "short" | "be";

export interface Trade {
  id: string;
  date: string;
  symbol: string;
  direction: TradeDirection;
  pnl: number;
  riskAmount: number;
  rMultiple: number;
  strategy: string;
  mistakes: string[];
  setupQuality: number;
  notes: string;
  screenshots: string[];
  entryTime: string;
  exitTime: string;
  confluences: string[];
  confidence: number;
  mae?: number | null;
  mfe?: number | null;
  slippage?: number | null;
  isExample?: boolean;
}
