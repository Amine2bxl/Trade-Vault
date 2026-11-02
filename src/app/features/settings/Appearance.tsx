import { useMemo, useState } from "react";
import { Palette } from "@/shared/ui/icons";
import { useT } from "@/app/i18n/LanguageContext";
import { useTheme } from "@/app/contexts/ThemeContext";
import ThemeSettings from "./ThemeSettings";
import ThemeStudioModal from "./ThemeStudioModal";
import { PageContainer, Button, ScrollArea, SettingsHero } from "@/shared/ui";
import { useAvailableHeight } from "@/app/hooks/useAvailableHeight";
import { usePageActions, usePageLead } from "@/app/contexts/PageActionsContext";

export default function Appearance() {
  const { t } = useT();
  const { createTheme, active } = useTheme();
  const { boxRef, height } = useAvailableHeight();

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
      name: t("studio.defaultName"),
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
        <span className="hidden sm:inline">{t("studio.create")}</span>
      </Button>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  );
  usePageActions(actions);

  return (
    <PageContainer ref={boxRef} measure="settings" fit height={height} className="space-y-6">
      {/* La carte héros commune aux réglages : le thème actif, ses trois
          couleurs dans le disque. */}
      <SettingsHero
        media={
          <span
            aria-hidden
            className="block h-full w-full rounded-full"
            style={{
              background: `conic-gradient(${active.primary} 0 33%, ${active.secondary} 0 66%, ${active.highlight} 0)`,
            }}
          />
        }
        eyebrow={t("appearance.active")}
        title={active.name}
        subtitle={t("appearance.subtitle")}
      />
      {/* La grille des thèmes défile dans la colonne ; le thème actif reste
          en tête. */}
      <ScrollArea className="tv-grow animate-fade-in-up stagger-1">
        <ThemeSettings />
      </ScrollArea>
      {/* `draft` : ouvert depuis « créer un thème », donc annulable pour de
          vrai — la fenêtre supprime le thème si le trader renonce. */}
      {studioId && <ThemeStudioModal themeId={studioId} draft onClose={() => setStudioId(null)} />}
    </PageContainer>
  );
}
