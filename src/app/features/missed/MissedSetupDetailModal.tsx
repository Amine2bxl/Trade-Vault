import type { ElementType } from "react";
import {
  X,
  Target,
  Quote,
  Activity,
  Lightbulb,
  Compass,
  Image as ImageIcon,
  TrendingUp,
} from "@/shared/ui/icons";
import { MissedOpportunity } from "@/app/types";
import { cn } from "@/shared/ui/cn";
import { ScreenshotsView } from "./MissedOpportunities";
import { useT } from "@/app/i18n/LanguageContext";
import { Modal } from "@/shared/ui";

interface MissedSetupDetailModalProps {
  missed: MissedOpportunity;
  onClose: () => void;
}

const LOCALE_MAP: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  pt: "pt-PT",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
  nl: "nl-NL",
  ru: "ru-RU",
  zh: "zh-CN",
  ja: "ja-JP",
  ar: "ar-SA",
  hi: "hi-IN",
};

// La hiérarchie vient des libellés et de l'espacement, sans quatre couleurs de rubrique.
const SECTION_STYLE = {
  border: "border-[var(--tv-border)]",
  bg: "bg-[var(--tv-plate-2)]",
  text: "text-slate-300",
  iconBg: "bg-[var(--tv-plate-1)]",
  bar: "bg-[var(--tv-border-strong)]",
};
const TONES = {
  red: SECTION_STYLE,
  amber: SECTION_STYLE,
  blue: SECTION_STYLE,
  emerald: SECTION_STYLE,
};

function Section({
  tone,
  icon: Icon,
  label,
  children,
  big,
  empty,
}: {
  tone: keyof typeof TONES;
  icon: ElementType;
  label: string;
  children: React.ReactNode;
  big?: boolean;
  empty?: boolean;
}) {
  const s = TONES[tone];
  return (
    <div
      className={cn(
        // Une plaque pleine en relief (et non un voile teinté à 4 % qui se
        // lisait comme un carré gris) ; la teinte vit dans le rail, l'icône
        // et un liseré — la section « Leçon » garde son fond d'accent.
        "tv-relief relative overflow-hidden rounded-2xl border bg-[var(--tv-plate-2)] transition",
        s.border,
        tone === "blue" && s.bg,
        empty && "opacity-50",
      )}
    >
      <div className={cn("absolute inset-y-0 left-0 w-[3px]", s.bar)} />
      <div className={cn("py-3.5 px-4 md:px-5", big && !empty && "py-4 md:py-5")}>
        <div className="flex items-center gap-2 mb-2">
          <div
            className={cn(
              "rounded-lg flex items-center justify-center shrink-0",
              s.iconBg,
              big ? "w-7 h-7" : "w-6 h-6",
            )}
          >
            <Icon className={cn(s.text, big ? "w-4 h-4" : "w-3.5 h-3.5")} />
          </div>
          <span
            className={cn(
              "uppercase tracking-[0.12em] font-bold",
              s.text,
              big ? "text-[11px]" : "text-[10px]",
            )}
          >
            {label}
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function MissedSetupDetailModal({ missed, onClose }: MissedSetupDetailModalProps) {
  const { t, lang } = useT();
  const locale = LOCALE_MAP[lang] || "en-US";
  const d = new Date(missed.date + "T12:00:00");
  const dateStr = `${d.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" })}, '${String(d.getFullYear()).slice(-2)}`;
  const shots = missed.screenshots ?? [];

  const body = (key: "reasonNotTaken" | "whatHappened" | "nextTimePlan") => (
    <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
      {missed[key] || <span className="text-slate-600 italic">{t("missed.nothingNoted")}</span>}
    </p>
  );

  return (
    <Modal
      open
      onClose={onClose}
      className="tv-trade-modal max-w-2xl max-h-[86dvh] overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--tv-border)] shrink-0">
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 md:gap-3.5 min-w-0">
            <div className="w-8 h-8 rounded-lg border border-[var(--tv-border)] bg-[var(--tv-plate-2)] flex items-center justify-center shrink-0">
              <Target className="w-4 h-4 text-slate-400" />
            </div>
            <div className="min-w-0">
              <h2 className="tv-title tracking-tight truncate leading-tight">
                {missed.symbol || t("tradeDetail.missedSetup")}
              </h2>
              <p className="tv-num text-[11px] md:tv-prose text-slate-500 mt-0.5 truncate">
                {dateStr}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {missed.estimatedR > 0 && (
              <span className="tv-num flex items-center gap-1 text-[11px] md:text-xs px-2 md:px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 font-bold whitespace-nowrap">
                <TrendingUp className="w-3 h-3 md:w-3.5 md:h-3.5" />+{missed.estimatedR.toFixed(1)}
                {t("missed.rMissed")}
              </span>
            )}
            <button
              onClick={onClose}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1 p-4 space-y-3 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
        <Section
          tone="red"
          icon={Quote}
          label={t("missed.card.why")}
          empty={!missed.reasonNotTaken}
        >
          {body("reasonNotTaken")}
        </Section>

        <Section
          tone="amber"
          icon={Activity}
          label={t("missed.card.what")}
          empty={!missed.whatHappened}
        >
          {body("whatHappened")}
        </Section>

        {/* Lesson learned — key takeaway, strongest visual weight */}
        <Section
          tone="blue"
          icon={Lightbulb}
          label={t("missed.card.lesson")}
          big
          empty={!missed.lessonLearned}
        >
          <p className="text-sm text-slate-100 leading-relaxed whitespace-pre-wrap font-medium">
            {missed.lessonLearned || (
              <span className="text-slate-600 italic font-normal">{t("missed.nothingNoted")}</span>
            )}
          </p>
        </Section>

        <Section
          tone="emerald"
          icon={Compass}
          label={t("missed.card.next")}
          empty={!missed.nextTimePlan}
        >
          {body("nextTimePlan")}
        </Section>

        {shots.length > 0 && (
          <div className="pt-1">
            <div className="flex items-center gap-2 mb-2.5 md:mb-3">
              <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
              <span className="tv-label text-slate-500">{t("tradeDetail.chartScreenshots")}</span>
              <span className="tv-num text-[10px] text-slate-700 font-semibold">
                · {shots.length}
              </span>
            </div>
            <ScreenshotsView paths={shots} size="lg" />
          </div>
        )}
      </div>
    </Modal>
  );
}
