export type AssetCategory = "indices" | "forex" | "commodities" | "crypto";
export type MarketSource = "yahoo" | "stooq" | "fred";

/** Une clôture de fin de mois. `month` = « AAAA-MM ». */
export interface MonthlyClose {
  month: string;
  close: number;
}
