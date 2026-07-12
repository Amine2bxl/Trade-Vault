import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { X, Star, ChevronDown, ChevronUp, ImagePlus, Plus, Wallet, Calculator, SlidersHorizontal } from 'lucide-react';
import { Trade, STRATEGIES, MISTAKE_OPTIONS } from '../types';
import { getSession } from '../utils/quantStats';
import { getDuration } from '../utils/tradeCalcs';
import { generateId } from '../store';
import { loadConfluences, saveConfluences, loadAccountBalance, saveAccountBalance, uploadScreenshot, deleteScreenshot } from '../store';
import { useAuth } from '../contexts/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { cn } from '../utils/cn';
import { compressImageToFile } from '../utils/image';
import { useScreenshotUrls } from '../hooks/useScreenshotUrls';
import Lightbox from './Lightbox';

interface TradeModalProps {
  trade: Trade | null;
  onClose: () => void;
  onSave: (trade: Trade) => void;
}

const defaultForm = {
  date: new Date().toISOString().split('T')[0],
  symbol: '',
  direction: 'long' as 'long' | 'short' | 'be',
  riskAmount: '',
  riskType: 'dollar' as 'dollar' | 'percent',
  rMultiple: '',
  pnl: 0,
  strategy: 'Scalping',
  mistakes: [] as string[],
  setupQuality: 3,
  notes: '',
  screenshots: [] as string[],
  entryTime: '09:30',
  exitTime: '10:00',
  confluences: [] as string[],
  confidence: 70,
  mae: '',
  mfe: '',
  slippage: '',
};

// Common futures point values for the position-size helper
const POINT_VALUES = [
  { label: 'NQ', value: 20 }, { label: 'MNQ', value: 2 },
  { label: 'ES', value: 50 }, { label: 'MES', value: 5 },
  { label: 'YM', value: 5 }, { label: 'GC', value: 100 },
];

export default function TradeModal({ trade, onClose, onSave }: TradeModalProps) {
  const { user } = useAuth();
  const userId = user?.id || '';
  const { t } = useT();

  const [userConfluences, setUserConfluences] = useState<string[]>([]);
  const [newConfluence, setNewConfluence] = useState('');
  const [accountBalance, setAccountBalance] = useState<number>(25000);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    loadConfluences(userId).then((c) => { if (active) setUserConfluences(c); }).catch(() => {});
    loadAccountBalance(userId).then((b) => { if (active) setAccountBalance(b); }).catch(() => {});
    return () => { active = false; };
  }, [userId]);

  const [form, setForm] = useState({ ...defaultForm, ...(trade ? {
    date: trade.date, symbol: trade.symbol, direction: trade.direction,
    riskAmount: String(trade.riskAmount), rMultiple: String(trade.rMultiple),
    pnl: trade.pnl, strategy: trade.strategy, mistakes: trade.mistakes,
    setupQuality: trade.setupQuality, notes: trade.notes,
    screenshots: trade.screenshots, entryTime: trade.entryTime,
    exitTime: trade.exitTime, confluences: trade.confluences,
    confidence: trade.confidence,
    mae: trade.mae != null ? String(trade.mae) : '',
    mfe: trade.mfe != null ? String(trade.mfe) : '',
    slippage: trade.slippage != null ? String(trade.slippage) : '',
  } : {}) });

  const [showCalc, setShowCalc] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [stopPoints, setStopPoints] = useState('');
  const [pointValue, setPointValue] = useState('20');

  const [showAllMistakes, setShowAllMistakes] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const riskDollar = useMemo(() => {
    const val = parseFloat(form.riskAmount) || 0;
    if (form.riskType === 'dollar') return val;
    return val / 100 * accountBalance;
  }, [form.riskAmount, form.riskType, accountBalance]);

  const calculatedPnl = useMemo(() => {
    const rm = parseFloat(form.rMultiple) || 0;
    return riskDollar * rm;
  }, [riskDollar, form.rMultiple]);

  // Position-size helper: contracts = risk / (stop distance × $ per point)
  const calcContracts = useMemo(() => {
    const stop = parseFloat(stopPoints) || 0;
    const pv = parseFloat(pointValue) || 0;
    if (riskDollar <= 0 || stop <= 0 || pv <= 0) return null;
    const contracts = Math.floor(riskDollar / (stop * pv));
    return { contracts, effectiveRisk: contracts * stop * pv };
  }, [riskDollar, stopPoints, pointValue]);

  const session = getSession(form.entryTime);

  // Screenshots upload straight to Supabase Storage (bucket path stored on the
  // trade) instead of inlining base64 into the row. Uploads made in this modal
  // session are tracked so they can be cleaned up if the user cancels.
  const sessionUploadsRef = useRef<string[]>([]);
  const savedRef = useRef(false);
  const screenshotUrls = useScreenshotUrls(form.screenshots);

  const handleScreenshotUpload = useCallback(async (files: FileList | File[] | null) => {
    if (!files || files.length === 0 || !userId) return;
    setUploading(true);
    const newScreenshots: string[] = [];
    for (let i = 0; i < files.length && form.screenshots.length + newScreenshots.length < 3; i++) {
      try {
        const compressed = await compressImageToFile(files[i]);
        const path = await uploadScreenshot(userId, compressed);
        sessionUploadsRef.current.push(path);
        newScreenshots.push(path);
      } catch {}
    }
    setForm(f => ({ ...f, screenshots: [...f.screenshots, ...newScreenshots] }));
    setUploading(false);
  }, [form.screenshots.length, userId]);

  // Cancel/close without saving → remove files uploaded during this session.
  useEffect(() => () => {
    if (savedRef.current) return;
    for (const path of sessionUploadsRef.current) {
      deleteScreenshot(path).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files = Array.from(items)
        .filter((it) => it.type.startsWith('image/'))
        .map((it) => it.getAsFile())
        .filter((f): f is File => !!f);
      if (files.length === 0) return;
      e.preventDefault();
      handleScreenshotUpload(files);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [handleScreenshotUpload]);

  const removeScreenshot = (idx: number) => {
    const removed = form.screenshots[idx];
    // Only delete the file immediately if it was uploaded in this session —
    // pre-existing files stay until the trade is saved without them.
    if (removed && sessionUploadsRef.current.includes(removed)) {
      sessionUploadsRef.current = sessionUploadsRef.current.filter((p) => p !== removed);
      deleteScreenshot(removed).catch(() => {});
    }
    setForm(f => ({ ...f, screenshots: f.screenshots.filter((_, i) => i !== idx) }));
  };

  const addConfluence = () => {
    const trimmed = newConfluence.trim();
    if (trimmed && !userConfluences.includes(trimmed)) {
      const updated = [...userConfluences, trimmed];
      setUserConfluences(updated);
      saveConfluences(userId, updated);
    }
    setNewConfluence('');
  };

  const removeConfluence = (c: string) => {
    const updated = userConfluences.filter(x => x !== c);
    setUserConfluences(updated);
    saveConfluences(userId, updated);
    setForm(f => ({ ...f, confluences: f.confluences.filter(x => x !== c) }));
  };

  const toggleConfluence = (c: string) => {
    setForm(f => ({ ...f, confluences: f.confluences.includes(c) ? f.confluences.filter(x => x !== c) : [...f.confluences, c] }));
  };

  const handleSave = () => {
    const isBE = form.direction === 'be';
    const rm = isBE ? 0 : parseFloat(form.rMultiple) || 0;
    const risk = riskDollar;
    savedRef.current = true;
    // Pre-existing screenshots the user removed in this session: their files
    // are no longer referenced once the trade saves — delete them now.
    if (trade) {
      for (const old of trade.screenshots) {
        if (!old.startsWith('data:') && !form.screenshots.includes(old)) {
          deleteScreenshot(old).catch(() => {});
        }
      }
    }
    onSave({
      id: trade?.id || generateId(),
      date: form.date, symbol: form.symbol.toUpperCase(), direction: form.direction,
      pnl: isBE ? 0 : Math.round(risk * rm * 100) / 100,
      riskAmount: Math.round(risk * 100) / 100,
      rMultiple: rm,
      strategy: form.strategy, mistakes: form.mistakes,
      setupQuality: form.setupQuality, notes: form.notes,
      screenshots: form.screenshots, entryTime: form.entryTime, exitTime: form.exitTime,
      confluences: form.confluences, confidence: form.confidence,
      mae: form.mae === '' ? null : parseFloat(form.mae) || 0,
      mfe: form.mfe === '' ? null : parseFloat(form.mfe) || 0,
      slippage: form.slippage === '' ? null : parseFloat(form.slippage) || 0,
    });
  };

  const isValid = form.symbol && form.date && parseFloat(form.riskAmount) > 0 && (form.direction === 'be' || form.rMultiple !== '');

  const inputClass = 'w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 transition-all';
  const labelClass = 'block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-strong rounded-t-3xl md:rounded-3xl w-full md:max-w-2xl max-h-[96vh] md:max-h-[92vh] overflow-hidden animate-slide-up md:animate-slide-in shadow-2xl shadow-black/50">
        {/* Dynamic accent: green when the entry is a gain, red when a loss */}
        <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-[2px] transition-colors duration-300',
          form.direction === 'be' ? 'bg-slate-500/40' : calculatedPnl > 0 ? 'bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent' : calculatedPnl < 0 ? 'bg-gradient-to-r from-transparent via-red-400/70 to-transparent' : 'bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent')} />
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-lg font-bold text-white">{trade ? t('trade.editTitle') : t('trade.newTitle')}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto max-h-[calc(92vh-130px)] px-6 py-5 space-y-5">
          {/* Row 1: Symbol, Direction, Date */}
          <div className="grid grid-cols-3 gap-3">
            <div><label className={labelClass}>{t('trade.symbol')}</label><input type="text" value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))} placeholder="TSLA" className={inputClass} /></div>
            <div>
              <label className={labelClass}>{t('trade.direction')}</label>
              <div className="grid grid-cols-3 gap-2">
                {(['long', 'short', 'be'] as const).map(dir => {
                  const activeClass = dir === 'long'
                    ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400'
                    : dir === 'short'
                      ? 'bg-red-500/15 border-red-500/25 text-red-400'
                      : 'bg-slate-500/15 border-slate-500/25 text-slate-300';
                  const label = dir === 'be' ? t('common.be') : dir === 'long' ? t('common.long') : t('common.short');
                  const shortLabel = dir === 'long' ? 'L' : dir === 'short' ? 'S' : 'BE';
                  return (
                    <button key={dir} onClick={() => setForm(f => ({
                      ...f,
                      direction: dir,
                      ...(dir === 'be' ? { rMultiple: '0' } : {}),
                    }))}
                      className={cn('w-full py-2.5 rounded-xl text-sm font-semibold transition-all border text-center',
                        form.direction === dir
                          ? activeClass
                          : 'bg-white/[0.03] border-white/[0.06] text-slate-500 hover:text-slate-300'
                      )}>
                      {/* Compact single-letter labels on mobile, full words on ≥sm */}
                      <span className="sm:hidden">{shortLabel}</span>
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div><label className={labelClass}>{t('trade.date')}</label><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inputClass} /></div>
          </div>

          {/* Row 2: Risk Amount + R:R + P&L */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>{t('trade.riskAmount')}</label>
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">{form.riskType === 'dollar' ? '$' : ''}</span>
                  <input type="number" step="0.01" value={form.riskAmount} onChange={e => setForm(f => ({ ...f, riskAmount: e.target.value }))} placeholder={form.riskType === 'dollar' ? '0.00' : '1.0'} className={cn(inputClass, 'pl-7')} />
                  {form.riskType === 'percent' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>}
                </div>
                <button onClick={() => setForm(f => ({ ...f, riskType: f.riskType === 'dollar' ? 'percent' : 'dollar' }))}
                  className="px-3 rounded-xl border border-white/[0.08] text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all shrink-0">
                  {form.riskType === 'dollar' ? '$' : '%'}
                </button>
              </div>
            </div>
            <div>
              <label className={labelClass}>{t('trade.rrMultiple')}</label>
              <input type="number" step="0.1" value={form.rMultiple} onChange={e => setForm(f => ({ ...f, rMultiple: e.target.value }))} placeholder="2.0" className={inputClass} />
              <div className="text-[10px] text-slate-600 mt-1">{t('trade.rrHint')}</div>
            </div>
            <div>
              <label className={labelClass}>{t('trade.estPnl')}</label>
              <div className={cn('w-full rounded-xl px-3 py-2.5 text-sm font-bold border',
                calculatedPnl > 0 ? 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400' :
                calculatedPnl < 0 ? 'bg-red-500/10 border-red-500/15 text-red-400' :
                'bg-white/[0.03] border-white/[0.06] text-slate-400'
              )}>{calculatedPnl >= 0 ? '+' : ''}{calculatedPnl.toFixed(2)}</div>
            </div>
          </div>

          {/* Account Balance (for % risk) */}
          {form.riskType === 'percent' && (
            <div className="flex items-center gap-3 bg-white/[0.02] rounded-xl p-3 border border-white/[0.04]">
              <Wallet className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="text-xs text-slate-500 shrink-0">{t('trade.accountBalance')}</span>
              <input type="number" value={accountBalance} onChange={e => { const v = parseFloat(e.target.value) || 0; setAccountBalance(v); saveAccountBalance(userId, v); }}
                className="flex-1 bg-transparent text-sm text-white focus:outline-none" />
              <span className="text-xs text-slate-600">→ ${riskDollar.toFixed(2)} risk</span>
            </div>
          )}

          {/* Position size calculator */}
          <div className="bg-white/[0.02] rounded-xl border border-white/[0.04]">
            <button type="button" onClick={() => setShowCalc(v => !v)} className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors">
              <Calculator className="w-3.5 h-3.5 text-cyan-400/70" />
              {t('trade.positionCalc')}
              {showCalc ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
            </button>
            {showCalc && (
              <div className="px-3 pb-3 space-y-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {POINT_VALUES.map(p => (
                    <button key={p.label} type="button" onClick={() => setPointValue(String(p.value))}
                      className={cn('px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border',
                        pointValue === String(p.value) ? 'bg-cyan-500/15 border-cyan-500/25 text-cyan-300' : 'bg-white/[0.03] border-white/[0.06] text-slate-500 hover:text-slate-300')}>
                      {p.label} ${p.value}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={labelClass}>{t('trade.stopPoints')}</label><input type="number" step="0.25" min="0" value={stopPoints} onChange={e => setStopPoints(e.target.value)} placeholder="10" className={inputClass} /></div>
                  <div><label className={labelClass}>{t('trade.pointValue')}</label><input type="number" step="0.5" min="0" value={pointValue} onChange={e => setPointValue(e.target.value)} className={inputClass} /></div>
                </div>
                <div className={cn('rounded-xl px-3 py-2.5 text-xs font-semibold border flex items-center justify-between',
                  calcContracts ? 'bg-cyan-500/[0.06] border-cyan-500/15 text-cyan-300' : 'bg-white/[0.02] border-white/[0.04] text-slate-500')}>
                  {calcContracts ? (
                    <>
                      <span>{calcContracts.contracts} {t('trade.contracts')}</span>
                      <span className="text-slate-400">{t('trade.effectiveRisk')}: ${calcContracts.effectiveRisk.toFixed(2)}</span>
                    </>
                  ) : (<span>{t('trade.calcHint')}</span>)}
                </div>
              </div>
            )}
          </div>

          {/* Entry/Exit Time + Strategy */}
          <div className="grid grid-cols-3 gap-3">
            <div><label className={labelClass}>{t('trade.entryTime')}</label><input type="time" value={form.entryTime} onChange={e => setForm(f => ({ ...f, entryTime: e.target.value }))} className={inputClass} /></div>
            <div><label className={labelClass}>{t('trade.exitTime')}</label><input type="time" value={form.exitTime} onChange={e => setForm(f => ({ ...f, exitTime: e.target.value }))} className={inputClass} /></div>
            <div><label className={labelClass}>{t('trade.strategy')}</label>
              <select value={form.strategy} onChange={e => setForm(f => ({ ...f, strategy: e.target.value }))} className={cn(inputClass, 'cursor-pointer appearance-none')}>
                {STRATEGIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Setup Quality */}
          <div>
            <label className={labelClass}>{t('trade.setupQuality')}</label>
            <div className="flex gap-2.5">
              {[1, 2, 3, 4, 5].map(n => {
                const on = n <= form.setupQuality;
                return (
                  <button key={n} onClick={() => setForm(f => ({ ...f, setupQuality: n }))} aria-label={`${n} / 5`} className="star-btn focus:outline-none p-0.5">
                    <Star className={cn('w-8 h-8 transition-colors', on ? 'text-amber-400 fill-amber-400 star-on' : 'text-slate-700 hover:text-amber-400/40')} strokeWidth={on ? 2 : 1.75} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Confidence */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelClass + ' mb-0'}>{t('trade.confidence')}</label>
              <span className={cn('text-sm font-bold', form.confidence >= 75 ? 'text-emerald-400' : form.confidence >= 50 ? 'text-amber-400' : 'text-red-400')}>{form.confidence}%</span>
            </div>
            <input type="range" min="1" max="100" value={form.confidence} onChange={e => setForm(f => ({ ...f, confidence: parseInt(e.target.value) }))} className="w-full" />
          </div>

          {/* Confluences (Customizable) */}
          <div>
            <label className={labelClass}>{t('trade.confluences')}</label>
            {/* Equal-size bubbles: a 2-col grid on mobile keeps every chip the
                exact same width/height; flows naturally as wrap chips on ≥sm. */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mb-2">
              {userConfluences.map(c => (
                <div key={c} className="relative group">
                  <button onClick={() => toggleConfluence(c)}
                    className={cn('w-full px-3 py-2 rounded-xl text-xs font-medium transition-all border text-center truncate',
                      form.confluences.includes(c) ? 'bg-cyan-500/15 border-cyan-500/25 text-cyan-400' : 'bg-white/[0.03] border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-slate-600'
                    )}>{c}</button>
                  <button onClick={() => removeConfluence(c)} aria-label="Remove"
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#0c1018] border border-white/10 flex items-center justify-center text-slate-500 hover:text-red-400 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newConfluence} onChange={e => setNewConfluence(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addConfluence())}
                placeholder={t('trade.addConfluencePlaceholder')} className={cn(inputClass, 'flex-1 py-2 text-xs')} />
              <button onClick={addConfluence} className="px-3 rounded-xl border border-white/[0.08] text-cyan-400 hover:bg-cyan-500/10 transition-all">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mistakes */}
          <div>
            <label className={labelClass}>{t('trade.mistakes')}</label>
            <div className="flex flex-wrap gap-2">
              {(showAllMistakes ? MISTAKE_OPTIONS : MISTAKE_OPTIONS.slice(0, 5)).map(m => (
                <button key={m} onClick={() => setForm(f => ({ ...f, mistakes: f.mistakes.includes(m) ? f.mistakes.filter(x => x !== m) : [...f.mistakes, m] }))}
                  className={cn('px-3 py-1.5 rounded-xl text-xs font-medium transition-all border',
                    form.mistakes.includes(m) ? 'bg-red-500/15 border-red-500/25 text-red-400' : 'bg-white/[0.03] border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-slate-600'
                  )}>{m}</button>
              ))}
              <button onClick={() => setShowAllMistakes(!showAllMistakes)} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 px-2 py-1.5">
                {showAllMistakes ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Screenshots */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelClass + ' mb-0'}>{t('trade.screenshots')}</label>
              <span className="text-[10px] text-slate-600 flex items-center gap-1">{t('common.pasteHint')}</span>
            </div>
            <div className="flex gap-3 flex-wrap items-start">
              {form.screenshots.map((shot, i) => (
                <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-white/[0.08] group">
                  <button type="button" onClick={() => setLightboxIndex(i)} className="block w-full h-full">
                    {screenshotUrls[shot] ? (
                      <img src={screenshotUrls[shot]} alt={`Screenshot ${i + 1}`} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" /></div>
                    )}
                  </button>
                  <button onClick={() => removeScreenshot(i)} className="absolute top-1 right-1 w-5 h-5 bg-red-500/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3 text-white" /></button>
                </div>
              ))}
              {form.screenshots.length < 3 && (
                <label className="w-24 h-24 rounded-xl border-2 border-dashed border-white/[0.08] flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500/30 hover:bg-cyan-500/[0.03] transition-all">
                  {uploading ? <div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" /> : (<><ImagePlus className="w-5 h-5 text-slate-600" /><span className="text-[10px] text-slate-600 mt-1">{t('trade.upload')}</span></>)}
                  <input type="file" accept="image/*" multiple onChange={e => handleScreenshotUpload(e.target.files)} className="hidden" />
                </label>
              )}
            </div>
          </div>

          {/* Advanced: MAE / MFE / slippage */}
          <div className="bg-white/[0.02] rounded-xl border border-white/[0.04]">
            <button type="button" onClick={() => setShowAdvanced(v => !v)} className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors">
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400/70" />
              {t('trade.advanced')}
              {showAdvanced ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
            </button>
            {showAdvanced && (
              <div className="px-3 pb-3 grid grid-cols-3 gap-2">
                <div><label className={labelClass}>MAE ($)</label><input type="number" step="0.01" value={form.mae} onChange={e => setForm(f => ({ ...f, mae: e.target.value }))} placeholder="—" className={inputClass} /><div className="text-[9px] text-slate-600 mt-1">{t('trade.maeHint')}</div></div>
                <div><label className={labelClass}>MFE ($)</label><input type="number" step="0.01" value={form.mfe} onChange={e => setForm(f => ({ ...f, mfe: e.target.value }))} placeholder="—" className={inputClass} /><div className="text-[9px] text-slate-600 mt-1">{t('trade.mfeHint')}</div></div>
                <div><label className={labelClass}>{t('trade.slippage')} ($)</label><input type="number" step="0.01" value={form.slippage} onChange={e => setForm(f => ({ ...f, slippage: e.target.value }))} placeholder="—" className={inputClass} /></div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className={labelClass}>{t('trade.notes')}</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder={t('trade.notesPlaceholder')} className={cn(inputClass, 'resize-none')} />
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3 px-4 md:px-6 py-3 md:py-4 border-t border-white/[0.06]">
          {/* Live recap: what will be saved */}
          <div className="flex-1 min-w-0 flex items-center gap-2 text-[11px] text-slate-500 overflow-hidden">
            {isValid ? (
              <>
                <span className="font-bold text-white shrink-0">{form.symbol.toUpperCase()}</span>
                {session && <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-[9px] font-bold uppercase shrink-0">{t(`session.${session}` as never)}</span>}
                <span className="hidden sm:inline shrink-0">{getDuration(form.entryTime, form.exitTime)}</span>
                <span className={cn('font-bold tabular-nums shrink-0', form.direction === 'be' ? 'text-slate-300' : calculatedPnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {form.direction === 'be' ? 'BE' : `${calculatedPnl >= 0 ? '+' : ''}$${Math.abs(calculatedPnl).toFixed(2)}`}
                </span>
              </>
            ) : (
              <span className="truncate">{t('trade.fillRequired')}</span>
            )}
          </div>
          <button onClick={onClose} className="px-4 md:px-5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors shrink-0">{t('common.cancel')}</button>
          <button onClick={handleSave} disabled={!isValid}
            className={cn('px-6 py-2.5 rounded-xl text-sm font-bold transition-all',
              isValid ? 'bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white shadow-lg shadow-cyan-500/20' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            )}>{trade ? t('trade.updateTrade') : t('trade.saveTrade')}</button>
        </div>
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          images={form.screenshots.map((s) => screenshotUrls[s] || '')}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </div>
  );
}
