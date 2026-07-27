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
} from "lucide-react";
import { MissedOpportunity } from "../types";
import { cn } from "../utils/cn";
import { ScreenshotsView } from "../pages/MissedOpportunities";
import { useT } from "../i18n/LanguageContext";
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

const TONES = {
  red: {
    border: "border-red-500/15",
    bg: "bg-red-500/[0.04]",
    text: "text-red-400",
    iconBg: "bg-red-500/10",
    bar: "bg-red-500/60",
  },
  amber: {
    border: "border-amber-500/15",
    bg: "bg-amber-500/[0.04]",
    text: "text-amber-400",
    iconBg: "bg-amber-500/10",
    bar: "bg-amber-500/60",
  },
  blue: {
    border: "border-cyan-500/25",
    bg: "bg-cyan-500/[0.06]",
    text: "text-cyan-400",
    iconBg: "bg-cyan-500/10",
    bar: "bg-cyan-500/70",
  },
  emerald: {
    border: "border-emerald-500/15",
    bg: "bg-emerald-500/[0.04]",
    text: "text-emerald-400",
    iconBg: "bg-emerald-500/10",
    bar: "bg-emerald-500/60",
  },
} as const;

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
        "relative rounded-2xl border overflow-hidden transition-all",
        s.border,
        s.bg,
        big && !empty && "shadow-[0_4px_24px_-4px_rgba(6,182,212,0.18)]",
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
      backdropClassName="bg-black/70 backdrop-blur-md"
      className="max-w-2xl max-h-[94vh] md:max-h-[88vh] overflow-hidden flex flex-col"
    >
      <div className="w-10 h-1 rounded-full bg-slate-700 mx-auto mt-2 md:hidden shrink-0" />

      {/* Header */}
      <div className="relative px-4 md:px-7 pt-3 md:pt-6 pb-3.5 md:pb-5 border-b border-white/[0.06] bg-gradient-to-b from-amber-500/[0.06] to-transparent overflow-hidden shrink-0">
        <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 md:gap-3.5 min-w-0">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-gradient-to-br from-amber-500/25 to-orange-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Target className="w-5 h-5 md:w-6 md:h-6 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base md:text-xl font-bold text-white tracking-tight truncate leading-tight">
                {missed.symbol || t("tradeDetail.missedSetup")}
              </h2>
              <p className="text-[11px] md:text-xs text-slate-500 mt-0.5 truncate">{dateStr}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {missed.estimatedR > 0 && (
              <span className="flex items-center gap-1 text-[11px] md:text-xs px-2 md:px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 font-bold whitespace-nowrap">
                <TrendingUp className="w-3 h-3 md:w-3.5 md:h-3.5" />+{missed.estimatedR.toFixed(1)}
                {t("missed.rMissed")}
              </span>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1 p-3.5 md:p-7 space-y-3 md:space-y-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] md:pb-7">
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
          <p className="text-sm md:text-[15px] text-slate-100 leading-relaxed whitespace-pre-wrap font-medium">
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
              <span className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold">
                {t("tradeDetail.chartScreenshots")}
              </span>
              <span className="text-[10px] text-slate-700 font-semibold">· {shots.length}</span>
            </div>
            <ScreenshotsView paths={shots} size="lg" />
          </div>
        )}
      </div>
    </Modal>
  );
}
