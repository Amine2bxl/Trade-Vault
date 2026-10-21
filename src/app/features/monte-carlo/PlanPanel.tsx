import { useRef, useState, type ReactNode } from "react";
import { Minus, Plus, RotateCcw, Upload, X } from "@/shared/ui/icons";
import { useT } from "@/app/i18n/LanguageContext";
import { cn } from "@/shared/ui/cn";
import { currencySymbol } from "@/shared/currency";
import { formatMoney } from "./format";
import type { Plan } from "./plan";

/**
 * LE PLAN — la stratégie du trader, préremplie depuis SES trades, et modifiable.
 *
 * Deux groupes, dans l'ordre où l'on raisonne :
 *
 *   • TA STRATÉGIE — taux de réussite, gain moyen, perte moyenne, neutres,
 *     cadence. Ce qui fait l'edge. Tout part du journal ; chaque champ
 *     modifié rappelle sa valeur d'origine, pour qu'on sache toujours de
 *     combien on s'en écarte.
 *   • TON COMPTE — capital, risque par trade, horizon, objectif, limite. Ce
 *     qui transforme l'edge en trajectoire.
 *
 * Deux raccourcis : revenir à « mon edge », ou essayer « sans mes erreurs »
 * (ses trades sans erreur cochée, quand il y en a assez). La simulation
 * repart seule à chaque changement.
 */
export function PlanPanel({
  plan,
  base,
  onChange,
  onReset,
  source,
  clean,
  onCleanPreset,
  onCsv,
  onCsvClear,
  csvError,
}: {
  plan: Plan;
  /** Le plan de départ (lu dans les trades) — sert de repère « avant ». */
  base: Plan;
  onChange: (patch: Partial<Plan>) => void;
  onReset: () => void;
  source: { kind: "journal" | "csv" | "model"; label: string; n: number };
  /** Le raccourci « sans mes erreurs », s'il est comparable. */
  clean: { n: number; active: boolean } | null;
  onCleanPreset: () => void;
  onCsv: (f: File) => void;
  onCsvClear: () => void;
  csvError: string | null;
}) {
  const { t } = useT();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cur = currencySymbol();
  const was = (k: keyof Plan, fmt: (v: number) => string) =>
    Math.abs(plan[k] - base[k]) > 1e-9 ? t("mc.was").replace("{v}", fmt(base[k])) : undefined;
  const risk$ = (plan.balance * plan.riskPct) / 100;

  return (
    <div className="space-y-5">
      {/* ── LA SOURCE ── */}
      <div>
        <div className="mc-source">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">{source.label}</span>
            <span className="tv-row-label block truncate">
              {source.kind === "model"
                ? t("mc.planModel")
                : t("mc.sampleCount").replace("{n}", String(source.n))}
            </span>
          </span>
          {source.kind === "csv" ? (
            <button
              type="button"
              onClick={onCsvClear}
              aria-label={t("mc.useJournal")}
              title={t("mc.useJournal")}
              className="mc-icon-btn"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} className="mc-alt">
              <Upload className="h-3.5 w-3.5" />
              {t("mc.importCsv")}
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onCsv(f);
            e.target.value = "";
          }}
        />
        {csvError && <p className="rp-neg mt-2 text-xs">{csvError}</p>}
      </div>

      {/* ── TA STRATÉGIE ── */}
      <fieldset className="space-y-3">
        <legend className="mc-legend tv-label text-slate-400">{t("mc.planTitle")}</legend>
        <div className="flex flex-wrap gap-1.5">
          <Preset active={!clean?.active && sameEdge(plan, base)} onClick={onReset}>
            {t("mc.presetMine")}
          </Preset>
          {clean && (
            <Preset
              active={clean.active}
              onClick={onCleanPreset}
              title={t("mc.presetCleanHint").replace("{n}", String(clean.n))}
            >
              {t("mc.presetClean")}
            </Preset>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          <Reglage
            label={t("stats.winRate")}
            value={plan.winRate}
            onChange={(v) => onChange({ winRate: v })}
            min={5}
            max={95}
            step={1}
            unite="%"
            hint={was("winRate", (v) => `${v}%`)}
          />
          <Reglage
            label={t("mc.beRate")}
            value={plan.beRate}
            onChange={(v) => onChange({ beRate: v })}
            min={0}
            max={60}
            step={1}
            unite="%"
            hint={was("beRate", (v) => `${v}%`)}
          />
          <Reglage
            label={t("mc.avgWin")}
            value={plan.avgWinR}
            onChange={(v) => onChange({ avgWinR: v })}
            min={0.1}
            max={10}
            step={0.1}
            decimals={2}
            unite="R"
            hint={was("avgWinR", (v) => `${v.toFixed(2)}R`)}
          />
          <Reglage
            label={t("mc.avgLoss")}
            value={plan.avgLossR}
            onChange={(v) => onChange({ avgLossR: v })}
            min={0.1}
            max={5}
            step={0.05}
            decimals={2}
            unite="R"
            hint={was("avgLossR", (v) => `${v.toFixed(2)}R`)}
          />
          <Reglage
            label={t("mc.perDayLabel")}
            value={plan.tradesPerDay}
            onChange={(v) => onChange({ tradesPerDay: v })}
            min={1}
            max={10}
            step={1}
            hint={was("tradesPerDay", (v) => String(v))}
          />
        </div>
      </fieldset>

      {/* ── TON COMPTE ── */}
      <fieldset className="space-y-3">
        <legend className="mc-legend tv-label text-slate-400">{t("mc.accountTitle")}</legend>
        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          <Reglage
            label={t("mc.balance")}
            value={plan.balance}
            onChange={(v) => onChange({ balance: v })}
            min={1000}
            max={1_000_000}
            step={plan.balance >= 100_000 ? 10_000 : 1000}
            unite={cur}
          />
          <Reglage
            label={t("mc.risk")}
            value={plan.riskPct}
            onChange={(v) => onChange({ riskPct: v })}
            min={0.05}
            max={5}
            step={0.05}
            decimals={2}
            unite="%"
            hint={`${formatMoney(risk$)} · 1R`}
          />
          <Reglage
            label={t("mc.horizon")}
            value={plan.days}
            onChange={(v) => onChange({ days: v })}
            min={5}
            max={120}
            step={5}
            unite={t("mc.days")}
          />
          <Reglage
            label={t("mc.target")}
            value={plan.targetPct}
            onChange={(v) => onChange({ targetPct: v })}
            min={1}
            max={100}
            step={1}
            unite="%"
            hint={`+${formatMoney((plan.balance * plan.targetPct) / 100)}`}
          />
          <Reglage
            label={t("mc.limit")}
            value={plan.limitPct}
            onChange={(v) => onChange({ limitPct: v })}
            min={1}
            max={50}
            step={1}
            unite="%"
            hint={`−${formatMoney((plan.balance * plan.limitPct) / 100)}`}
          />
        </div>
      </fieldset>

      <button type="button" onClick={onReset} className="btn-ghost btn-sm">
        <RotateCcw className="h-3.5 w-3.5" />
        {t("mc.reset")}
      </button>
    </div>
  );
}

const sameEdge = (a: Plan, b: Plan) =>
  a.winRate === b.winRate &&
  a.avgWinR === b.avgWinR &&
  a.avgLossR === b.avgLossR &&
  a.beRate === b.beRate;

function Preset({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn("mc-preset", active && "mc-preset-on")}
    >
      {children}
    </button>
  );
}

/**
 * UN RÉGLAGE — un libellé, deux boutons − / + qui avancent d'un pas rond, et un
 * champ où l'on tape la valeur exacte. Le geste rapide et le geste précis,
 * sans se marcher dessus.
 *
 * Le champ est un BROUILLON tant qu'on tape : effacer « 10000 » pour taper
 * « 25000 » passe par la chaîne vide, que `Number("")` transforme en 0 — la
 * valeur retombait au minimum sous les doigts. La valeur ne remonte que si
 * elle est lisible, et elle est bornée à la sortie du champ.
 */
function Reglage({
  label,
  value,
  onChange,
  min,
  max,
  step,
  hint,
  unite,
  decimals = 0,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  hint?: string;
  unite?: string;
  decimals?: number;
}) {
  const [brouillon, setBrouillon] = useState<string | null>(null);
  const affiche = brouillon ?? (decimals > 0 ? value.toFixed(decimals) : String(value));
  const borner = (n: number) => Math.min(max, Math.max(min, n));
  const poser = (brut: string) => {
    setBrouillon(brut);
    const n = Number(brut.replace(",", "."));
    if (brut.trim() !== "" && Number.isFinite(n) && n >= min && n <= max) onChange(n);
  };
  const fermer = () => {
    setBrouillon(null);
    const n = Number(affiche.replace(",", "."));
    onChange(Number.isFinite(n) ? borner(n) : min);
  };
  const pas = (sens: 1 | -1) => {
    setBrouillon(null);
    const brut = borner(value + sens * step);
    // Arrondi au pas : 12 345 poussé d'un pas de 1 000 donne 13 000, pas 13 345.
    onChange(Number(borner(Math.round(brut / step) * step).toFixed(Math.max(decimals, 2))));
  };

  return (
    <div className="min-w-0">
      <label className="tv-label mb-1 block truncate text-slate-500">{label}</label>
      <div className="mc-step">
        <button
          type="button"
          onClick={() => pas(-1)}
          disabled={value <= min}
          aria-label={`${label} −`}
          className="mc-step-btn"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <input
          type="text"
          inputMode="decimal"
          value={affiche}
          onChange={(e) => poser(e.target.value)}
          onBlur={fermer}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "ArrowUp") {
              e.preventDefault();
              pas(1);
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              pas(-1);
            }
          }}
          aria-label={label}
          className="mc-step-input"
        />
        {unite && <span className="mc-step-unit">{unite}</span>}
        <button
          type="button"
          onClick={() => pas(1)}
          disabled={value >= max}
          aria-label={`${label} +`}
          className="mc-step-btn"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {hint && <div className="tv-row-label mt-1 truncate">{hint}</div>}
    </div>
  );
}
