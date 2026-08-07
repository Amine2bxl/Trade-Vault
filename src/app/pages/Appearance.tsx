import { useCallback } from "react";
import { Palette } from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import { useTheme } from "../contexts/ThemeContext";
import ThemeSettings from "../components/ThemeSettings";
import { PageHeader } from "@/shared/ui";

export default function Appearance() {
  const { lang } = useT();
  const fr = lang === "fr";
  const tr = useCallback((f: string, e: string) => (fr ? f : e), [fr]);
  const { createTheme } = useTheme();

  const handleCreateTheme = () => {
    createTheme({
      name: tr("Nouveau thème", "New theme"),
      primary: "#8b5cf6",
      secondary: "#ec4899",
      highlight: "#c4b5fd",
    });
  };

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
        actions={
          <button
            onClick={handleCreateTheme}
            className="inline-flex items-center gap-1.5 shrink-0 h-9 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 shadow-lg shadow-cyan-500/20 transition-all hover:brightness-110 active:scale-[0.99]"
          >
            <Palette className="w-3.5 h-3.5" />
            {tr("Créer un thème", "Create theme")}
          </button>
        }
      />
      <div className="animate-fade-in-up stagger-1">
        <ThemeSettings />
      </div>
    </div>
  );
}
