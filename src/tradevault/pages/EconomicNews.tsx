import { CalendarDays, Info } from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import TradingViewCalendar from "../components/TradingViewCalendar";

export default function EconomicNews() {
  const { t, lang } = useT();

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="mb-4 animate-fade-in-up stagger-0 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            {t("news.title")}
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">{t("news.subtitle")}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-semibold">
          <span className="relative flex w-2 h-2">
            <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
            <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400" />
          </span>
          {lang === "fr" ? "En direct" : "Live"}
        </span>
      </div>

      {/* Live-data notice */}
      <div className="glass rounded-2xl px-4 py-3 mb-4 flex items-start gap-2.5 animate-fade-in-up stagger-1 border border-cyan-500/10">
        <Info className="w-4 h-4 text-cyan-400/80 shrink-0 mt-0.5" />
        <p className="text-[11px] leading-relaxed text-slate-400">
          {lang === "fr"
            ? "Calendrier en temps réel — valeurs réelles, prévisions et précédentes mises à jour en continu. Heures affichées dans ton fuseau."
            : "Real-time calendar — actual, forecast and previous values updated continuously. Times shown in your local timezone."}
        </p>
      </div>

      {/* Live widget */}
      <div className="glass rounded-2xl overflow-hidden flex-1 min-h-[560px] animate-fade-in-up stagger-2 relative">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.05]">
          <CalendarDays className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-display">
            {t("news.title")}
          </span>
        </div>
        <div className="absolute inset-0 top-[42px]">
          <TradingViewCalendar lang={lang} />
        </div>
      </div>
    </div>
  );
}
