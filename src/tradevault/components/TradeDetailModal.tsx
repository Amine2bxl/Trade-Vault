import { X, ArrowUpRight, ArrowDownRight, Clock, Star, BarChart3, Minus, Target, ChevronLeft, ChevronRight } from 'lucide-react';
import { Trade, MissedOpportunity, isBreakEven } from '../types';
import { formatPnl, getDuration, directionLabel, directionBadgeClass } from '../utils/tradeCalcs';
import { getSession, getMacroEvents } from '../utils/quantStats';
import { cn } from '../utils/cn';
import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/LanguageContext';
import { useScreenshotUrls } from '../hooks/useScreenshotUrls';
import Lightbox from './Lightbox';

interface TradeDetailModalProps {
  trades: Trade[];
  date: string;
  onClose: () => void;
  missed?: MissedOpportunity[];
  onOpenMissed?: (m: MissedOpportunity) => void;
  /** Swipe (mobile) / arrow-key navigation between trades in a list */
  onNavigate?: (dir: 1 | -1) => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  positionLabel?: string;
}

const LOCALE_MAP: Record<string, string> = { en: 'en-US', es: 'es-ES', pt: 'pt-PT', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', nl: 'nl-NL', ru: 'ru-RU', zh: 'zh-CN', ja: 'ja-JP', ar: 'ar-SA', hi: 'hi-IN' };

export default function TradeDetailModal({ trades, date, onClose, missed = [], onOpenMissed, onNavigate, hasPrev, hasNext, positionLabel }: TradeDetailModalProps) {
  const { t, lang } = useT();
  const locale = LOCALE_MAP[lang] || 'en-US';
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  // Screenshots are stored as storage paths (or legacy data: URLs) — resolve
  // them all in one batched signed-URL request.
  const screenshotUrls = useScreenshotUrls(trades.flatMap((tr) => tr.screenshots));
  const dayPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const d = new Date(date + 'T12:00:00');
  const dateStr = `${d.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' })}, '${String(d.getFullYear()).slice(-2)}`;
  const macro = getMacroEvents(date);

  // Arrow keys navigate when a list context is provided
  useEffect(() => {
    if (!onNavigate) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && hasPrev) onNavigate(-1);
      else if (e.key === 'ArrowRight' && hasNext) onNavigate(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNavigate, hasPrev, hasNext]);

  // Horizontal swipe on mobile
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!onNavigate || !touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx > 0 && hasPrev) onNavigate(-1);
    else if (dx < 0 && hasNext) onNavigate(1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative glass-strong rounded-t-3xl md:rounded-3xl max-w-3xl w-full max-h-[96vh] md:max-h-[88vh] overflow-hidden animate-slide-up md:animate-slide-in shadow-2xl shadow-black/50"
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="w-10 h-1 rounded-full bg-slate-700 mx-auto mt-2 md:hidden" />
        <div className="px-4 md:px-6 pt-2 md:p-6 pb-3 md:pb-6 border-b border-white/[0.06]">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">{dateStr}</h2>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-slate-400">{trades.length} {trades.length !== 1 ? t('tradeDetail.tradesCountSuffix') : t('tradeDetail.tradeCountSuffix')}</p>
                {macro.map(ev => (
                  <span key={ev} className="px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[9px] font-bold" title={t('tradeDetail.macroHint')}>{ev}</span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              {onNavigate && (
                <div className="flex items-center gap-1">
                  <button onClick={() => onNavigate(-1)} disabled={!hasPrev} aria-label={t('common.previous')}
                    className={cn('w-8 h-8 rounded-xl flex items-center justify-center transition-colors', hasPrev ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-700 cursor-not-allowed')}>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {positionLabel && <span className="text-[10px] text-slate-500 tabular-nums min-w-[36px] text-center">{positionLabel}</span>}
                  <button onClick={() => onNavigate(1)} disabled={!hasNext} aria-label={t('common.next')}
                    className={cn('w-8 h-8 rounded-xl flex items-center justify-center transition-colors', hasNext ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-700 cursor-not-allowed')}>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className={cn('text-2xl font-bold', dayPnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>{formatPnl(dayPnl)}</div>
              <button onClick={onClose} aria-label={t('common.close')} className="w-11 h-11 md:w-9 md:h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors"><X className="w-5 h-5" /></button>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(96vh-100px)] md:max-h-[calc(88vh-90px)] p-4 md:p-6 space-y-3 md:space-y-4">
          {missed.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {missed.map(m => (
                <button
                  key={m.id}
                  onClick={() => onOpenMissed?.(m)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-bold hover:bg-amber-500/20 transition-all"
                >
                  <Target className="w-3.5 h-3.5" />
                  {t('tradeDetail.missedSetup')}{m.symbol ? `: ${m.symbol}` : ''}
                </button>
              ))}
            </div>
          )}
          {trades.map(trade => { const be = isBreakEven(trade); return (
            <div key={trade.id} className="glass rounded-2xl p-5 space-y-5 card-premium">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center',
                    be ? 'bg-slate-500/15' : trade.pnl >= 0 ? 'bg-emerald-500/15' : 'bg-red-500/15')}>
                    {be ? <Minus className="w-5 h-5 text-slate-300" /> :
                      trade.pnl >= 0 ? <ArrowUpRight className="w-5 h-5 text-emerald-400" /> : <ArrowDownRight className="w-5 h-5 text-red-400" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-white">{trade.symbol}</span>
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-md', directionBadgeClass(trade.direction))}>{directionLabel(trade.direction)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-500">{trade.strategy}</span>
                      {getSession(trade.entryTime) && (
                        <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-[9px] font-bold uppercase">{t(`session.${getSession(trade.entryTime)}` as never)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn('text-xl font-bold', be ? 'text-slate-300' : trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>{formatPnl(trade.pnl)}</div>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                  <Clock className="w-3.5 h-3.5 text-slate-500 mx-auto mb-1" />
                  <div className="text-[10px] text-slate-500 mb-0.5">{t('tradeDetail.entry')}</div>
                  <div className="text-sm font-semibold text-white">{trade.entryTime || '—'}</div>
                </div>
                <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                  <Clock className="w-3.5 h-3.5 text-slate-500 mx-auto mb-1" />
                  <div className="text-[10px] text-slate-500 mb-0.5">{t('tradeDetail.exit')}</div>
                  <div className="text-sm font-semibold text-white">{trade.exitTime || '—'}</div>
                </div>
                <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                  <div className="text-[10px] text-slate-500 mb-1">{t('tradeDetail.duration')}</div>
                  <div className="text-sm font-semibold text-white">{getDuration(trade.entryTime, trade.exitTime)}</div>
                </div>
                <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                  <BarChart3 className="w-3.5 h-3.5 text-slate-500 mx-auto mb-1" />
                  <div className="text-[10px] text-slate-500 mb-0.5">{t('tradeDetail.rr')}</div>
                  <div className={cn('text-sm font-semibold', trade.rMultiple >= 0 ? 'text-emerald-400' : 'text-red-400')}>{trade.rMultiple.toFixed(2)}R</div>
                </div>
                <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                  <Star className="w-3.5 h-3.5 text-slate-500 mx-auto mb-1" />
                  <div className="text-[10px] text-slate-500 mb-0.5">{t('tradeDetail.quality')}</div>
                  <div className="text-sm font-semibold text-slate-300">{'★'.repeat(trade.setupQuality)}{'☆'.repeat(5 - trade.setupQuality)}</div>
                </div>
              </div>

              {/* Risk */}
              <div className="flex flex-wrap gap-3 md:gap-4 text-xs">
                <div className="bg-white/[0.03] rounded-lg px-3 py-2"><span className="text-slate-500">{t('tradeDetail.risk')}: </span><span className="text-white font-semibold">${trade.riskAmount.toFixed(2)}</span></div>
                {trade.riskAmount > 0 && (
                  <div className="bg-white/[0.03] rounded-lg px-3 py-2"><span className="text-slate-500">{t('tradeDetail.pnlPerRisk')}: </span><span className={cn('font-semibold', trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>{(trade.pnl / trade.riskAmount).toFixed(2)}R</span></div>
                )}
                {trade.mae != null && (
                  <div className="bg-white/[0.03] rounded-lg px-3 py-2"><span className="text-slate-500">MAE: </span><span className="text-red-400 font-semibold">-${Math.abs(trade.mae).toFixed(2)}</span></div>
                )}
                {trade.mfe != null && (
                  <div className="bg-white/[0.03] rounded-lg px-3 py-2"><span className="text-slate-500">MFE: </span><span className="text-emerald-400 font-semibold">+${Math.abs(trade.mfe).toFixed(2)}</span></div>
                )}
                {trade.slippage != null && (
                  <div className="bg-white/[0.03] rounded-lg px-3 py-2"><span className="text-slate-500">{t('trade.slippage')}: </span><span className="text-slate-300 font-semibold">${trade.slippage.toFixed(2)}</span></div>
                )}
              </div>

              {/* Confidence */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500">{t('tradeDetail.confidenceLevel')}</span>
                  <span className={cn('text-xs font-bold', trade.confidence >= 75 ? 'text-emerald-400' : trade.confidence >= 50 ? 'text-slate-300' : 'text-red-400')}>{trade.confidence}%</span>
                </div>
                <div className="w-full bg-white/[0.05] rounded-full h-2 overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all duration-700', trade.confidence >= 75 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : trade.confidence >= 50 ? 'bg-gradient-to-r from-amber-500 to-amber-400' : 'bg-gradient-to-r from-red-500 to-red-400')}
                    style={{ width: `${trade.confidence}%` }} />
                </div>
              </div>

              {/* Confluences */}
              {trade.confluences.length > 0 && (
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block mb-2">{t('tradeDetail.confluences')}</span>
                  <div className="flex flex-wrap gap-2">
                    {trade.confluences.map(c => <span key={c} className="px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/15 text-cyan-400 text-xs font-medium">{c}</span>)}
                  </div>
                </div>
              )}

              {/* Mistakes */}
              {trade.mistakes.length > 0 && (
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block mb-2">{t('tradeDetail.mistakes')}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {trade.mistakes.map(m => <span key={m} className="px-2 py-1 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-medium">{m}</span>)}
                  </div>
                </div>
              )}

              {/* Screenshots */}
              {trade.screenshots.length > 0 && (
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block mb-2">{t('tradeDetail.chartScreenshots')}</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {trade.screenshots.map((shot, i) => (
                      <button key={i} onClick={() => setLightbox({ images: trade.screenshots.map((s) => screenshotUrls[s] || ''), index: i })} className="relative rounded-xl overflow-hidden border border-white/[0.06] hover:border-cyan-500/30 transition-all group bg-black/40">
                        {screenshotUrls[shot] ? (
                          <img
                            src={screenshotUrls[shot]}
                            alt={`Chart ${i + 1}`}
                            loading="lazy"
                            decoding="async"
                            className="w-full max-h-[420px] object-contain"
                          />
                        ) : (
                          <div className="w-full h-32 flex items-center justify-center"><div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" /></div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-white font-medium bg-black/40 px-2 py-1 rounded-md">{t('common.view')}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {trade.notes && (
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block mb-2">{t('tradeDetail.notes')}</span>
                  <div className="bg-white/[0.03] rounded-xl p-4 text-sm text-slate-300 leading-relaxed border border-white/[0.04]">{trade.notes}</div>
                </div>
              )}
            </div>
          );})}
        </div>
      </div>

      {lightbox && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onIndexChange={(i) => setLightbox((prev) => (prev ? { ...prev, index: i } : prev))}
        />
      )}
    </div>
  );
}
