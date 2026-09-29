import { useEffect, useMemo, useRef, useState } from "react";
import { Palette, RotateCcw, Check, ChevronDown, ArrowLeft, ArrowRight, Link2 } from "lucide-react";
import { Modal, FIELD_BASE, ColorPicker, type ColorPickerLabels } from "@/shared/ui";
import { useTheme } from "../contexts/ThemeContext";
import { useT } from "../i18n/LanguageContext";
import {
  ACCENT_PALETTE,
  BUILTIN_THEMES,
  DEFAULT_BACKGROUND,
  DEFAULT_TEXT,
  SURFACE_PALETTE,
  TEXT_PALETTE,
  deriveAccents,
  hexToRgb,
  type ThemeDef,
} from "../utils/themes";
import { cn } from "../utils/cn";

/**
 * LE CRÉATEUR DE THÈME — trois étapes, aucun réglage de développeur.
 *
 * L'ancien studio posait cinq sélecteurs natifs à plat (« principale »,
 * « secondaire », « éclat », fond, texte), chacun avec son code HEX : on
 * configurait des variables CSS plus qu'on ne choisissait une ambiance. Le
 * parcours suit maintenant ce qu'on fait vraiment :
 *
 *   1. NOM — et, si on veut, un point de départ parmi les thèmes intégrés ;
 *   2. PERSONNALISER — UNE couleur principale ; les deux tons qui
 *      l'accompagnent en sont dérivés (le secondaire plus profond, l'éclat
 *      plus clair, la règle des thèmes intégrés) et restent réglables à part.
 *      Fond et texte vivent dans leur propre section, avec des palettes
 *      pensées pour eux (des noirs teintés, des blancs de lecture) ;
 *   3. APERÇU — une maquette qui assemble les couleurs, un contrôle de
 *      lisibilité du texte, puis « Enregistrer ».
 *
 * L'APERÇU RESTE AUSSI L'APPLICATION ELLE-MÊME : chaque changement est écrit
 * dans le thème actif, tout le produit se retinte derrière la fenêtre.
 * « Annuler » supprime le brouillon, ou rend l'état d'ouverture d'un thème
 * existant.
 */

type Step = 0 | 1 | 2;

/** Contraste WCAG entre deux couleurs. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = hexToRgb(hex).map((c) => {
      const x = c / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export default function ThemeStudioModal({
  themeId,
  draft = false,
  onClose,
}: {
  themeId: string;
  /**
   * VRAI quand le thème n'existe que le temps de cette fenêtre : « Annuler »
   * le SUPPRIME. Du point de vue du trader, rien n'est créé tant qu'il n'a
   * pas enregistré.
   */
  draft?: boolean;
  onClose: (garde: boolean) => void;
}) {
  const { themes, updateTheme, setActive, activeId, deleteTheme } = useTheme();
  const { t } = useT();
  const [step, setStep] = useState<Step>(draft ? 0 : 1);
  const [fine, setFine] = useState(false);
  // Les tons d'accompagnement suivent le principal tant qu'on ne les règle pas.
  const [linked, setLinked] = useState(draft);

  const theme = useMemo(() => themes.find((x) => x.id === themeId), [themes, themeId]);

  // État d'ouverture, figé une fois : la cible de « rétablir » et d'« annuler ».
  const initial = useRef<ThemeDef | null>(null);
  if (theme && !initial.current) initial.current = { ...theme };

  const [name, setName] = useState(theme?.name ?? "");

  // Le thème édité devient l'actif : sans cela, rien ne changerait à l'écran.
  useEffect(() => {
    if (themeId && activeId !== themeId) setActive(themeId);
  }, [themeId, activeId, setActive]);

  const pickerLabels: Partial<ColorPickerLabels> = {
    family: t("studio.palette"),
    tone: t("studio.tone"),
    custom: t("studio.customColour"),
    system: t("studio.systemPicker"),
    customName: t("studio.customName"),
  };

  if (!theme) return null;

  const background = theme.background ?? DEFAULT_BACKGROUND;
  const text = theme.text ?? DEFAULT_TEXT;
  const lisible = contrast(background, text) >= 7;

  const setPrimary = (hex: string) =>
    updateTheme(themeId, linked ? { primary: hex, ...deriveAccents(hex) } : { primary: hex });

  const restore = () => {
    const src = initial.current;
    if (!src) return;
    updateTheme(themeId, {
      name: src.name,
      primary: src.primary,
      secondary: src.secondary,
      highlight: src.highlight,
      background: src.background,
      text: src.text,
    });
    setName(src.name);
  };

  const annuler = () => {
    if (draft) {
      deleteTheme(themeId);
      onClose(false);
      return;
    }
    restore();
    onClose(false);
  };

  const STEPS: { label: string }[] = [
    { label: t("studio.stepName") },
    { label: t("studio.stepCustomize") },
    { label: t("studio.stepPreview") },
  ];

  return (
    <Modal open onClose={annuler} className="md:max-w-lg" wrapperClassName="z-[var(--tv-z-modal)]">
      {/* ── EN-TÊTE + ÉTAPES ─────────────────────────────────────────── */}
      <div className="border-b border-[var(--tv-border)] px-5 pb-3 pt-4">
        <div className="flex items-center gap-2.5">
          <span
            className="tv-color-chip grid h-8 w-8 shrink-0 place-items-center"
            style={{ background: theme.primary }}
          >
            <Palette className="h-4 w-4 text-white mix-blend-difference" />
          </span>
          <div className="min-w-0">
            <h2 className="tv-title truncate">
              {draft ? t("studio.newTheme") : t("studio.editTheme")}
            </h2>
            <p className="tv-row-label truncate">{t("studio.livePreview")}</p>
          </div>
        </div>
        <ol className="mt-3.5 grid grid-cols-3 gap-2" aria-label={t("studio.steps")}>
          {STEPS.map((s, i) => (
            <li key={s.label}>
              <button
                type="button"
                onClick={() => (i === 0 || name.trim()) && setStep(i as Step)}
                aria-current={step === i ? "step" : undefined}
                className="flex w-full flex-col items-start gap-1.5 text-left"
              >
                <span
                  className={cn(
                    "h-1 w-full rounded-full transition-colors",
                    i <= step ? "bg-[var(--tv-accent)]" : "bg-[var(--tv-plate-3)]",
                  )}
                />
                <span
                  className={cn(
                    "text-[11px] font-semibold",
                    i === step ? "text-white" : "text-slate-500",
                  )}
                >
                  {i + 1}. {s.label}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="max-h-[62vh] space-y-4 overflow-y-auto p-5">
        {/* ── 1. NOM ─────────────────────────────────────────────────── */}
        {step === 0 && (
          <>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold text-slate-400">
                {t("studio.nameLabel")}
              </span>
              <input
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  updateTheme(themeId, { name: e.target.value });
                }}
                onKeyDown={(e) => e.key === "Enter" && name.trim() && setStep(1)}
                className={FIELD_BASE}
                placeholder={t("studio.namePlaceholder")}
              />
            </label>
            <div>
              <span className="mb-2 block text-[11px] font-semibold text-slate-400">
                {t("studio.startFrom")}
              </span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {BUILTIN_THEMES.map((b) => {
                  const on =
                    b.primary.toLowerCase() === theme.primary.toLowerCase() &&
                    (b.background ?? DEFAULT_BACKGROUND) === background;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() =>
                        updateTheme(themeId, {
                          primary: b.primary,
                          secondary: b.secondary,
                          highlight: b.highlight,
                          background: b.background ?? DEFAULT_BACKGROUND,
                          text: b.text ?? DEFAULT_TEXT,
                        })
                      }
                      aria-pressed={on}
                      className={cn(
                        "tv-color-trigger flex items-center gap-2 !py-2 text-left",
                        on && "is-open",
                      )}
                    >
                      <span className="flex -space-x-1.5">
                        {[b.primary, b.highlight].map((c) => (
                          <span
                            key={c}
                            className="tv-color-chip h-5 w-5 rounded-full"
                            style={{ background: c }}
                          />
                        ))}
                      </span>
                      <span className="truncate text-xs font-semibold text-slate-200">
                        {b.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ── 2. PERSONNALISER ───────────────────────────────────────── */}
        {step === 1 && (
          <>
            <section className="space-y-2.5">
              <span className="tv-label text-slate-500">{t("studio.colours")}</span>
              <ColorPicker
                label={t("studio.mainColour")}
                hint={t("studio.mainColourHint")}
                value={theme.primary}
                onChange={setPrimary}
                families={ACCENT_PALETTE}
                labels={pickerLabels}
              />
              <button
                type="button"
                onClick={() => setFine((v) => !v)}
                aria-expanded={fine}
                className="flex w-full items-center gap-2 px-1 py-1 text-left"
              >
                <Link2
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    linked ? "text-[var(--tv-highlight)]" : "text-slate-500",
                  )}
                />
                <span className="min-w-0 flex-1 text-[11.5px] text-slate-400">
                  {linked ? t("studio.linkedHint") : t("studio.unlinkedHint")}
                </span>
                <span className="shrink-0 text-[11px] font-semibold text-slate-300">
                  {t("studio.fineTune")}
                </span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform",
                    fine && "rotate-180",
                  )}
                />
              </button>
              {fine && (
                <div className="space-y-2.5">
                  <ColorPicker
                    label={t("studio.deepTone")}
                    hint={t("studio.deepToneHint")}
                    value={theme.secondary}
                    onChange={(hex) => {
                      setLinked(false);
                      updateTheme(themeId, { secondary: hex });
                    }}
                    families={ACCENT_PALETTE}
                    labels={pickerLabels}
                  />
                  <ColorPicker
                    label={t("studio.brightTone")}
                    hint={t("studio.brightToneHint")}
                    value={theme.highlight}
                    onChange={(hex) => {
                      setLinked(false);
                      updateTheme(themeId, { highlight: hex });
                    }}
                    families={ACCENT_PALETTE}
                    labels={pickerLabels}
                  />
                  {!linked && (
                    <button
                      type="button"
                      onClick={() => {
                        setLinked(true);
                        updateTheme(themeId, deriveAccents(theme.primary));
                      }}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[11.5px] font-semibold text-[var(--tv-highlight)] hover:bg-white/[0.04]"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      {t("studio.relink")}
                    </button>
                  )}
                </div>
              )}
            </section>

            <section className="space-y-2.5 border-t border-[var(--tv-border)] pt-4">
              <span className="tv-label text-slate-500">{t("studio.surfaces")}</span>
              <ColorPicker
                label={t("studio.background")}
                hint={t("studio.backgroundHint")}
                value={background}
                onChange={(hex) => updateTheme(themeId, { background: hex })}
                families={SURFACE_PALETTE}
                labels={pickerLabels}
              />
              <ColorPicker
                label={t("studio.text")}
                hint={t("studio.textHint")}
                value={text}
                onChange={(hex) => updateTheme(themeId, { text: hex })}
                families={TEXT_PALETTE}
                labels={pickerLabels}
              />
            </section>
          </>
        )}

        {/* ── 3. APERÇU ──────────────────────────────────────────────── */}
        {step === 2 && (
          <>
            <ThemePreview theme={theme} background={background} text={text} name={name} />
            <p
              className={cn(
                "flex items-start gap-2 text-[12px] leading-relaxed",
                lisible ? "text-slate-400" : "text-amber-300",
              )}
            >
              {lisible ? (
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--tv-chart-green)]" />
              ) : (
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
              )}
              {lisible ? t("studio.readable") : t("studio.lowContrast")}
            </p>
            <p className="text-[12px] leading-relaxed text-slate-500">{t("studio.pnlNote")}</p>
          </>
        )}
      </div>

      {/* ── PIED : annuler · précédent · suivant / enregistrer ─────────── */}
      <div className="flex items-center justify-between gap-3 border-t border-[var(--tv-border)] px-5 py-3.5">
        <div className="flex items-center gap-1">
          <button
            onClick={annuler}
            className="inline-flex h-9 items-center rounded-lg px-2.5 text-xs font-semibold text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            {t("common.cancel")}
          </button>
          {!draft && (
            <button
              onClick={restore}
              title={t("studio.restore")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("studio.restore")}</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => (s - 1) as Step)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/[0.05]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("studio.back")}
            </button>
          )}
          {step < 2 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as Step)}
              disabled={!name.trim()}
              className="btn-primary btn-sm disabled:opacity-40"
            >
              {t("studio.next")}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={() => onClose(true)}
              disabled={!name.trim()}
              className="btn-primary btn-sm"
            >
              <Check className="h-3.5 w-3.5" />
              {t("studio.save")}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

/**
 * L'APERÇU COMPOSÉ — un morceau d'application peint avec le thème : onglet
 * actif, bouton, chiffre clé, courbe. Le P&L y garde son vert : il ne suit
 * jamais l'accent.
 */
function ThemePreview({
  theme,
  background,
  text,
  name,
}: {
  theme: ThemeDef;
  background: string;
  text: string;
  name: string;
}) {
  const { t } = useT();
  return (
    <div
      className="tv-relief overflow-hidden rounded-2xl border border-[var(--tv-border)]"
      style={{ background }}
    >
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-3.5 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: theme.primary }} />
        <span className="truncate text-xs font-semibold" style={{ color: text }}>
          {name || "TradeVault"}
        </span>
        <span className="ml-auto flex gap-1">
          {[t("nav.dashboard"), t("nav.journal")].map((tab, i) => (
            <span
              key={tab}
              className="rounded-md px-2 py-0.5 text-[10.5px] font-semibold"
              style={
                i === 0
                  ? { background: `${theme.primary}26`, color: theme.highlight }
                  : { color: `${text}99` }
              }
            >
              {tab}
            </span>
          ))}
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-3 p-3.5">
        <div className="min-w-0">
          <div
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: `${text}80` }}
          >
            {t("studio.previewKpi")}
          </div>
          <div className="tv-figure mt-0.5 text-xl font-bold" style={{ color: text }}>
            2.14
          </div>
          <svg viewBox="0 0 120 32" className="mt-2 h-8 w-full" aria-hidden>
            <path
              d="M0 26 L15 22 L30 24 L45 16 L60 18 L75 10 L90 12 L105 5 L120 7"
              fill="none"
              stroke="var(--tv-chart-green)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span
          className="rounded-lg px-3 py-1.5 text-[11px] font-bold"
          style={{ background: theme.primary, color: background }}
        >
          {t("studio.previewButton")}
        </span>
      </div>
      <p className="px-3.5 pb-3.5 text-[12px] leading-relaxed" style={{ color: `${text}cc` }}>
        {t("studio.previewBody")}
      </p>
    </div>
  );
}
