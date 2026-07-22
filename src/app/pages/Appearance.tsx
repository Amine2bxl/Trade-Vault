import { useCallback } from "react";
import { useT } from "../i18n/LanguageContext";
import ThemeSettings from "../components/ThemeSettings";
import { PageHeader } from "@/shared/ui";

// Appearance — dedicated home for theming (moved out of Profile so the
// "Plan" section groups every personalization surface in one place).

export default function Appearance() {
  const { lang } = useT();
  const fr = lang === "fr";
  const tr = useCallback((f: string, e: string) => (fr ? f : e), [fr]);

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-4">
      <PageHeader
        className="mb-2 md:mb-2"
        title={tr("Apparence", "Appearance")}
        subtitle={tr(
          "Choisis ton identité visuelle — chaque thème reteinte toute l'application en direct.",
          "Pick your visual identity — every theme retints the whole app live.",
        )}
      />
      <div className="animate-fade-in-up stagger-1">
        <ThemeSettings />
      </div>
    </div>
  );
}
