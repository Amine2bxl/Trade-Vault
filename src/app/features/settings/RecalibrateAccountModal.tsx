import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2, Lock, RotateCcw, Scale, ShieldCheck, X } from "lucide-react";
import { Badge, Button, Chip, CHIP_ROW, FIELD_BASE, Modal, SelectPicker, cn } from "@/shared/ui";
import { useT } from "@/app/i18n/LanguageContext";
import { useAuth } from "@/app/contexts/AuthContext";
import { useAccounts } from "@/app/contexts/AccountContext";
import { useToast } from "@/app/contexts/ToastContext";
import { useSubscription } from "@/app/hooks/useSubscription";
import { loadUserTrades } from "@/app/store/trades";
import { isPlanLimitError } from "@/app/utils/planLimits";
import type { Trade } from "@/app/types";
import {
  factorFor,
  fmtFactor,
  isCalibrated,
  pickPreviewTrade,
  previewCalibration,
  type CalibrationPreviewRow,
} from "@/app/trading/accountCalibration";
import { AccountScaleBridge } from "@/app/trading/AccountScaleBridge";
import { formatMoney } from "@/shared/currency";

/**
 * Recalibrage d'échelle — l'écran de décision.
 *
 * L'opération n'est pas intuitive : le trader doit comprendre AVANT de
 * confirmer que ses trades ne seront pas réécrits, que son comportement ne
 * sera pas retouché, et que ses ratios ne bougeront pas. La preuve la plus
 * convaincante n'est pas un paragraphe, c'est son PROPRE trade montré avant /
 * après — avec le R multiple et le risque en % affichés côte à côte,
 * identiques.
 *
 * ── DEUX COLONNES ──
 * À gauche, la décision (quel compte, quelle taille, le pont d'échelle) ; à
 * droite, la preuve (le trade réel avant / après, ce qui ne bouge pas). Sur
 * mobile, la preuve passe sous la décision, dans le même ordre de lecture.
 *
 * ── PRO ──
 * Recalibrer est une offre Pro, vérifiée par `recalibrate_account` lui-même.
 * Le RETOUR au capital d'origine reste ouvert à tous : un compte recalibré du
 * temps de l'abonnement n'est jamais prisonnier de son échelle.
 */

/** Les tailles de compte qu'un trader de prop firm achète réellement. */
const PRESETS = [25_000, 50_000, 100_000, 150_000];

export default function RecalibrateAccountModal({
  accountId,
  trades: activeTrades,
  onClose,
}: {
  accountId: string;
  /** Les trades du compte AFFICHÉ, déjà en mémoire : évitent une lecture
   *  quand c'est lui qu'on recalibre. */
  trades?: Trade[];
  onClose: () => void;
}) {
  const { t } = useT();
  const { user } = useAuth();
  const { accounts, activeId, recalibrate } = useAccounts();
  const { toast } = useToast();
  const { can } = useSubscription();
  const isPro = can("recalibration");

  const [selectedId, setSelectedId] = useState(accountId);
  const account = accounts.find((a) => a.id === selectedId) ?? null;

  const original = account ? account.originalBalance || account.startingBalance : 0;
  const current = account?.startingBalance ?? 0;
  const [target, setTarget] = useState(String(current || ""));
  const [saving, setSaving] = useState(false);

  // Changer de compte remet la cible sur SA taille actuelle.
  useEffect(() => {
    setTarget(String(current || ""));
  }, [selectedId, current]);

  // Le trade d'aperçu vient du compte CHOISI, qui n'est pas forcément celui
  // affiché : on le lit à part, une fois par changement.
  const [loaded, setLoaded] = useState<Trade[] | null>(null);
  useEffect(() => {
    if (selectedId === activeId && activeTrades) {
      setLoaded(activeTrades);
      return;
    }
    if (!user) return;
    let alive = true;
    setLoaded(null);
    loadUserTrades(user.id, { accountId: selectedId })
      .then((list) => alive && setLoaded(list))
      .catch(() => alive && setLoaded([]));
    return () => {
      alive = false;
    };
  }, [user, selectedId, activeId, activeTrades]);

  const targetValue = Number(target) || 0;
  // Le facteur porte sur la représentation COURANTE : c'est elle qui est
  // stockée, puisqu'un recalibrage précédent a réellement converti les lignes.
  const factor = factorFor(current, targetValue);
  const valid = targetValue > 0 && Number.isFinite(targetValue);

  const sample = useMemo(() => (loaded ? pickPreviewTrade(loaded) : null), [loaded]);
  const rows = useMemo(
    () => (valid && sample ? previewCalibration(sample, current, targetValue, factor) : []),
    [sample, current, targetValue, factor, valid],
  );

  const alreadyCalibrated = isCalibrated(account?.calibrationScale);
  const noChange = valid && Math.abs(targetValue - current) < 0.005;
  // Revenir au capital d'origine n'est pas « recalibrer » : ouvert à tous.
  const isReset = valid && Math.abs(targetValue - original) < 0.005;
  const locked = !isPro && !isReset;

  // La modale d'offre s'ouvre À LA PLACE de celle-ci : empilées, l'une
  // cacherait l'autre.
  const openUpgrade = () => {
    onClose();
    window.dispatchEvent(new CustomEvent("tv:upgrade"));
  };

  const submit = async (to: number) => {
    if (saving || to <= 0 || !account) return;
    if (!isPro && Math.abs(to - original) >= 0.005) return openUpgrade();
    setSaving(true);
    try {
      const converted = await recalibrate(account.id, to);
      // Le nombre réellement converti : c'est la preuve que seuls les trades
      // déjà encodés ont bougé.
      toast(t("recal.done").replace("{n}", String(converted)), "success");
      onClose();
    } catch (e) {
      if (isPlanLimitError(e) && e.kind === "pro") {
        openUpgrade();
      } else {
        console.error("Recalibration failed", e);
        toast(t("recal.failed"), "error");
      }
    } finally {
      setSaving(false);
    }
  };

  if (!account) return null;

  const accountOptions = accounts.map((a) => ({
    value: a.id,
    label: a.name,
    hint: formatMoney(a.startingBalance, { whole: true }),
  }));
  const presets = [...new Set([...(alreadyCalibrated ? [original] : []), ...PRESETS])];

  return (
    <Modal
      open
      onClose={saving ? () => {} : onClose}
      closeOnBackdrop={!saving}
      className="md:max-w-3xl max-h-[94vh] overflow-hidden"
      labelledBy="recal-title"
    >
      <div className="flex items-start justify-between gap-3 border-b border-[var(--tv-border)] px-6 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="tv-accent-fill grid h-9 w-9 shrink-0 place-items-center rounded-xl">
            <Scale className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2
              id="recal-title"
              className="tv-title flex flex-wrap items-center gap-2 leading-tight"
            >
              {t("recal.title")}
              {!isPro && <Badge variant="accent">{t("credits.plan.pro")}</Badge>}
            </h2>
            <p className="tv-prose mt-1 text-slate-500">{t("recal.subtitle")}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          disabled={saving}
          aria-label={t("common.close")}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-[70vh] overflow-y-auto">
        <div className="grid md:grid-cols-2">
          {/* ── LA DÉCISION ── */}
          <div className="space-y-5 px-6 py-5">
            {accounts.length > 1 && (
              <div>
                <span className="tv-label mb-1.5 block text-slate-400">{t("recal.account")}</span>
                <SelectPicker
                  label={t("recal.account")}
                  value={selectedId}
                  options={accountOptions}
                  onChange={setSelectedId}
                  variant="field"
                  width="100%"
                />
              </div>
            )}

            {/* Échelle actuelle — répond à « à quelle échelle mon historique
                est-il représenté ? », qui doit toujours avoir une réponse. */}
            <div className="space-y-1.5 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-2)] px-4 py-3">
              <Line label={t("recal.original")} value={formatMoney(original, { whole: true })} />
              <Line
                label={t("recal.currentScale")}
                value={
                  alreadyCalibrated
                    ? `${formatMoney(current, { whole: true })} · ×${fmtFactor(account.calibrationScale)}`
                    : t("recal.none")
                }
              />
            </div>

            <div>
              <label htmlFor="recal-target" className="tv-label mb-1.5 block text-slate-400">
                {t("recal.targetLabel")}
              </label>
              <input
                id="recal-target"
                type="number"
                min={1}
                step={1000}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                autoFocus
                className={cn(FIELD_BASE, "tv-figure h-11 text-[15px]")}
              />
              <div className={cn(CHIP_ROW, "mt-2.5")} aria-label={t("recal.presets")}>
                {presets.map((p) => (
                  <Chip
                    key={p}
                    selected={Math.abs(targetValue - p) < 0.005}
                    onClick={() => setTarget(String(p))}
                    className="tv-figure px-3 py-1.5"
                  >
                    {p === original && alreadyCalibrated && (
                      <RotateCcw className="h-3 w-3" aria-hidden />
                    )}
                    {formatMoney(p, { whole: true })}
                  </Chip>
                ))}
              </div>
            </div>

            {valid && (
              <AccountScaleBridge
                from={{ label: t("recal.bridgeFrom"), name: account.name, balance: current }}
                to={{ label: t("recal.bridgeTo"), name: account.name, balance: targetValue }}
                factor={noChange ? 1 : factor}
              />
            )}
          </div>

          {/* ── LA PREUVE ── */}
          <div className="space-y-4 border-t border-[var(--tv-border)] bg-[var(--tv-plate-0)] px-6 py-5 md:border-l md:border-t-0">
            <div className="overflow-hidden rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)]">
              <div className="tv-label border-b border-[var(--tv-border)] px-3.5 py-2 text-slate-500">
                {sample ? t("recal.previewOn").replace("{date}", sample.date) : t("recal.preview")}
              </div>
              {loaded === null ? (
                <div className="space-y-2 p-3.5" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-4 rounded bg-white/[0.04]" />
                  ))}
                </div>
              ) : !sample ? (
                <p className="px-3.5 py-3 text-xs leading-snug text-slate-500">
                  {t("recal.noTrades")}
                </p>
              ) : (
                <ul className="divide-y divide-[var(--tv-border)]">
                  {(rows.length ? rows : previewCalibration(sample, current, current, 1)).map(
                    (r) => (
                      <PreviewLine
                        key={r.key}
                        row={r}
                        label={t(r.key)}
                        unchanged={t("recal.unchanged")}
                      />
                    ),
                  )}
                </ul>
              )}
            </div>

            {/* Ce que le recalibrage ne touche pas. Dit explicitement, parce que
                c'est la première inquiétude légitime du trader. */}
            <div className="flex gap-2.5 rounded-xl border border-[var(--tv-border)] bg-[var(--tv-plate-1)] px-4 py-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--tv-accent)]" />
              <div className="space-y-1 text-xs leading-relaxed text-slate-300">
                <p className="font-semibold text-white">{t("recal.safeTitle")}</p>
                <p>{t("recal.safeBody")}</p>
                <p>{t("recal.safeBehaviour")}</p>
                {/* Les objectifs vivent dans `goal_plans`, qui n'a PAS de lien
                    vers un compte : impossible de savoir si une cible de capital
                    concerne celui-ci. On le dit plutôt que de deviner. */}
                <p className="text-slate-400">{t("recal.goalsNote")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-[var(--tv-border)] px-6 py-4 sm:flex-row sm:items-center">
        {!isPro && (
          <p className="text-xs leading-snug text-slate-500 sm:flex-1">{t("recal.proNote")}</p>
        )}
        <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          {/* Le retour à l'origine est offert dès qu'une calibration est
              active : l'opération doit être visiblement réversible, pas
              seulement techniquement. */}
          {alreadyCalibrated && (
            <Button variant="ghost" onClick={() => submit(original)} disabled={saving}>
              <RotateCcw className="h-3.5 w-3.5" />
              {t("recal.reset")}
            </Button>
          )}
          <Button
            onClick={() => (locked ? openUpgrade() : submit(targetValue))}
            disabled={!valid || noChange || saving}
            className="disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : locked ? (
              <Lock className="h-4 w-4" />
            ) : (
              <Scale className="h-4 w-4" />
            )}
            {locked ? t("recal.proCta") : t("recal.confirm")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="tv-figure text-[13px] text-slate-200">{value}</span>
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
      ? formatMoney(n)
      : row.format === "percent"
        ? `${n.toFixed(2)}%`
        : n.toFixed(2);
  return (
    <li className="flex items-center gap-2 px-3.5 py-2 text-xs">
      <span className="min-w-0 flex-1 truncate text-slate-500">{label}</span>
      {same ? (
        <>
          <span className="tv-figure text-slate-300">{fmt(row.before)}</span>
          <span className="tv-label shrink-0 text-[var(--tv-accent)]">{unchanged}</span>
        </>
      ) : (
        <>
          <span className="tv-figure text-slate-500">{fmt(row.before)}</span>
          <ArrowRight className="h-3 w-3 shrink-0 text-slate-600" />
          <span className="tv-figure text-white">{fmt(row.after)}</span>
        </>
      )}
    </li>
  );
}
