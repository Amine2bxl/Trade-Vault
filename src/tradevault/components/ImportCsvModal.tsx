import { useMemo, useRef, useState } from 'react';
import { X, Upload, FileSpreadsheet, Check, Loader2 } from 'lucide-react';
import { Trade } from '../types';
import { generateId } from '../store';
import { formatPnl } from '../utils/tradeCalcs';
import { cn } from '../utils/cn';
import { useT } from '../i18n/LanguageContext';

interface ImportCsvModalProps {
  existing: Trade[];
  onClose: () => void;
  onImport: (trades: Trade[]) => Promise<number>;
}

// ── CSV parsing ─────────────────────────────────────────────────────────────
function detectDelimiter(firstLine: string): string {
  const counts: [string, number][] = [',', ';', '\t'].map(d => [d, firstLine.split(d).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const clean = text.replace(/^﻿/, '');
  const delim = detectDelimiter(clean.split(/\r?\n/, 1)[0] ?? '');
  const rows: string[][] = [];
  let cur: string[] = [], field = '', inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delim) { cur.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++;
      cur.push(field); field = '';
      if (cur.some(f => f.trim() !== '')) rows.push(cur);
      cur = [];
    } else field += c;
  }
  if (field !== '' || cur.length > 0) { cur.push(field); if (cur.some(f => f.trim() !== '')) rows.push(cur); }
  if (rows.length === 0) return { headers: [], rows: [] };
  return { headers: rows[0].map(h => h.trim()), rows: rows.slice(1) };
}

// ── Value normalization ─────────────────────────────────────────────────────
function parseMoney(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  s = s.replace(/[$€£\s]/g, '');
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); // 1.234,56
  else if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.'); // 12,5
  else s = s.replace(/,/g, ''); // 1,234.56
  const n = parseFloat(s);
  if (Number.isNaN(n)) return null;
  return negative ? -Math.abs(n) : n;
}

function parseDateTime(raw: string): { date: string; time: string } | null {
  const s = raw.trim();
  if (!s) return null;
  // ISO / YYYY-MM-DD [HH:MM]
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (m) return { date: `${m[1]}-${m[2]}-${m[3]}`, time: m[4] ? `${m[4]}:${m[5]}` : '' };
  // MM/DD/YYYY [HH:MM[:SS] [AM/PM]] (US default for broker exports)
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)?)?/);
  if (m) {
    let hh = m[4] ? parseInt(m[4], 10) : 0;
    const ampm = m[6]?.toUpperCase();
    if (ampm === 'PM' && hh < 12) hh += 12;
    if (ampm === 'AM' && hh === 12) hh = 0;
    return {
      date: `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`,
      time: m[4] ? `${String(hh).padStart(2, '0')}:${m[5]}` : '',
    };
  }
  return null;
}

function parseDirection(raw: string): 'long' | 'short' | null {
  const s = raw.trim().toLowerCase();
  if (['long', 'buy', 'bot', 'b', 'l'].includes(s)) return 'long';
  if (['short', 'sell', 'sld', 's', 'sellshort'].includes(s)) return 'short';
  return null;
}

// ── Column auto-mapping ─────────────────────────────────────────────────────
type Field = 'date' | 'symbol' | 'direction' | 'pnl' | 'risk' | 'rMultiple' | 'entryTime' | 'exitTime' | 'strategy' | 'slippage' | 'notes';
const FIELDS: Field[] = ['date', 'symbol', 'pnl', 'direction', 'entryTime', 'exitTime', 'risk', 'rMultiple', 'strategy', 'slippage', 'notes'];
const REQUIRED: Field[] = ['date', 'symbol', 'pnl'];

// Header keywords per field, checked in order — covers TradeVault, NinjaTrader,
// TradingView and TopStep(X) export headers plus generic names.
const GUESSES: Record<Field, string[]> = {
  date: ['date', 'enteredat', 'entry time', 'entrytime', 'date/time', 'datetime', 'time', 'opened'],
  symbol: ['symbol', 'instrument', 'contractname', 'contract', 'ticker', 'market'],
  direction: ['direction', 'side', 'market pos', 'marketpos', 'type', 'position'],
  pnl: ['p&l', 'pnl', 'profit', 'net profit', 'netprofit', 'realized', 'gain'],
  risk: ['risk'],
  rMultiple: ['r multiple', 'rmultiple', 'r-multiple', 'r:r'],
  entryTime: ['entry time', 'entrytime', 'enteredat', 'open time', 'opened'],
  exitTime: ['exit time', 'exittime', 'exitedat', 'close time', 'closed'],
  strategy: ['strategy', 'setup', 'signal'],
  slippage: ['slippage', 'fees', 'commission'],
  notes: ['notes', 'comment', 'description'],
};

function guessMapping(headers: string[]): Partial<Record<Field, number>> {
  const mapping: Partial<Record<Field, number>> = {};
  const used = new Set<number>();
  for (const field of FIELDS) {
    const lower = headers.map(h => h.toLowerCase());
    for (const kw of GUESSES[field]) {
      const idx = lower.findIndex((h, i) => !used.has(i) && h.includes(kw));
      if (idx !== -1) { mapping[field] = idx; used.add(idx); break; }
    }
  }
  return mapping;
}

function detectFormat(headers: string[]): string | null {
  const h = headers.map(x => x.toLowerCase()).join('|');
  if (h.includes('market pos') || (h.includes('instrument') && h.includes('cum.'))) return 'NinjaTrader';
  if (h.includes('contractname') || (h.includes('enteredat') && h.includes('exitedat'))) return 'TopStep';
  if (h.includes('signal') && h.includes('contracts')) return 'TradingView';
  if (h.includes('setup quality') && h.includes('confluences')) return 'TradeVault';
  return null;
}

export default function ImportCsvModal({ existing, onClose, onImport }: ImportCsvModalProps) {
  const { t } = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<{ headers: string[]; rows: string[][]; format: string | null } | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<Field, number>>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; duplicates: number; invalid: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const { headers, rows } = parseCsv(text);
    if (headers.length === 0) return;
    setParsed({ headers, rows, format: detectFormat(headers) });
    setMapping(guessMapping(headers));
    setResult(null);
  };

  const mappedTrades = useMemo(() => {
    if (!parsed) return { valid: [] as Trade[], invalid: 0 };
    const get = (row: string[], f: Field) => (mapping[f] !== undefined ? (row[mapping[f]!] ?? '').trim() : '');
    const valid: Trade[] = [];
    let invalid = 0;
    for (const row of parsed.rows) {
      const dt = parseDateTime(get(row, 'date'));
      const symbol = get(row, 'symbol').toUpperCase().slice(0, 20);
      const pnl = parseMoney(get(row, 'pnl'));
      if (!dt || !symbol || pnl === null) { invalid++; continue; }
      const entryDt = parseDateTime(get(row, 'entryTime'));
      const exitDt = parseDateTime(get(row, 'exitTime'));
      const risk = parseMoney(get(row, 'risk'));
      const rRaw = parseMoney(get(row, 'rMultiple'));
      const slippage = parseMoney(get(row, 'slippage'));
      const riskAmount = risk !== null && risk > 0 ? risk : 0;
      valid.push({
        id: generateId(),
        date: dt.date,
        symbol,
        direction: parseDirection(get(row, 'direction')) ?? 'long',
        pnl: Math.round(pnl * 100) / 100,
        riskAmount,
        rMultiple: rRaw !== null ? rRaw : riskAmount > 0 ? Math.round((pnl / riskAmount) * 100) / 100 : 0,
        strategy: get(row, 'strategy').slice(0, 50) || 'Other',
        mistakes: [],
        setupQuality: 3,
        notes: get(row, 'notes').slice(0, 10000),
        screenshots: [],
        entryTime: entryDt?.time || dt.time || '',
        exitTime: exitDt?.time || '',
        confluences: [],
        confidence: 50,
        mae: null, mfe: null,
        slippage: slippage !== null ? slippage : null,
      });
    }
    return { valid, invalid };
  }, [parsed, mapping]);

  const doImport = async () => {
    if (mappedTrades.valid.length === 0) return;
    setImporting(true);
    // Dedupe against existing journal entries on (date, symbol, pnl, entryTime)
    const sig = (tr: Pick<Trade, 'date' | 'symbol' | 'pnl' | 'entryTime'>) => `${tr.date}|${tr.symbol}|${tr.pnl}|${tr.entryTime}`;
    const known = new Set(existing.map(sig));
    const fresh: Trade[] = [];
    let duplicates = 0;
    for (const tr of mappedTrades.valid) {
      const s = sig(tr);
      if (known.has(s)) { duplicates++; continue; }
      known.add(s);
      fresh.push(tr);
    }
    const imported = fresh.length > 0 ? await onImport(fresh) : 0;
    setResult({ imported, duplicates, invalid: mappedTrades.invalid });
    setImporting(false);
  };

  const canImport = REQUIRED.every(f => mapping[f] !== undefined) && mappedTrades.valid.length > 0;
  const selectClass = 'w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/40 cursor-pointer';

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-strong rounded-t-3xl md:rounded-3xl w-full md:max-w-2xl max-h-[96vh] md:max-h-[90vh] overflow-hidden animate-slide-up md:animate-slide-in shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2"><Upload className="w-4 h-4 text-cyan-400" />{t('import.title')}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-70px)] px-6 py-5 space-y-5">
          {result ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4"><Check className="w-7 h-7 text-emerald-400" /></div>
              <div className="text-xl font-bold text-white mb-1">{result.imported} {t('import.imported')}</div>
              <div className="text-xs text-slate-500">
                {result.duplicates > 0 && <span>{result.duplicates} {t('import.duplicatesSkipped')} · </span>}
                {result.invalid > 0 && <span>{result.invalid} {t('import.invalidSkipped')}</span>}
              </div>
              <button onClick={onClose} className="mt-6 px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-teal-500 text-white">{t('common.close')}</button>
            </div>
          ) : !parsed ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
              onClick={() => fileRef.current?.click()}
              className={cn('rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all',
                dragOver ? 'border-cyan-500/50 bg-cyan-500/[0.05]' : 'border-white/[0.08] hover:border-cyan-500/30 hover:bg-cyan-500/[0.02]')}
            >
              <FileSpreadsheet className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <div className="text-sm font-semibold text-white mb-1">{t('import.dropHint')}</div>
              <div className="text-[11px] text-slate-500">NinjaTrader · TradingView · TopStep · TradeVault · CSV</div>
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={e => handleFile(e.target.files?.[0])} className="hidden" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-xs text-slate-400">
                  {parsed.rows.length} {t('import.rowsDetected')}
                  {parsed.format && <span className="ml-2 px-2 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-400 text-[10px] font-bold">{parsed.format}</span>}
                </div>
                <button onClick={() => { setParsed(null); setMapping({}); }} className="text-[11px] text-slate-500 hover:text-white transition-colors">{t('import.otherFile')}</button>
              </div>

              {/* Column mapping */}
              <div>
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('import.mapColumns')}</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                  {FIELDS.map(f => (
                    <div key={f}>
                      <label className="block text-[10px] text-slate-500 mb-1">
                        {f === 'date' ? t('trade.date') : f === 'symbol' ? t('trade.symbol') : f === 'pnl' ? t('journal.colPnl')
                          : f === 'direction' ? t('trade.direction') : f === 'entryTime' ? t('trade.entryTime') : f === 'exitTime' ? t('trade.exitTime')
                          : f === 'risk' ? t('trade.riskAmount') : f === 'rMultiple' ? t('trade.rrMultiple') : f === 'strategy' ? t('trade.strategy')
                          : f === 'slippage' ? t('trade.slippage') : t('trade.notes')}
                        {REQUIRED.includes(f) && <span className="text-red-400"> *</span>}
                      </label>
                      <select
                        value={mapping[f] ?? ''}
                        onChange={e => setMapping(m => ({ ...m, [f]: e.target.value === '' ? undefined : Number(e.target.value) }))}
                        className={selectClass}
                      >
                        <option value="">—</option>
                        {parsed.headers.map((h, i) => <option key={i} value={i}>{h || `(col ${i + 1})`}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div>
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  {t('import.preview')} · {mappedTrades.valid.length} {t('import.validRows')}{mappedTrades.invalid > 0 ? ` · ${mappedTrades.invalid} ${t('import.invalidSkipped')}` : ''}
                </div>
                <div className="rounded-xl border border-white/[0.06] overflow-hidden divide-y divide-white/[0.04]">
                  {mappedTrades.valid.slice(0, 5).map((tr, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 text-xs">
                      <span className="text-slate-500 w-20 shrink-0">{tr.date}</span>
                      <span className="font-bold text-white w-16 truncate">{tr.symbol}</span>
                      <span className="text-slate-500 uppercase text-[10px]">{tr.direction}</span>
                      {tr.entryTime && <span className="text-slate-600 text-[10px]">{tr.entryTime}</span>}
                      <span className={cn('ml-auto font-bold tabular-nums', tr.pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>{formatPnl(tr.pnl)}</span>
                    </div>
                  ))}
                  {mappedTrades.valid.length === 0 && <div className="px-3 py-6 text-center text-xs text-slate-600">{t('import.noValidRows')}</div>}
                </div>
              </div>

              <button
                onClick={doImport}
                disabled={!canImport || importing}
                className={cn('w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2',
                  canImport && !importing ? 'bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white shadow-lg shadow-cyan-500/20' : 'bg-slate-800 text-slate-500 cursor-not-allowed')}
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {t('import.importBtn')} ({mappedTrades.valid.length})
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
