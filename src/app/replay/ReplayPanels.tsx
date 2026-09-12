/**
 * ReplayPanels — positions, ordres et historique du terminal.
 *
 * Les dictionnaires sont très simples : chaque position expose son exposition,
 * son P&L ouvert et son R courant ; chaque ordre son statut et son prix. Le
 * bracket est éditable en ligne (SL/TP), et l'historique montre l'aller-retour
 * complet de chaque trade réalisé.
 */

import { useState } from "react";
import { CircleX, Pencil, Trash2, X } from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import type { Position, ReplaySessionState } from "@/modules/replay";
import { roundToTick, NQ, nyTimeOf } from "@/modules/replay";
import { requestTradeEncoding } from "../store/replay";

type Tab = "positions" | "orders" | "history";

interface Props {
  state: ReplaySessionState | null;
  mark: number;
  onClosePos: (posId: string) => void;
  onCancelOrder: (orderId: string) => void;
  onChangeBracket: (posId: string, sl: number | null, tp: number | null) => void;
}

export default function ReplayPanels({
  state,
  mark,
  onClosePos,
  onCancelOrder,
  onChangeBracket,
}: Props) {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>("positions");

  const positions = state?.positions ?? [];
  const working = (state?.orders ?? []).filter((o) => o.status === "working");
  const history = [...(state?.closedTrades ?? [])].sort((a, b) => b.exitTime - a.exitTime);

  const pnlColor = (n: number) =>
    n >= 0 ? "text-[var(--tv-chart-green)]" : "text-[var(--tv-chart-red)]";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Onglets */}
      <div className="grid grid-cols-3 gap-1 border-b border-[var(--tv-border)] p-2">
        {(["positions", "orders", "history"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={cn(
              "rounded-lg py-1.5 text-[11px] font-semibold transition",
              tab === k
                ? "bg-[var(--tv-surface-hover)] text-[var(--tv-text)]"
                : "text-[var(--tv-text-muted)]",
            )}
          >
            {k === "positions"
              ? t("rt.positions")
              : k === "orders"
                ? `${t("rt.orders")}${working.length ? ` · ${working.length}` : ""}`
                : t("rt.history")}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {tab === "positions" &&
          (positions.length === 0 ? (
            <Empty label={t("rt.noPositions")} />
          ) : (
            <div className="flex flex-col gap-2">
              {positions.map((pos) => (
                <PositionRow
                  key={pos.id}
                  pos={pos}
                  mark={mark}
                  onChangeBracket={onChangeBracket}
                  onClose={onClosePos}
                />
              ))}
            </div>
          ))}

        {/* LE CARNET, EN TABLEAU — comme sur une plateforme de trading.
          Les cartes empilées obligeaient à lire chaque ordre séparément pour
          comparer deux prix. Un tableau aligne les colonnes : on balaye. */}
        {tab === "orders" &&
          (working.length === 0 ? (
            <Empty label={t("rt.noOrders")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-[var(--tv-text-muted)]">
                    <th className="px-1 py-1 font-medium">{t("rt.colTime")}</th>
                    <th className="px-1 py-1 font-medium">{t("rt.colAction")}</th>
                    <th className="px-1 py-1 font-medium">{t("rt.colType")}</th>
                    <th className="px-1 py-1 font-medium">{t("rt.colSize")}</th>
                    <th className="px-1 py-1 text-right font-medium">{t("rt.colPrice")}</th>
                    <th className="px-1 py-1" />
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {working.map((o) => (
                    <tr key={o.id} className="border-t border-[var(--tv-border)]/60">
                      <td className="px-1 py-1.5 text-[var(--tv-text-muted)]">
                        {nyTimeOf(o.placedAt)}
                      </td>
                      <td
                        className={cn(
                          "px-1 py-1.5 font-bold",
                          o.side === "long"
                            ? "text-[var(--tv-chart-green)]"
                            : "text-[var(--tv-chart-red)]",
                        )}
                      >
                        {o.side === "long" ? t("rt.buy") : t("rt.sell")}
                        {/* Un bracket se distingue d'une entrée : il REFERME. */}
                        {o.reduceOnly && (
                          <span className="ml-1 text-[9px] font-semibold text-[var(--tv-text-muted)]">
                            {o.label}
                          </span>
                        )}
                      </td>
                      <td className="px-1 py-1.5 uppercase text-[var(--tv-text-muted)]">
                        {o.type}
                      </td>
                      <td className="px-1 py-1.5">{o.qty}</td>
                      <td className="px-1 py-1.5 text-right text-[var(--tv-text)]">
                        {o.price?.toFixed(2) ?? "—"}
                      </td>
                      <td className="px-1 py-1.5 text-right">
                        <button
                          type="button"
                          title={t("rt.cancelOrder")}
                          onClick={() => onCancelOrder(o.id)}
                          className="grid h-5 w-5 place-items-center rounded text-[var(--tv-danger)] transition hover:bg-[var(--tv-danger)]/15"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {tab === "history" &&
          (history.length === 0 ? (
            <Empty label={t("rt.noHistory")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-[var(--tv-text-muted)]">
                    {/* Ces en-têtes mélangeaient l'anglais et le français en
                      dur, dans la même ligne. R et P&L restent tels quels :
                      ils se lisent pareil dans les deux langues. */}
                    <th className="px-1 py-1 font-medium">{t("rt.colSide")}</th>
                    <th className="px-1 py-1 font-medium">{t("rt.colSize")}</th>
                    <th className="px-1 py-1 font-medium">{t("rt.colEntry")}</th>
                    <th className="px-1 py-1 font-medium">{t("rt.colExit")}</th>
                    <th className="px-1 py-1 font-medium">R</th>
                    <th className="px-1 py-1 text-right font-medium">P&L</th>
                    <th className="px-1 py-1" />
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {history.map((tr) => (
                    <tr key={tr.id} className="border-t border-[var(--tv-border)]/60">
                      <td className="px-1 py-1.5">{tr.side === "long" ? "L" : "S"}</td>
                      <td className="px-1 py-1.5">{tr.qty}</td>
                      <td className="px-1 py-1.5">{tr.entryPrice.toFixed(2)}</td>
                      <td className="px-1 py-1.5">{tr.exitPrice.toFixed(2)}</td>
                      <td className={cn("px-1 py-1.5", pnlColor(tr.rMultiple))}>
                        {tr.rMultiple.toFixed(2)}R
                      </td>
                      <td
                        className={cn(
                          "px-1 py-1.5 text-right font-semibold",
                          pnlColor(tr.realizedPnl),
                        )}
                      >
                        {tr.realizedPnl >= 0 ? "+" : ""}
                        {tr.realizedPnl.toFixed(2)} $
                      </td>
                      {/* Encoder MAINTENANT, pendant que le trade est frais —
                        plutôt qu'à la fin de séance, quand on ne se souvient
                        plus de ce qu'on avait en tête. La modale est celle du
                        journal, déjà remplie de ce que le terminal sait. */}
                      <td className="px-1 py-1.5 text-right">
                        <button
                          type="button"
                          title={t("rt.encode")}
                          onClick={() => requestTradeEncoding(tr)}
                          className="rounded-md border border-[var(--tv-border)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--tv-text-muted)] transition hover:border-[var(--tv-accent)] hover:text-[var(--tv-text)]"
                        >
                          {t("rt.encode")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>
    </div>
  );
}

function PositionRow({
  pos,
  mark,
  onChangeBracket,
  onClose,
}: {
  pos: Position;
  mark: number;
  onChangeBracket: (posId: string, sl: number | null, tp: number | null) => void;
  onClose: (posId: string) => void;
}) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [sl, setSl] = useState(pos.stopPrice != null ? String(pos.stopPrice) : "");
  const [tp, setTp] = useState(pos.targetPrice != null ? String(pos.targetPrice) : "");

  const dir = pos.side === "long" ? 1 : -1;
  const pnl = (mark - pos.avgEntry) * dir * pos.qty * NQ.multiplier;
  const pnlColor = pnl >= 0 ? "text-[var(--tv-chart-green)]" : "text-[var(--tv-chart-red)]";

  const applyBracket = () => {
    onChangeBracket(
      pos.id,
      sl ? roundToTick(Number(sl), NQ) : null,
      tp ? roundToTick(Number(tp), NQ) : null,
    );
    setEditing(false);
  };

  return (
    <div className="rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] p-2.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              pos.side === "long" ? "bg-[var(--tv-chart-green)]" : "bg-[var(--tv-chart-red)]",
            )}
          />
          <span className="text-xs font-bold text-[var(--tv-text)]">
            {pos.side === "long" ? t("rt.long") : t("rt.short")} NQ ·{" "}
            <span className="font-mono">{pos.qty}</span>
          </span>
        </span>
        <span className={cn("font-mono text-xs font-bold", pnlColor)}>
          {pnl >= 0 ? "+" : ""}
          {pnl.toFixed(0)} $
        </span>
      </div>

      <div className="mt-1.5 grid grid-cols-3 gap-1 text-center font-mono text-[11px]">
        <div className="rounded-lg bg-[var(--tv-surface-3)] px-1 py-1">
          <div className="text-[9px] uppercase text-[var(--tv-text-muted)]">Entrée</div>
          <div className="font-semibold text-[var(--tv-text)]">{pos.avgEntry.toFixed(2)}</div>
        </div>
        <div className="rounded-lg bg-[var(--tv-surface-3)] px-1 py-1">
          <div className="text-[9px] uppercase text-[var(--tv-text-muted)]">Mark</div>
          <div className="font-semibold text-[var(--tv-text)]">{mark.toFixed(2)}</div>
        </div>
        <div className="rounded-lg bg-[var(--tv-surface-3)] px-1 py-1">
          <div className="text-[9px] uppercase text-[var(--tv-text-muted)]">Risque</div>
          <div className="font-semibold text-[var(--tv-text)]">{pos.riskAmount.toFixed(0)} $</div>
        </div>
      </div>

      {editing ? (
        <div className="mt-2 flex items-center gap-1.5">
          <input
            value={sl}
            onChange={(e) => setSl(e.target.value)}
            placeholder="SL"
            className="w-full min-w-0 rounded-lg border border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-2 py-1 font-mono text-[11px] text-[var(--tv-text)] outline-none"
          />
          <input
            value={tp}
            onChange={(e) => setTp(e.target.value)}
            placeholder="TP"
            className="w-full min-w-0 rounded-lg border border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-2 py-1 font-mono text-[11px] text-[var(--tv-text)] outline-none"
          />
          <button
            type="button"
            onClick={applyBracket}
            className="rounded-lg px-2 py-1 text-[11px] font-semibold tv-accent-fill text-white"
          >
            OK
          </button>
        </div>
      ) : (
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-[var(--tv-text-muted)]">
            {pos.stopPrice != null ? `SL ${pos.stopPrice.toFixed(2)}` : "Pas de SL"} ·{" "}
            {pos.targetPrice != null ? `TP ${pos.targetPrice.toFixed(2)}` : "Pas de TP"}
          </span>
          <span className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setEditing(true)}
              title={t("rt.tool.cursor")}
              className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => onClose(pos.id)}
              title={t("rt.closePosition")}
              className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--tv-danger)]"
            >
              <CircleX className="h-3 w-3" />
              {t("rt.closePosition")}
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  const { t } = useT();
  void t;
  return (
    <div className="flex h-full items-center justify-center py-8 text-center text-xs text-[var(--tv-text-muted)]">
      <Trash2 className="mr-2 h-4 w-4 opacity-40" />
      {label}
    </div>
  );
}
