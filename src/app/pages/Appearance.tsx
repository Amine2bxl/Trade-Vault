import { useCallback, useMemo, useState } from "react";
import { Palette } from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import { useTheme } from "../contexts/ThemeContext";
import ThemeSettings from "../components/ThemeSettings";
import ThemeStudioModal from "../components/ThemeStudioModal";
import { Button } from "@/shared/ui";
import { usePageActions, usePageLead } from "../contexts/PageActionsContext";

export default function Appearance() {
  const { t, lang } = useT();
  const fr = lang === "fr";
  const tr = useCallback((f: string, e: string) => (fr ? f : e), [fr]);
  const { createTheme, active } = useTheme();

  const [studioId, setStudioId] = useState<string | null>(null);

  /**
   * Le CTA ouvre le STUDIO, il ne fabrique plus un thème violet en dur.
   *
   * Il part de l'identité actuelle (`active`) plutôt que d'une palette
   * arbitraire : personnaliser, c'est ajuster ce qu'on a sous les yeux, pas
   * repartir d'un thème inconnu qu'il faudrait d'abord défaire.
   */
  const handleCreateTheme = () => {
    const id = createTheme({
      name: tr("Mon thème", "My theme"),
      primary: active.primary,
      secondary: active.secondary,
      highlight: active.highlight,
      background: active.background,
      text: active.text,
    });
    setStudioId(id);
  };

  /* MÊME TRAITEMENT QUE RÉGLAGES, PROFIL ET ABONNEMENT : le titre et l'action
     de la page vivent dans la barre de tête, pas dans un bandeau de pleine
     largeur au-dessus d'une carte qui répète le même mot. */
  const lead = useMemo(
    () => (
      <div className="flex min-w-0 items-center gap-2.5">
        <Palette className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        <span className="tv-label shrink-0 text-slate-400">{t("appearance.title")}</span>
        <span aria-hidden className="hidden h-3.5 w-px shrink-0 bg-white/[0.12] md:block" />
        <span className="tv-row-label hidden truncate md:block">{t("appearance.subtitle")}</span>
      </div>
    ),
    [t],
  );
  usePageLead(lead);

  const actions = useMemo(
    () => (
      <Button variant="accent" size="sm" onClick={handleCreateTheme} className="shrink-0">
        <Palette className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{tr("Créer un thème", "Create theme")}</span>
      </Button>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tr],
  );
  usePageActions(actions);

  return (
    <div className="mx-auto max-w-[1000px] space-y-3 p-4 md:p-5">
      <div className="animate-fade-in-up stagger-1">
        <ThemeSettings />
      </div>
      {/* `draft` : ouvert depuis « créer un thème », donc annulable pour de
          vrai — la fenêtre supprime le thème si le trader renonce. */}
      {studioId && <ThemeStudioModal themeId={studioId} draft onClose={() => setStudioId(null)} />}
    </div>
  );
}
