import { useEffect, useMemo, useRef, useState } from "react";
import { Palette, RotateCcw, Check } from "lucide-react";
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
  onClose,
}: {
  themeId: string;
  onClose: () => void;
}) {
  const { themes, updateTheme, setActive, activeId } = useTheme();
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

  return (
    <Modal open onClose={onClose} className="md:max-w-lg" wrapperClassName="z-[80]">
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-xl bg-[var(--tv-accent)]/15 flex items-center justify-center">
          <Palette className="w-4 h-4 text-[var(--tv-accent)]" />
        </span>
        <div className="min-w-0">
          <h2 className="tv-title">{tr("Studio de thème", "Theme studio")}</h2>
          <p className="tv-row-label">
            {tr(
              "Chaque changement s'applique et se sauvegarde aussitôt.",
              "Every change applies and saves instantly.",
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

        <div className="space-y-2.5">
          {SWATCHES.map((sw) => {
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

      <div className="px-5 py-3.5 border-t border-white/[0.06] flex items-center justify-between gap-3">
        <button
          onClick={restore}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {tr("Rétablir", "Restore")}
        </button>
        <button
          onClick={onClose}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold",
            "bg-[var(--tv-accent)] text-[#04121a] hover:brightness-110 transition",
          )}
        >
          <Check className="w-3.5 h-3.5" />
          {tr("Terminé", "Done")}
        </button>
      </div>
    </Modal>
  );
}
