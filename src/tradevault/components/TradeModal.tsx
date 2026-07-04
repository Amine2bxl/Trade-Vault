import { useState, useMemo, useCallback, useEffect } from 'react';
import { X, Star, ChevronDown, ChevronUp, ImagePlus, Plus, Wallet } from 'lucide-react';
import { Trade, STRATEGIES, MISTAKE_OPTIONS } from '../types';
import { generateId } from '../store';
import { loadConfluences, saveConfluences, loadAccountBalance, saveAccountBalance } from '../store';
import { useAuth } from '../contexts/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { cn } from '../utils/cn';
import { compressImageToDataUrl } from '../utils/image';

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
};

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
  } : {}) });

  const [showAllMistakes, setShowAllMistakes] = useState(false);
  const [uploading, setUploading] = useState(false);

  const riskDollar = useMemo(() => {
    const val = parseFloat(form.riskAmount) || 0;
    if (form.riskType === 'dollar') return val;
    return val / 100 * accountBalance;
  }, [form.riskAmount, form.riskType, accountBalance]);

  const calculatedPnl = useMemo(() => {
    const rm = parseFloat(form.rMultiple) || 0;
    return riskDollar * rm;
  }, [riskDollar, form.rMultiple]);

  const handleScreenshotUpload = useCallback(async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const newScreenshots: string[] = [];
    for (let i = 0; i < files.length && form.screenshots.length + newScreenshots.length < 3; i++) {
      try { newScreenshots.push(await compressImageToDataUrl(files[i])); } catch {}
    }
    setForm(f => ({ ...f, screenshots: [...f.screenshots, ...newScreenshots] }));
    setUploading(false);
  }, [form.screenshots.length]);

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
    });
  };

  const isValid = form.symbol && form.date && parseFloat(form.riskAmount) > 0 && (form.direction === 'be' || form.rMultiple !== '');

  const inputClass = 'w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 transition-all';
  const labelClass = 'block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-strong rounded-t-3xl md:rounded-3xl w-full md:max-w-2xl max-h-[96vh] md:max-h-[92vh] overflow-hidden animate-slide-up md:animate-slide-in shadow-2xl shadow-black/50">
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
              <div className="flex gap-2">
                {(['long', 'short', 'be'] as const).map(dir => {
                  const activeClass = dir === 'long'
                    ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400'
                    : dir === 'short'
                      ? 'bg-red-500/15 border-red-500/25 text-red-400'
                      : 'bg-slate-500/15 border-slate-500/25 text-slate-300';
                  const label = dir === 'be' ? t('common.be') : dir === 'long' ? t('common.long') : t('common.short');
                  return (
                    <button key={dir} onClick={() => setForm(f => ({
                      ...f,
                      direction: dir,
                      ...(dir === 'be' ? { rMultiple: '0' } : {}),
                    }))}
                      className={cn('flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border',
                        form.direction === dir
                          ? activeClass
                          : 'bg-white/[0.03] border-white/[0.06] text-slate-500 hover:text-slate-300'
                      )}>{label}</button>
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
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setForm(f => ({ ...f, setupQuality: n }))} className="focus:outline-none">
                  <Star className={cn('w-7 h-7 transition-all', n <= form.setupQuality ? 'text-amber-400 fill-amber-400' : 'text-slate-700 hover:text-slate-500')} />
                </button>
              ))}
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
            <div className="flex flex-wrap gap-2 mb-2">
              {userConfluences.map(c => (
                <div key={c} className="flex items-center gap-1 group">
                  <button onClick={() => toggleConfluence(c)}
                    className={cn('px-3 py-1.5 rounded-xl text-xs font-medium transition-all border',
                      form.confluences.includes(c) ? 'bg-blue-500/15 border-blue-500/25 text-blue-400' : 'bg-white/[0.03] border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-slate-600'
                    )}>{c}</button>
                  <button onClick={() => removeConfluence(c)}
                    className="w-4 h-4 rounded-full flex items-center justify-center text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newConfluence} onChange={e => setNewConfluence(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addConfluence())}
                placeholder={t('trade.addConfluencePlaceholder')} className={cn(inputClass, 'flex-1 py-2 text-xs')} />
              <button onClick={addConfluence} className="px-3 rounded-xl border border-white/[0.08] text-blue-400 hover:bg-blue-500/10 transition-all">
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
              {form.screenshots.map((src, i) => (
                <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-white/[0.08] group">
                  <img src={src} alt={`Screenshot ${i + 1}`} className="w-full h-full object-cover" />
                  <button onClick={() => removeScreenshot(i)} className="absolute top-1 right-1 w-5 h-5 bg-red-500/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3 text-white" /></button>
                </div>
              ))}
              {form.screenshots.length < 3 && (
                <label className="w-24 h-24 rounded-xl border-2 border-dashed border-white/[0.08] flex flex-col items-center justify-center cursor-pointer hover:border-blue-500/30 hover:bg-blue-500/[0.03] transition-all">
                  {uploading ? <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /> : (<><ImagePlus className="w-5 h-5 text-slate-600" /><span className="text-[10px] text-slate-600 mt-1">{t('trade.upload')}</span></>)}
                  <input type="file" accept="image/*" multiple onChange={e => handleScreenshotUpload(e.target.files)} className="hidden" />
                </label>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelClass}>{t('trade.notes')}</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder={t('trade.notesPlaceholder')} className={cn(inputClass, 'resize-none')} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 md:gap-3 px-4 md:px-6 py-3 md:py-4 border-t border-white/[0.06]">
          <button onClick={onClose} className="px-4 md:px-5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors">{t('common.cancel')}</button>
          <button onClick={handleSave} disabled={!isValid}
            className={cn('px-6 py-2.5 rounded-xl text-sm font-bold transition-all',
              isValid ? 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            )}>{trade ? t('trade.updateTrade') : t('trade.saveTrade')}</button>
        </div>
      </div>
    </div>
  );
}
