import { useMemo, useState } from "react";
import { Scale, Loader2, RotateCcw, ShieldCheck, ArrowRight } from "lucide-react";
import { Button, Modal } from "@/shared/ui";
import { useT } from "../i18n/LanguageContext";
import { useAccounts } from "../contexts/AccountContext";
import { useToast } from "../contexts/ToastContext";
import { cn } from "../utils/cn";
import type { Trade } from "../types";
import {
  factorFor,
  isCalibrated,
  pickPreviewTrade,
  previewCalibration,
  type CalibrationPreviewRow,
} from "../utils/accountCalibration";

/**
 * Recalibrage d'échelle — l'écran de décision.
 *
 * L'opération n'est pas intuitive : le trader doit comprendre AVANT de
 * confirmer que ses trades ne seront pas réécrits, que son comportement ne
 * sera pas retouché, et que ses ratios ne bougeront pas. La preuve la plus
 * convaincante n'est pas un paragraphe, c'est son PROPRE trade montré avant /
 * après — avec le R multiple et le risque en % affichés côte à côte,
 * identiques.
 */
export default function RecalibrateAccountModal({
  accountId,
  trades,
  onClose,
}: {
  accountId: string;
  trades: Trade[];
  onClose: () => void;
}) {
  const { t } = useT();
  const { accounts, recalibrate } = useAccounts();
  const { toast } = useToast();
  const account = accounts.find((a) => a.id === accountId) ?? null;

  const original = account ? account.originalBalance || account.startingBalance : 0;
  const current = account?.startingBalance ?? 0;
  const [target, setTarget] = useState(String(current || ""));
  const [saving, setSaving] = useState(false);

  const targetValue = Number(target) || 0;
  // Le facteur porte sur la représentation COURANTE : c'est elle qui est
  // stockée, puisqu'un recalibrage précédent a réellement converti les lignes.
  const factor = factorFor(current, targetValue);
  const valid = targetValue > 0 && Number.isFinite(targetValue);

  const sample = useMemo(() => pickPreviewTrade(trades), [trades]);
  const rows = useMemo(
    () => (valid ? previewCalibration(sample, current, targetValue, factor) : []),
    [sample, current, targetValue, factor, valid],
  );

  const alreadyCalibrated = isCalibrated(account?.calibrationScale);
  const noChange = valid && Math.abs(targetValue - current) < 0.005;

  const submit = async (to: number) => {
    if (saving || to <= 0) return;
    setSaving(true);
    try {
      const converted = await recalibrate(accountId, to);
      // Le nombre réellement converti : c'est la preuve que seuls les trades
      // déjà encodés ont bougé.
      toast(t("recal.done").replace("{n}", String(converted)), "success");
      onClose();
    } catch (e) {
      console.error("Recalibration failed", e);
      toast(t("recal.failed"), "error");
    } finally {
      setSaving(false);
    }
  };

  if (!account) return null;

  return (
    <Modal open onClose={onClose} className="md:max-w-lg">
      <div className="px-6 py-5 space-y-5">
        <header className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl tv-accent-fill">
            <Scale className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display tv-title leading-tight">{t("recal.title")}</h2>
            <p className="tv-prose text-slate-500 mt-1">{t("recal.subtitle")}</p>
          </div>
        </header>

        {/* Échelle actuelle — répond à « à quelle échelle mon historique
            est-il représenté ? », qui doit toujours avoir une réponse. */}
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 space-y-1.5">
          <Line label={t("recal.original")} value={money(original)} />
          <Line
            label={t("recal.currentScale")}
            value={
              alreadyCalibrated
                ? `${money(current)} · ${fmtScale(account.calibrationScale)}`
                : t("recal.none")
            }
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
            {t("recal.targetLabel")}
          </label>
          <input
            type="number"
            min={1}
            step={1000}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            autoFocus
            className="tv-figure w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/50"
          />
          {valid && !noChange && (
            <p className="tv-figure mt-2 text-[11px] text-cyan-400">
              {t("recal.scaleIs").replace("{scale}", fmtScale(factor))}
            </p>
          )}
        </div>

        {/* L'aperçu sur un trade RÉEL du journal. */}
        {valid && !noChange && rows.length > 0 && (
          <div className="rounded-xl border border-white/[0.07] overflow-hidden">
            <div className="tv-label px-3.5 py-2 border-b border-white/[0.05] text-slate-500">
              {sample ? t("recal.previewOn").replace("{date}", sample.date) : t("recal.preview")}
            </div>
            <ul className="divide-y divide-white/[0.04]">
              {rows.map((r) => (
                <PreviewLine
                  key={r.key}
                  row={r}
                  label={t(r.key)}
                  unchanged={t("recal.unchanged")}
                />
              ))}
            </ul>
          </div>
        )}

        {/* Ce que le recalibrage ne touche pas. Dit explicitement, parce que
            c'est la première inquiétude légitime du trader. */}
        <div className="rounded-xl bg-emerald-500/[0.05] border border-emerald-500/20 px-4 py-3 flex gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-slate-300 leading-relaxed space-y-1">
            <p className="font-semibold text-emerald-300">{t("recal.safeTitle")}</p>
            <p>{t("recal.safeBody")}</p>
            <p>{t("recal.safeBehaviour")}</p>
            {/* Les objectifs vivent dans `goal_plans`, qui n'a PAS de lien
                vers un compte : impossible de savoir si une cible de capital
                concerne celui-ci. On le dit plutôt que de deviner. */}
            <p className="text-slate-400">{t("recal.goalsNote")}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={onClose} className="sm:flex-1">
            {t("common.cancel")}
          </Button>
          {/* Le retour à l'origine est offert dès qu'une calibration est
              active : l'opération doit être visiblement réversible, pas
              seulement techniquement. */}
          {alreadyCalibrated && (
            <Button
              variant="ghost"
              onClick={() => submit(original)}
              disabled={saving}
              className="sm:flex-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t("recal.reset")}
            </Button>
          )}
          <Button
            onClick={() => submit(targetValue)}
            disabled={!valid || noChange || saving}
            className="sm:flex-1 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />}
            {t("recal.confirm")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className="tv-figure text-[12px] text-slate-200">{value}</span>
    </div>
  );
}

/** Une ligne d'aperçu. Les grandeurs invariantes portent un libellé explicite
 *  plutôt qu'une flèche : « inchangé » se lit plus vite que « 2.0 → 2.0 ». */
function PreviewLine({
  row,
  label,
  unchanged,
}: {
  row: CalibrationPreviewRow;
  label: string;
  unchanged: string;
}) {
  const same = Math.abs(row.after - row.before) < 0.005;
  const fmt = (n: number) =>
    row.format === "money"
      ? money(n)
      : row.format === "percent"
        ? `${n.toFixed(2)}%`
        : n.toFixed(2);
  return (
    <li className="flex items-center gap-2 px-3.5 py-2 text-xs">
      <span className="text-slate-500 flex-1 min-w-0 truncate">{label}</span>
      {same ? (
        <>
          <span className="tv-figure text-slate-300">{fmt(row.before)}</span>
          <span className="tv-label text-emerald-400/80 shrink-0">{unchanged}</span>
        </>
      ) : (
        <>
          <span className="tv-figure text-slate-500">{fmt(row.before)}</span>
          <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
          <span className={cn("tv-figure", row.after >= 0 ? "text-cyan-300" : "text-amber-300")}>
            {fmt(row.after)}
          </span>
        </>
      )}
    </li>
  );
}

function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/** `2×`, `0.5×`, `1.25×` — jamais `2.00×`, qui donne l'air d'un arrondi. */
function fmtScale(scale: number): string {
  const s = Number(scale.toFixed(4));
  return `${s}×`;
}
