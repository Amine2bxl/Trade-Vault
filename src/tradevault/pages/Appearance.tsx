import { useCallback } from "react";
import { useT } from "../i18n/LanguageContext";
import ThemeSettings from "../components/ThemeSettings";

// Appearance — dedicated home for theming (moved out of Profile so the
// "Plan" section groups every personalization surface in one place).

export default function Appearance() {
  const { lang } = useT();
  const fr = lang === "fr";
  const tr = useCallback((f: string, e: string) => (fr ? f : e), [fr]);

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-4">
      <div className="mb-2 animate-fade-in-up">
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
          {tr("Apparence", "Appearance")}
        </h1>
        <p className="text-xs md:text-sm text-slate-500 mt-1">
          {tr(
            "Choisis ton identité visuelle — chaque thème reteinte toute l'application en direct.",
            "Pick your visual identity — every theme retints the whole app live.",
          )}
        </p>
      </div>
      <div className="animate-fade-in-up stagger-1">
        <ThemeSettings />
      </div>
    </div>
  );
}
