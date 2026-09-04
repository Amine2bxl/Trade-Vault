import { memo, useMemo } from "react";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  AXIS_TICK,
  EQUITY_ANIMATION,
  EQUITY_CURVE_TYPE,
  EQUITY_FLOOR,
  EQUITY_GRID,
  EQUITY_LINE,
  CHART_GREEN,
  CHART_RED,
  formatAxisDate,
  niceEquityScale,
  EQUITY_X_PADDING,
} from "../utils/chartTheme";
import { formatShortDate } from "../utils/tradeCalcs";
import { useT } from "../i18n/LanguageContext";

type EquityPoint = { date: string; equity: number };

/**
 * La courbe d'equity — calquée sur les tableaux de bord de prop firm.
 *
 * Ce qui fait le style, et qui n'est pas décoratif :
 *
 *   • UNE COURBE RONDE. Spline cubique, trait de 3px, bouts ronds. On lit une
 *     trajectoire, pas une suite de segments.
 *   • UNE MASSE SOUS LA COURBE. Le dégradé descend de 30 % à zéro : assez
 *     dense pour que la zone sous le trait pèse et que la montée se lise de
 *     loin, assez transparent pour ne pas devenir un bloc.
 *   • UN REPÈRE EN TIRETS. Le solde de départ, en saumon : au-dessus on gagne,
 *     en dessous on perd. Le pointillé dit « repère », pas « mesure ».
 *   • AUCUN POINT SUR LE TRACÉ. Les pastilles posées sur le meilleur et le
 *     pire point cassaient la ligne en trois morceaux et donnaient à lire des
 *     évènements là où il n'y a qu'une trajectoire. Le point n'apparaît qu'au
 *     survol, là où il sert.
 *   • DES MONTANTS ENTIERS EN ORDONNÉE. « $58,000 », pas « $58.0k » : c'est ce
 *     qu'affiche la référence, et un solde de compte se lit en entier.
 */
function EquityChart({ data }: { data: EquityPoint[] }) {
  const { t } = useT();
  const breakEven = data.length > 0 ? data[0].equity : 0;
  // Le vert de la DONNÉE, pas l'accent du thème : une courbe qui monte est
  // verte sur Amber comme sur Steel. Voir `CHART_GREEN`.
  const gain = data.length > 0 && data[data.length - 1].equity >= breakEven;
  const accent = gain ? CHART_GREEN : CHART_RED;

  // Des paliers RONDS, et une largeur d'axe qui suit la longueur réelle du
  // plus grand montant : une largeur fixe rognait « $158,000 » et laissait un
  // trou devant « $940 ».
  const { domain, ticks } = useMemo(() => niceEquityScale(data.map((p) => p.equity)), [data]);
  const axisWidth = useMemo(() => {
    const widest = ticks.reduce((m, t) => Math.max(m, Math.abs(t)), 0);
    return 22 + `${Math.round(widest).toLocaleString("en-US")}`.length * 8;
  }, [ticks]);

  if (data.length === 0) return null;

  return (
    <div className="flex h-full flex-col">
      {/* La légende, au-dessus et à gauche — deux pastilles, deux mots. */}
      <div className="mb-2 flex items-center gap-4 pl-1">
        <span className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: accent }}
            aria-hidden="true"
          />
          <span className="text-[11px] text-slate-400">{t("chart.balance")}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: EQUITY_FLOOR.stroke }}
            aria-hidden="true"
          />
          <span className="text-[11px] text-slate-400">{t("chart.breakEven")}</span>
        </span>
      </div>

      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity={0.3} />
                <stop offset="55%" stopColor={accent} stopOpacity={0.1} />
                <stop offset="100%" stopColor={accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...EQUITY_GRID} />
            <XAxis
              dataKey="date"
              padding={EQUITY_X_PADDING}
              tick={AXIS_TICK}
              minTickGap={40}
              tickFormatter={(v) => formatAxisDate(v as string)}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              orientation="right"
              domain={domain}
              ticks={ticks}
              tick={AXIS_TICK}
              tickFormatter={(v) => `$${Math.round(v as number).toLocaleString("en-US")}`}
              axisLine={false}
              tickLine={false}
              width={axisWidth}
            />
            <ReferenceLine y={breakEven} {...EQUITY_FLOOR} />
            <Tooltip
              cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeOpacity: 0.22 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const val = payload[0].value as number;
                const delta = val - breakEven;
                return (
                  <div className="glass-strong rounded-2xl px-3 py-2 shadow-[var(--tv-elev-3)]">
                    <p className="tv-label text-slate-500">{formatShortDate(label as string)}</p>
                    <p className="tv-figure mt-0.5 text-sm text-white">
                      $
                      {Number(val).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    <p
                      className={
                        delta >= 0
                          ? "tv-figure text-[11px] text-emerald-400"
                          : "tv-figure text-[11px] text-red-400"
                      }
                    >
                      {delta >= 0 ? "+$" : "-$"}
                      {Math.abs(delta).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                );
              }}
            />
            <Area
              type={EQUITY_CURVE_TYPE}
              dataKey="equity"
              stroke={accent}
              {...EQUITY_LINE}
              fill="url(#eqGrad)"
              dot={false}
              activeDot={{
                r: 5,
                strokeWidth: 3,
                stroke: "var(--tv-plate-1)",
                fill: accent,
              }}
              {...EQUITY_ANIMATION}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default memo(EquityChart);
