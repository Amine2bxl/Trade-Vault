import { X, Target, HelpCircle, Activity, Lightbulb, Compass } from 'lucide-react';
import { MissedOpportunity } from '../types';
import { formatShortDate } from '../utils/tradeCalcs';
import { cn } from '../utils/cn';
import { ScreenshotsView } from '../pages/MissedOpportunities';
import { useT } from '../i18n/LanguageContext';

interface MissedSetupDetailModalProps {
  missed: MissedOpportunity;
  onClose: () => void;
}

const LOCALE_MAP: Record<string, string> = { en: 'en-US', es: 'es-ES', pt: 'pt-PT', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', nl: 'nl-NL', ru: 'ru-RU', zh: 'zh-CN', ja: 'ja-JP', ar: 'ar-SA', hi: 'hi-IN' };

function useSections() {
  const { t } = useT();
  return [
    { key: 'reasonNotTaken' as const, label: t('missed.card.why'), icon: HelpCircle, tone: 'red' as const },
    { key: 'whatHappened' as const, label: t('missed.card.what'), icon: Activity, tone: 'amber' as const },
    { key: 'lessonLearned' as const, label: t('missed.card.lesson'), icon: Lightbulb, tone: 'blue' as const },
    { key: 'nextTimePlan' as const, label: t('missed.card.next'), icon: Compass, tone: 'emerald' as const },
  ];
}

const TONES: Record<string, { border: string; bg: string; text: string; iconBg: string }> = {
  red: { border: 'border-red-500/15', bg: 'bg-red-500/[0.03]', text: 'text-red-400', iconBg: 'bg-red-500/10' },
  amber: { border: 'border-amber-500/15', bg: 'bg-amber-500/[0.03]', text: 'text-amber-400', iconBg: 'bg-amber-500/10' },
  blue: { border: 'border-blue-500/15', bg: 'bg-blue-500/[0.03]', text: 'text-blue-400', iconBg: 'bg-blue-500/10' },
  emerald: { border: 'border-emerald-500/15', bg: 'bg-emerald-500/[0.03]', text: 'text-emerald-400', iconBg: 'bg-emerald-500/10' },
};

export default function MissedSetupDetailModal({ missed, onClose }: MissedSetupDetailModalProps) {
  const { t, lang } = useT();
  const locale = LOCALE_MAP[lang] || 'en-US';
  const SECTIONS = useSections();
  const d = new Date(missed.date + 'T12:00:00');
  const dateStr = `${d.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' })}, '${String(d.getFullYear()).slice(-2)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative glass-strong rounded-t-3xl md:rounded-3xl max-w-2xl w-full max-h-[96vh] md:max-h-[88vh] overflow-hidden animate-slide-up md:animate-slide-in shadow-2xl shadow-black/50">
        <div className="w-10 h-1 rounded-full bg-slate-700 mx-auto mt-2 md:hidden" />

        {/* Header */}
        <div className="px-4 md:px-6 pt-2 md:p-6 pb-3 md:pb-6 border-b border-white/[0.06]">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <Target className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">{missed.symbol || t('tradeDetail.missedSetup')}</h2>
                  {missed.estimatedR > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 font-bold">
                      +{missed.estimatedR.toFixed(1)}{t('missed.rMissed')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{dateStr}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto max-h-[calc(96vh-100px)] md:max-h-[calc(88vh-110px)] p-4 md:p-6 space-y-3 md:space-y-4">
          {SECTIONS.map(({ key, label, icon: Icon, tone }) => {
            const value = missed[key];
            const toneStyle = TONES[tone];
            return (
              <div key={key} className={cn('rounded-2xl border p-4 md:p-5', toneStyle.border, toneStyle.bg)}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center', toneStyle.iconBg)}>
                    <Icon className={cn('w-3.5 h-3.5', toneStyle.text)} />
                  </div>
                  <span className={cn('text-[10px] uppercase tracking-wider font-bold', toneStyle.text)}>{label}</span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {value || <span className="text-slate-600 italic">{t('missed.nothingNoted')}</span>}
                </p>
              </div>
            );
          })}

          {missed.screenshots && missed.screenshots.length > 0 && (
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block mb-2">{t('tradeDetail.chartScreenshots')}</span>
              <ScreenshotsView paths={missed.screenshots} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
