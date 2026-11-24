import { markCaptureApplied } from "@/app/store/captures";
import {
  correctionsOf,
  type Proposal,
  type TradeFormField,
  type TradeFormSlice,
} from "./capturePrefill";

/** Ce que le formulaire garde de la dernière analyse, pour la solder à l'enregistrement. */
export interface CaptureSession {
  itemId: string | null;
  applied: Proposal<TradeFormField>[];
}

/** Le trade est enregistré : la capture pointe vers lui et garde ce qui a été corrigé. */
export function settleTradeCapture(
  session: CaptureSession | null,
  tradeId: string,
  saved: TradeFormSlice,
): void {
  if (!session?.itemId) return;
  void markCaptureApplied(session.itemId, { tradeId }, correctionsOf(session.applied, saved));
}
