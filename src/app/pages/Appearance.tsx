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
          <span className="relative shrink-0">
            <span className="absolute -inset-1 rounded-xl bg-cyan-500/30 blur-md" />
            <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 shadow-lg shadow-cyan-500/20">
              <Palette className="w-4.5 h-4.5 text-white" />
            </span>
          </span>
        }
      />
      <div className="animate-fade-in-up stagger-1">
        <ThemeSettings />
      </div>
    </div>
  );
}
