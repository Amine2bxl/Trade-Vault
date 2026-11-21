import { Badge, EmptyState } from "@/shared/ui";
import { TrendingUp } from "@/shared/ui/icons";
import { useT } from "@/app/i18n/LanguageContext";
import type { TKey } from "@/app/i18n/translations";
import { MIN_GROUP_SESSIONS } from "@/modules/patterns/thresholds";
import type { BehaviourTrend, Evolution, TrendStatus } from "@/modules/knowledge";
import { formatMoney } from "@/shared/currency";
import { formatDay, formatMonth } from "./presentation";

/**
 * ÉVOLUTION — le trader comparé à lui-même. Le plateau montre le résultat
 * par trade, mois par mois, et la fréquence de l'erreur choisie ; le panneau
 * classe chaque erreur (déclarée ou observée) selon que l'écart entre ses
 * séances récentes et les plus anciennes TIENT ou non.
 */

const ORDER: TrendStatus[] = [
  "new",
  "worsening",
  "persistent",
  "improving",
  "resolved",
  "stable",
  "insufficient",
];
const TONE: Record<TrendStatus, "loss" | "warning" | "profit" | "neutral"> = {
  new: "loss",
  worsening: "loss",
  persistent: "warning",
  improving: "profit",
  resolved: "profit",
  stable: "neutral",
  insufficient: "neutral",
};

function trendLabel(key: string, t: (k: TKey) => string): string {
  const [kind, ...rest] = key.split(":");
  const name = rest.join(":");
  return kind === "sig" ? t(`brain.err.${name}` as TKey) : name;
}

export function EvolutionList({
  evolution,
  selected,
  onSelect,
}: {
  evolution: Evolution | null;
  selected: string | null;
  onSelect: (key: string) => void;
}) {
  const { t, lang } = useT();
  if (!evolution || !evolution.trends.length)
    return (
      <EmptyState
        icon={<TrendingUp className="h-5 w-5" />}
        title={t("brain.evo.title")}
        description={t("brain.evo.empty").replace("{n}", String(2 * MIN_GROUP_SESSIONS))}
      />
    );
  const sorted = [...evolution.trends].sort(
    (a, b) =>
      ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || Math.abs(b.diff) - Math.abs(a.diff),
  );
  const pct = (v: number) => `${Math.round(v * 100)} %`;
  return (
    <div className="grid gap-2">
      <p className="tv-hint text-slate-500">
        {t("brain.evo.since").replace(
          "{d}",
          evolution.since ? formatDay(evolution.since, lang) : "—",
        )}
      </p>
      {sorted.map((tr: BehaviourTrend) => (
        <button
          key={tr.key}
          type="button"
          className="brain-link"
          aria-pressed={tr.key === selected}
          onClick={() => onSelect(tr.key)}
        >
          <span className="min-w-0 flex-1 truncate">
            {trendLabel(tr.key, t)}
            <span className="tv-hint ml-1.5 text-slate-500">
              {t(tr.key.startsWith("sig:") ? "brain.evo.sig" : "brain.evo.tag")}
            </span>
          </span>
          <span className="tv-num brain-link-meta">
            {pct(tr.earlier)} → {pct(tr.recent)}
          </span>
          <Badge variant={TONE[tr.status]}>{t(`brain.evo.status.${tr.status}` as TKey)}</Badge>
        </button>
      ))}
    </div>
  );
}

const W = 640;
const H = 240;
const PAD = 30;

export function EvolutionStage({
  evolution,
  selected,
}: {
  evolution: Evolution | null;
  selected: string | null;
}) {
  const { t, lang } = useT();
  if (!evolution || !evolution.windows.length)
    return <p className="tv-prose text-slate-400">{t("brain.sim.computing")}</p>;
  const w = evolution.windows;
  const values = w.map((m) => m.expectancy ?? 0);
  const max = Math.max(1, ...values.map(Math.abs));
  const bw = (W - 2 * PAD) / w.length;
  const mid = H / 2;
  const trend = selected ? evolution.trends.find((x) => x.key === selected) : null;
  const rates = selected ? w.map((m) => m.rates[selected] ?? 0) : [];
  return (
    <div className="grid gap-4">
      <div>
        <h3 className="tv-title text-white">{t("brain.evo.chartTitle")}</h3>
        <p className="tv-hint mt-1 text-slate-500">{t("brain.evo.chartHint")}</p>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="brain-chart w-full"
        role="img"
        aria-label={t("brain.evo.chartTitle")}
      >
        <line x1={PAD} x2={W - PAD} y1={mid} y2={mid} stroke="var(--tv-border-strong)" />
        {w.map((m, i) => {
          const v = m.expectancy;
          const h = v === null ? 6 : (Math.abs(v) / max) * (mid - PAD);
          const x = PAD + i * bw + bw * 0.18;
          const fill =
            v === null
              ? "var(--tv-plate-3)"
              : v >= 0
                ? "var(--tv-chart-green)"
                : "var(--tv-chart-red)";
          return (
            <g key={m.month}>
              <rect
                x={x}
                y={v !== null && v < 0 ? mid : mid - h}
                width={bw * 0.64}
                height={h}
                rx={2}
                fill={fill}
                fillOpacity={0.85}
              >
                <title>
                  {`${formatMonth(m.month, lang)} · ${v === null ? t("brain.metric.tooFew") : formatMoney(v, { signed: true })} · n ${m.n}`}
                </title>
              </rect>
              {(w.length <= 12 || i % Math.ceil(w.length / 12) === 0) && (
                <text x={x + bw * 0.32} y={H - 8} textAnchor="middle">
                  {m.month.slice(2)}
                </text>
              )}
            </g>
          );
        })}
        {selected && rates.length > 1 && (
          <path
            d={rates
              .map(
                (r, i) =>
                  `${i ? "L" : "M"}${(PAD + i * bw + bw / 2).toFixed(1)},${(H - PAD - r * (H - 2 * PAD)).toFixed(1)}`,
              )
              .join(" ")}
            fill="none"
            stroke="var(--tv-accent)"
            strokeWidth={2}
          />
        )}
      </svg>
      <div className="brain-legend-inline">
        <span>
          <i style={{ background: "var(--tv-chart-green)" }} />
          {t("brain.evo.expectancy")}
        </span>
        {trend && (
          <span>
            <i style={{ background: "var(--tv-accent)" }} />
            {trendLabel(trend.key, t)}
          </span>
        )}
      </div>
      {trend && (
        <p className="tv-prose tv-num text-slate-300">
          {t("brain.evo.detail")
            .replace("{name}", trendLabel(trend.key, t))
            .replace("{a}", `${Math.round(trend.earlier * 100)} %`)
            .replace("{na}", String(trend.nEarlier))
            .replace("{b}", `${Math.round(trend.recent * 100)} %`)
            .replace("{nb}", String(trend.nRecent))
            .replace(
              "{ci}",
              trend.low === null || trend.high === null
                ? t("brain.evo.noCi")
                : `${Math.round(trend.low * 100)} / ${Math.round(trend.high * 100)} pts`,
            )}
        </p>
      )}
    </div>
  );
}
