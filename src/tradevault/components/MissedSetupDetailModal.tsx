import type { ElementType, ReactNode } from 'react';
import { X, Target, Quote, Activity, Lightbulb, Compass, Image as ImageIcon } from 'lucide-react';
import { MissedOpportunity } from '../types';
import { cn } from '../utils/cn';
import { ScreenshotsView } from '../pages/MissedOpportunities';
import { useT } from '../i18n/LanguageContext';

interface MissedSetupDetailModalProps {
  missed: MissedOpportunity;
  onClose: () => void;
}

const LOCALE_MAP: Record<string, string> = { en: 'en-US', es: 'es-ES', pt: 'pt-PT', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', nl: 'nl-NL', ru: 'ru-RU', zh: 'zh-CN', ja: 'ja-JP', ar: 'ar-SA', hi: 'hi-IN' };

const TONES: Record<string, { border: string; bg: string; text: string; iconBg: string; bar: string; glow?: string }> = {
  red: { border: 'border-red-500/15', bg: 'bg-red-500/[0.04]', text: 'text-red-400', iconBg: 'bg-red-500/10', bar: 'bg-red-500/60' },
  amber: { border: 'border-amber-500/15', bg: 'bg-amber-500/[0.04]', text: 'text-amber-400', iconBg: 'bg-amber-500/10', bar: 'bg-amber-500/60' },
  blue: { border: 'border-blue-500/20', bg: 'bg-blue-500/[0.05]', text: 'text-blue-400', iconBg: 'bg-blue-500/10', bar: 'bg-blue-500/70', glow: 'shadow-[0_4px_24px_-4px_rgba(59,130,246,0.15)]' },
  emerald: { border: 'border-emerald-500/15', bg: 'bg-emerald-500/[0.04]', text: 'text-emerald-400', iconBg: 'bg-emerald-500/10', bar: 'bg-emerald-500/60' },
};

function Section({ tone, icon: Icon, label, step, children, big }: { tone: keyof typeof TONES; icon: ElementType; label: string; step: string; children: ReactNode; big?: boolean }) {
  const s = TONES[tone];
  return (
    <div className={cn('relative rounded-2xl border overflow-hidden card-premium', s.border, s.bg, s.glow)}>
      <div className={cn('absolute inset-y-0 left-0 w-[3px]', s.bar)} />
      <div className={cn('p-4 md:p-5 pl-5 md:pl-6', big && 'md:p-6 md:pl-7')}>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div className={cn('rounded-lg flex items-center justify-center', s.iconBg, big ? 'w-7 h-7' : 'w-6 h-6')}>
              <Icon className={cn(s.text, big ? 'w-4 h-4' : 'w-3.5 h-3.5')} />
            </div>
            <span className={cn('uppercase tracking-wider font-bold', s.text, big ? 'text-[11px]' : 'text-[10px]')}>{label}</span>
          </div>
          <span className="text-[9px] font-bold tracking-wider text-slate-600">{step}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function MissedSetupDetailModal({ missed, onClose }: MissedSetupDetailModalProps) {
  const { t, lang } = useT();
  const locale = LOCALE_MAP[lang] || 'en-US';
  const d = new Date(missed.date + 'T12:00:00');
  const dateStr = `${d.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' })}, '${String(d.getFullYear()).slice(-2)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative glass-strong rounded-t-3xl md:rounded-3xl max-w-2xl w-full max-h-[96vh] md:max-h-[88vh] overflow-hidden animate-slide-up md:animate-slide-in shadow-2xl shadow-black/50">
        <div className="w-10 h-1 rounded-full bg-slate-700 mx-auto mt-2 md:hidden" />

        {/* Header */}
        <div className="relative px-5 md:px-7 pt-3 md:pt-6 pb-4 md:pb-6 border-b border-white/[0.06] bg-gradient-to-b from-amber-500/[0.06] to-transparent overflow-hidden">
          <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-gradient-to-br from-amber-500/25 to-orange-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <Target className="w-5 h-5 md:w-6 md:h-6 text-amber-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg md:text-xl font-bold text-white tracking-tight truncate">{missed.symbol || t('tradeDetail.missedSetup')}</h2>
                  {missed.estimatedR > 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 font-bold whitespace-nowrap">
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
        <div className="overflow-y-auto max-h-[calc(96vh-112px)] md:max-h-[calc(88vh-122px)] p-4 md:p-7 space-y-3.5 md:space-y-4">
          <Section tone="red" icon={Quote} label={t('missed.card.why')} step="01">
            <p className="text-[15px] text-slate-200 leading-relaxed whitespace-pre-wrap">
              {missed.reasonNotTaken || <span className="text-slate-600 italic">{t('missed.nothingNoted')}</span>}
            </p>
          </Section>

          <Section tone="amber" icon={Activity} label={t('missed.card.what')} step="02">
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
              {missed.whatHappened || <span className="text-slate-600 italic">{t('missed.nothingNoted')}</span>}
            </p>
          </Section>

          {/* Lesson learned — the key takeaway, given the most visual weight */}
          <Section tone="blue" icon={Lightbulb} label={t('missed.card.lesson')} step="03" big>
            <p className="text-sm md:text-[15px] text-slate-100 leading-relaxed whitespace-pre-wrap font-medium">
              {missed.lessonLearned || <span className="text-slate-600 italic font-normal">{t('missed.nothingNoted')}</span>}
            </p>
          </Section>

          <Section tone="emerald" icon={Compass} label={t('missed.card.next')} step="04">
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
              {missed.nextTimePlan || <span className="text-slate-600 italic">{t('missed.nothingNoted')}</span>}
            </p>
          </Section>

          {missed.screenshots && missed.screenshots.length > 0 && (
            <div className="pt-1">
              <div className="flex items-center gap-2 mb-3">
                <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{t('tradeDetail.chartScreenshots')}</span>
                <span className="text-[10px] text-slate-700 font-semibold">· {missed.screenshots.length}</span>
              </div>
              <ScreenshotsView paths={missed.screenshots} size="lg" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
