import { useEffect, useMemo, useRef, useState } from "react";
import { Palette, RotateCcw, Check, ChevronDown } from "lucide-react";
import { Modal, FIELD_BASE } from "@/shared/ui";
import { useTheme } from "../contexts/ThemeContext";
import { useT } from "../i18n/LanguageContext";
import { DEFAULT_BACKGROUND, DEFAULT_TEXT, type ThemeDef } from "../utils/themes";
import { cn } from "../utils/cn";

/**
 * Studio de thème — personnalisation complète de l'identité visuelle.
 *
 * L'APERÇU EST L'APPLICATION ELLE-MÊME. Chaque modification est écrite
 * immédiatement dans le thème actif, donc les variables CSS changent et TOUT
 * le produit se retinte en direct derrière la fenêtre : barre latérale,
 * graphiques, boutons, Jarvis. C'est le seul aperçu qui ne ment pas — une
 * vignette de démonstration montrerait un rendu que le reste de l'application
 * ne partagerait pas forcément.
 *
 * CONSÉQUENCE ASSUMÉE : il n'y a pas de bouton « Annuler » au sens classique,
 * puisque tout est déjà appliqué et sauvegardé. On offre à la place un retour
 * à l'état d'ouverture — plus honnête qu'un faux brouillon, et plus rapide
 * qu'une validation en deux temps.
 */

interface Swatch {
  key: keyof Pick<ThemeDef, "primary" | "secondary" | "highlight" | "background" | "text">;
  labelFr: string;
  labelEn: string;
  hintFr: string;
  hintEn: string;
  fallback: string;
}

/**
 * Cinq réglages, pas davantage. Chacun pilote une variable CSS réellement
 * consommée par le produit ; en ajouter qui ne changent rien à l'écran serait
 * la pire façon de donner l'impression de personnaliser.
 */
/** Les deux réglages qui peuvent rendre l'application illisible en un clic. */
const AVANCEES: Swatch["key"][] = ["background", "text"];

const SWATCHES: Swatch[] = [
  {
    key: "primary",
    labelFr: "Couleur principale",
    labelEn: "Primary",
    hintFr: "Boutons, états actifs, courbes",
    hintEn: "Buttons, active states, charts",
    fallback: "#06b6d4",
  },
  {
    key: "secondary",
    labelFr: "Accent secondaire",
    labelEn: "Secondary",
    hintFr: "Dégradés et seconds plans",
    hintEn: "Gradients and secondary surfaces",
    fallback: "#14b8a6",
  },
  {
    key: "highlight",
    labelFr: "Éclat",
    labelEn: "Highlight",
    hintFr: "Lueurs et pointes de dégradé",
    hintEn: "Glows and gradient tips",
    fallback: "#22d3ee",
  },
  {
    key: "background",
    labelFr: "Fond",
    labelEn: "Background",
    hintFr: "Surface de toute l'application",
    hintEn: "The whole application surface",
    fallback: DEFAULT_BACKGROUND,
  },
  {
    key: "text",
    labelFr: "Texte",
    labelEn: "Text",
    hintFr: "Couleur de lecture principale",
    hintEn: "Primary reading colour",
    fallback: DEFAULT_TEXT,
  },
];

export default function ThemeStudioModal({
  themeId,
  draft = false,
  onClose,
}: {
  themeId: string;
  /**
   * VRAI quand le thème n'existe que le temps de cette fenêtre.
   *
   * « Créer un thème » fabriquait le thème AVANT d'ouvrir le studio : fermer
   * la fenêtre sans rien vouloir laissait une entrée orpheline dans « Tes
   * thèmes », et il fallait aller la supprimer. Le thème est toujours créé
   * d'abord — c'est ce qui permet à l'application entière de servir d'aperçu,
   * et c'est le seul aperçu qui ne mente pas — mais « Annuler » le SUPPRIME.
   * Du point de vue du trader, rien n'est créé tant qu'il n'a pas validé.
   */
  draft?: boolean;
  onClose: (garde: boolean) => void;
}) {
  const { themes, updateTheme, setActive, activeId, deleteTheme } = useTheme();
  const [avance, setAvance] = useState(false);
  const { lang } = useT();
  const fr = lang === "fr";
  const tr = (f: string, e: string) => (fr ? f : e);

  const theme = useMemo(() => themes.find((t) => t.id === themeId), [themes, themeId]);

  // État d'ouverture, figé une fois : c'est la cible du bouton « rétablir ».
  // Une ref plutôt qu'un state — cette valeur ne doit JAMAIS re-déclencher un
  // rendu, sinon le point de retour suivrait les modifications en cours.
  const initial = useRef<ThemeDef | null>(null);
  if (theme && !initial.current) initial.current = { ...theme };

  const [name, setName] = useState(theme?.name ?? "");

  // Le thème édité devient l'actif : sans cela, l'utilisateur modifierait des
  // couleurs sans rien voir changer à l'écran.
  useEffect(() => {
    if (themeId && activeId !== themeId) setActive(themeId);
  }, [themeId, activeId, setActive]);

  if (!theme) return null;

  const set = (key: Swatch["key"], value: string) => updateTheme(themeId, { [key]: value });

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

  /** Annuler : le brouillon disparaît, une édition revient à son état d'ouverture. */
  const annuler = () => {
    if (draft) {
      deleteTheme(themeId);
      onClose(false);
      return;
    }
    restore();
    onClose(false);
  };

  return (
<<<<<<< HEAD
    <Modal open onClose={annuler} className="md:max-w-lg" wrapperClassName="z-[80]">
=======
    <Modal open onClose={onClose} className="md:max-w-lg" wrapperClassName="z-[var(--tv-z-modal)]">
>>>>>>> origin/claude/minimal-tokens-caveman-skill-l3dmgc
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-xl bg-[var(--tv-accent)]/15 flex items-center justify-center">
          <Palette className="w-4 h-4 text-[var(--tv-accent)]" />
        </span>
        <div className="min-w-0">
          <h2 className="tv-title">
            {draft ? tr("Nouveau thème", "New theme") : tr("Studio de thème", "Theme studio")}
          </h2>
          <p className="tv-row-label">
            {tr(
              "Le produit derrière se retinte en direct — c'est ça, l'aperçu.",
              "The product behind repaints live — that is the preview.",
            )}
          </p>
        </div>
      </div>

      <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
        <label className="block">
          <span className="block text-[11px] font-semibold text-slate-400 mb-1.5">
            {tr("Nom du thème", "Theme name")}
          </span>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              updateTheme(themeId, { name: e.target.value });
            }}
            className={FIELD_BASE}
            placeholder={tr("Mon thème", "My theme")}
          />
        </label>

        {/* TROIS COULEURS, PUIS DEUX. Les cinq pastilles se suivaient à plat :
            le FOND et le TEXTE — qui peuvent rendre l'application illisible en
            un clic — avaient exactement le même poids que l'accent, qui est la
            seule chose que 95 % des gens veulent changer. Les deux dangereuses
            passent derrière un repli, avec ce qu'elles font écrit dessus. */}
        <div className="space-y-2.5">
          {SWATCHES.filter((sw) => !AVANCEES.includes(sw.key)).map((sw) => {
            const value = (theme[sw.key] as string | undefined) ?? sw.fallback;
            return (
              <div
                key={sw.key}
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
              >
                {/* Le sélecteur natif : universel, accessible au clavier, et
                    il ouvre la pipette du système sur desktop — impossible à
                    égaler avec un composant maison à ce coût. */}
                <input
                  type="color"
                  value={value}
                  onChange={(e) => set(sw.key, e.target.value)}
                  aria-label={tr(sw.labelFr, sw.labelEn)}
                  className="w-9 h-9 rounded-lg bg-transparent border border-white/10 cursor-pointer shrink-0 p-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-white">
                    {tr(sw.labelFr, sw.labelEn)}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {tr(sw.hintFr, sw.hintEn)}
                  </div>
                </div>
                <code className="tv-figure text-[11px] text-slate-500 shrink-0">{value}</code>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setAvance((v) => !v)}
          className="flex w-full items-center gap-2 rounded-xl border border-white/[0.06] px-3 py-2.5 text-left transition hover:bg-white/[0.03]"
        >
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform",
              avance && "rotate-180",
            )}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-white">
              {tr("Fond et texte", "Background and text")}
            </span>
            <span className="tv-row-label block">
              {tr(
                "Ils repeignent toute la surface — à toucher en dernier.",
                "They repaint the whole surface — touch these last.",
              )}
            </span>
          </span>
        </button>

        {avance && (
          <div className="space-y-2.5">
            {SWATCHES.filter((sw) => AVANCEES.includes(sw.key)).map((sw) => {
              const value = (theme[sw.key] as string | undefined) ?? sw.fallback;
              return (
                <div
                  key={sw.key}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                >
                  <input
                    type="color"
                    value={value}
                    onChange={(e) => set(sw.key, e.target.value)}
                    aria-label={tr(sw.labelFr, sw.labelEn)}
                    className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-transparent p-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-white">
                      {tr(sw.labelFr, sw.labelEn)}
                    </div>
                    <div className="truncate text-[11px] text-slate-500">
                      {tr(sw.hintFr, sw.hintEn)}
                    </div>
                  </div>
                  <code className="tv-figure shrink-0 text-[11px] text-slate-500">{value}</code>
                </div>
              );
            })}
          </div>
        )}

        {/* Bande d'aperçu : elle ne remplace pas l'aperçu réel (l'application
            derrière la fenêtre), elle rapproche simplement les cinq couleurs
            pour juger leur accord d'un coup d'œil. */}
        <div
          className="rounded-xl border border-white/[0.06] p-4"
          style={{ background: theme.background ?? DEFAULT_BACKGROUND }}
        >
          <div className="flex items-center gap-2 mb-2.5">
            {[theme.primary, theme.secondary, theme.highlight].map((c, i) => (
              <span key={i} className="w-6 h-6 rounded-lg" style={{ background: c }} />
            ))}
          </div>
          <p className="tv-prose" style={{ color: theme.text ?? DEFAULT_TEXT }}>
            {tr(
              "Aperçu du texte sur le fond choisi.",
              "Preview of body text on the chosen background.",
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3.5">
        {/* ANNULER EXISTE. Tout étant appliqué en direct, la fenêtre n'offrait
            qu'un « rétablir » qui remettait les couleurs mais laissait le
            thème créé : impossible de renoncer vraiment. */}
        <button
          onClick={annuler}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-white"
        >
          {tr("Annuler", "Cancel")}
        </button>
        <div className="flex items-center gap-2">
          {!draft && (
            <button
              onClick={restore}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {tr("Rétablir", "Restore")}
            </button>
          )}
          <button onClick={() => onClose(true)} className="btn-primary btn-sm">
            <Check className="h-3.5 w-3.5" />
            {draft ? tr("Créer le thème", "Create theme") : tr("Terminé", "Done")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
