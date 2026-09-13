/**
 * AccountHealthCard — LA BANDE OÙ TOUT SE JOUE.
 *
 * Sur un compte financé, un solde seul ne veut rien dire : ce qui compte est
 * sa position entre DEUX bornes — le plancher qui fait perdre le compte, et la
 * cible qui le fait passer. Cette carte ne montre que cela.
 *
 *   ┌ courbe du solde, avec la ligne de plancher en tirets ─────────────┐
 *   │ [MLL ████████████░░░░░░░░ CIBLE]                                  │
 *   │  drawdown          solde            restant                       │
 *   └───────────────────────────────────────────────────────────────────┘
 *
 * TROIS DÉCISIONS :
 *
 *  • LA LIGNE DE PLANCHER EST TRACÉE, pas seulement chiffrée. Un montant
 *    « MLL 48 089 $ » oblige à le comparer mentalement au solde à chaque
 *    lecture ; une ligne sous la courbe donne la marge d'un coup d'œil, et
 *    montre en plus comment elle a évolué — ce qu'un trailing rend crucial.
 *  • RIEN N'EST INVENTÉ. Sans règle configurée sur le compte, il n'y a ni
 *    plancher, ni restant, ni pourcentage : on trace la courbe et on invite à
 *    saisir les règles. Un « restant » calculé sur une limite supposée serait
 *    cru, et c'est précisément le chiffre sur lequel on décide de couper.
 *  • ELLE IGNORE L'ENVIRONNEMENT. Elle reçoit des trades, un capital de départ
 *    et des règles : le journal réel et la section rejeu lui passent les leurs,
 *    et lisent le même calcul.
 */

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Trade } from "../types";
import type { AccountRules } from "@/modules/probability/rules";
import { computeAccountHealth } from "../utils/accountHealth";
import {
  AXIS_TICK,
  CHART_GREEN,
  EQUITY_CURVE_TYPE,
  EQUITY_GRID,
  EQUITY_LINE,
  areaGradientStops,
  formatAxisDate,
  formatAxisMoney,
  tooltipStyle,
} from "../utils/chartTheme";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";

export interface AccountHealthCardProps {
  trades: Trade[];
  startingBalance: number;
  /** Les règles du compte. `null` = aucune n'a été saisie. */
  rules?: AccountRules | null;
  className?: string;
}

function money(n: number): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/** Une des trois grandeurs du pied de carte. */
function Figure({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div className="min-w-0 text-center">
      <div className={cn("tv-figure truncate text-sm font-bold", tone ?? "text-[var(--tv-text)]")}>
        {value}
      </div>
      <div className="truncate text-[10px] text-[var(--tv-text-muted)]">{label}</div>
    </div>
  );
}

export default function AccountHealthCard({
  trades,
  startingBalance,
  rules,
  className,
}: AccountHealthCardProps) {
  const { t } = useT();
  const health = useMemo(
    () => computeAccountHealth(trades, startingBalance, rules),
    [trades, startingBalance, rules],
  );

  const gradientId = "tvHealthArea";
  const stops = areaGradientStops(CHART_GREEN);

  /** La courbe, avec le point de départ en tête pour qu'elle parte du capital. */
  const data = useMemo(
    () => [
      { date: "", balance: health.startingBalance, floor: health.curve[0]?.floor ?? null },
      ...health.curve,
    ],
    [health],
  );

  const hasCurve = health.curve.length > 0;

  return (
    <section
      className={cn(
        "rounded-2xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] p-4",
        className,
      )}
      aria-label={t("dash.health")}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-[var(--tv-text)]">{t("dash.health")}</h3>
        {health.progress != null && (
          <span className="tv-figure text-sm font-bold text-[var(--tv-chart-green)]">
            {(health.progress * 100).toFixed(2)}%
            <span className="ml-1 text-[10px] font-medium text-[var(--tv-text-muted)]">
              {t("dash.toTarget")}
            </span>
          </span>
        )}
      </div>

      {/* LA COURBE — solde plein, plancher en tirets. */}
      <div className="mt-3 h-[150px] w-full">
        {hasCurve ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  {stops.map((s) => (
                    <stop key={s.offset} {...s} />
                  ))}
                </linearGradient>
              </defs>
              <CartesianGrid {...EQUITY_GRID} />
              <XAxis
                dataKey="date"
                tick={AXIS_TICK}
                tickFormatter={(v: string) => (v ? formatAxisDate(v) : "")}
                axisLine={false}
                tickLine={false}
                minTickGap={28}
              />
              <YAxis
                tick={AXIS_TICK}
                tickFormatter={formatAxisMoney}
                axisLine={false}
                tickLine={false}
                width={62}
                domain={["dataMin", "dataMax"]}
              />
              <Tooltip
                {...tooltipStyle}
                formatter={(v: number | string) => money(Number(v))}
                labelFormatter={(v: string) => (v ? formatAxisDate(v) : "")}
              />
              <Area
                type={EQUITY_CURVE_TYPE}
                dataKey="balance"
                stroke={CHART_GREEN}
                strokeWidth={EQUITY_LINE.strokeWidth}
                strokeLinecap={EQUITY_LINE.strokeLinecap}
                fill={`url(#${gradientId})`}
                dot={false}
                isAnimationActive={false}
                name={t("dash.balance")}
              />
              {/* LE PLANCHER — en tirets rouges, comme tout repère du produit.
                Il n'est tracé que s'il existe : une ligne posée à `-Infinity`
                écraserait l'échelle et rendrait la courbe illisible. */}
              {health.floor != null && (
                <Line
                  type="stepAfter"
                  dataKey="floor"
                  stroke="var(--tv-chart-red)"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  dot={false}
                  isAnimationActive={false}
                  name={t("dash.minimum")}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center text-[11px] text-[var(--tv-text-muted)]">
            {t("dash.noHistory")}
          </div>
        )}
      </div>

      {/* La légende, deux points — solde et minimum. */}
      <div className="mt-1 flex items-center justify-center gap-4 text-[10px] text-[var(--tv-text-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--tv-chart-green)]" />
          {t("dash.balance")}
        </span>
        {health.floor != null && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--tv-chart-red)]" />
            {t("dash.minimum")}
          </span>
        )}
      </div>

      {/* LA BANDE — du plancher à la cible. */}
      {health.floor != null && health.target != null ? (
        <>
          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className="tv-figure font-bold text-[var(--tv-chart-red)]">
              {money(health.floor)}
              <span className="ml-1 text-[9.5px] font-medium text-[var(--tv-text-muted)]">
                {t("dash.mll")}
              </span>
            </span>
            <span className="tv-figure font-bold text-[var(--tv-chart-green)]">
              {money(health.target)}
              <span className="ml-1 text-[9.5px] font-medium text-[var(--tv-text-muted)]">
                {t("dash.target")}
              </span>
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--tv-plate-2)]">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500",
                health.breached ? "bg-[var(--tv-chart-red)]" : "bg-[var(--tv-chart-green)]",
              )}
              style={{ width: `${Math.round((health.progress ?? 0) * 100)}%` }}
            />
          </div>
        </>
      ) : (
        <p className="mt-3 text-center text-[10.5px] leading-snug text-[var(--tv-text-muted)]">
          {t("dash.noRules")}
        </p>
      )}

      {/* Les trois grandeurs. */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Figure
          value={money(health.drawdown)}
          label={t("dash.drawdown")}
          tone={health.drawdown > 0 ? "text-[var(--tv-chart-red)]" : undefined}
        />
        <Figure value={money(health.balance)} label={t("dash.balance")} />
        <Figure
          value={health.remaining == null ? "—" : money(health.remaining)}
          label={t("dash.remaining")}
          tone={
            health.remaining != null && health.remaining <= 0
              ? "text-[var(--tv-chart-red)]"
              : undefined
          }
        />
      </div>
    </section>
  );
}
