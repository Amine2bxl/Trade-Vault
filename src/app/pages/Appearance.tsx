import { useCallback } from "react";
import { Palette } from "lucide-react";
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
    <div className="p-4 md:p-5 max-w-3xl mx-auto space-y-4">
      <PageHeader
        className="mb-2 md:mb-2"
        title={tr("Apparence", "Appearance")}
        subtitle={tr(
          "Personnalise l'identité visuelle de ton terminal.",
          "Customize your trading terminal look and feel.",
        )}
        icon={
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600">
            <Palette className="w-4 h-4 text-white" />
          </span>
        }
      />
      <div className="animate-fade-in-up stagger-1">
        <ThemeSettings />
      </div>
    </div>
  );
}
