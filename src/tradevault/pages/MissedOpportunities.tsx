import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Target, Trash2, Pencil, X, Save, ImagePlus, Loader2, ChevronDown, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { MissedOpportunity } from '../types';
import {
  loadMissedOpportunities,
  upsertMissedOpportunity,
  deleteMissedOpportunity,
  generateId,
  uploadMissedScreenshot,
  getScreenshotUrl,
  deleteScreenshot,
} from '../store';
import { formatShortDate } from '../utils/tradeCalcs';
import { cn } from '../utils/cn';
import { useT } from '../i18n/LanguageContext';

function emptyMissed(): MissedOpportunity {
  return {
    id: generateId(),
    date: new Date().toISOString().slice(0, 10),
    symbol: '',
    reasonNotTaken: '',
    whatHappened: '',
    lessonLearned: '',
    nextTimePlan: '',
    estimatedR: 0,
    screenshots: [],
  };
}

export default function MissedOpportunities() {
  const { user } = useAuth();
  const { t } = useT();
  const [items, setItems] = useState<MissedOpportunity[]>([]);
  const [editing, setEditing] = useState<MissedOpportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const toggleOpen = useCallback((id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const exportCsv = useCallback(() => {
    if (items.length === 0) return;
    const headers = ['Date','Symbol','Estimated R','Reason Not Taken','What Happened','Lesson Learned','Next Time Plan','Screenshots'];
    const escape = (v: string | number) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = items.map((m) => [
      m.date, m.symbol, m.estimatedR,
      m.reasonNotTaken, m.whatHappened, m.lessonLearned, m.nextTimePlan,
      (m.screenshots ?? []).length,
    ].map(escape).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `missed-setups-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }, [items]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    loadMissedOpportunities(user.id)
      .then((d) => { if (active) setItems(d); })
      .catch((e) => console.error(e))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.id]);

  const handleSave = useCallback(async (m: MissedOpportunity) => {
    if (!user) return;
    try {
      const clean: MissedOpportunity = { ...m, screenshots: m.screenshots ?? [] };
      await upsertMissedOpportunity(user.id, clean);
      setItems((prev) => {
        const exists = prev.find((x) => x.id === clean.id);
        return exists ? prev.map((x) => (x.id === clean.id ? clean : x)) : [clean, ...prev];
      });
      setEditing(null);
    } catch (e) {
      console.error(e);
      alert(t('missed.saveFailed'));
    }
  }, [user, t]);

  const handleDelete = useCallback(async (id: string) => {
    if (!user) return;
    if (!confirm(t('missed.confirmDelete'))) return;
    const target = items.find((x) => x.id === id);
    // Best-effort cleanup of orphaned screenshots in storage
    if (target?.screenshots?.length) {
      await Promise.all(target.screenshots.map((p) => deleteScreenshot(p).catch(() => {})));
    }
    await deleteMissedOpportunity(user.id, id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, [user, t, items]);

  return (
    <div className="p-4 md:p-8 max-w-[1100px] mx-auto">
      <div className="flex items-center justify-between gap-2 mb-4 md:mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-400" />
            <h1 className="text-lg md:text-2xl font-bold text-white">{t('missed.title')}</h1>
          </div>
          <p className="text-[11px] md:text-sm text-slate-500 mt-0.5">{t('missed.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <button
              onClick={exportCsv}
              className="flex items-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-200 px-3 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-semibold transition"
              title={t('missed.exportCsv')}
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{t('missed.exportCsv')}</span>
            </button>
          )}
          <button
            onClick={() => setEditing(emptyMissed())}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 md:px-5 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-bold shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">{t('missed.log')}</span><span className="sm:hidden">{t('missed.logShort')}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="glass rounded-2xl p-10 text-center text-slate-500 text-sm">{t('common.loading')}</div>
      ) : items.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center">
          <Target className="w-8 h-8 text-amber-400/50 mx-auto mb-3" />
          <p className="text-slate-300 text-sm font-semibold mb-1">{t('missed.empty.title')}</p>
          <p className="text-slate-500 text-xs">{t('missed.empty.sub')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((m) => {
            const open = openIds.has(m.id);
            return (
              <div key={m.id} className="glass rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleOpen(m.id)}
                  className="w-full flex items-center justify-between gap-3 p-3 md:p-4 text-left hover:bg-white/[0.02] transition"
                  aria-expanded={open}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <ChevronDown className={cn('w-4 h-4 text-slate-500 transition-transform shrink-0', open && 'rotate-180')} />
                    <span className="text-sm font-bold text-white">{m.symbol || '—'}</span>
                    <span className="text-[10px] text-slate-500">{formatShortDate(m.date)}</span>
                    {m.estimatedR > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold">
                        +{m.estimatedR.toFixed(1)} {t('missed.rMissed')}
                      </span>
                    )}
                    {m.screenshots && m.screenshots.length > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.05] text-slate-400 font-semibold">
                        {m.screenshots.length}📷
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setEditing(m)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-blue-400 hover:bg-blue-500/10">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(m.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </button>
                {open && (
                  <div className="px-4 md:px-5 pb-4 md:pb-5 pt-1 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs md:text-sm">
                      <Field label={t('missed.card.why')} value={m.reasonNotTaken} tone="red" />
                      <Field label={t('missed.card.what')} value={m.whatHappened} tone="amber" />
                      <Field label={t('missed.card.lesson')} value={m.lessonLearned} tone="blue" />
                      <Field label={t('missed.card.next')} value={m.nextTimePlan} tone="emerald" />
                    </div>
                    {m.screenshots && m.screenshots.length > 0 && (
                      <div className="mt-3">
                        <ScreenshotsView paths={m.screenshots} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <MissedEditor
          value={editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function Field({ label, value, tone }: { label: string; value: string; tone: 'red' | 'amber' | 'blue' | 'emerald' }) {
  const tones: Record<string, string> = {
    red: 'text-red-400 border-red-500/15',
    amber: 'text-amber-400 border-amber-500/15',
    blue: 'text-blue-400 border-blue-500/15',
    emerald: 'text-emerald-400 border-emerald-500/15',
  };
  return (
    <div className={cn('rounded-xl bg-white/[0.02] border p-2.5', tones[tone])}>
      <div className="text-[10px] uppercase tracking-wider font-bold mb-1 opacity-80">{label}</div>
      <div className="text-slate-200 text-xs md:text-sm whitespace-pre-wrap">{value || <span className="text-slate-600 italic">—</span>}</div>
    </div>
  );
}

function ScreenshotsView({ paths, onRemove }: { paths: string[]; onRemove?: (p: string) => void }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const missing = paths.filter((p) => !urls[p]);
    if (missing.length === 0) return;
    Promise.all(
      missing.map(async (p) => {
        try { return [p, await getScreenshotUrl(p)] as const; }
        catch { return [p, ''] as const; }
      })
    ).then((res) => {
      if (cancelled) return;
      setUrls((prev) => {
        const next = { ...prev };
        for (const [p, u] of res) next[p] = u;
        return next;
      });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths.join('|')]);

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {paths.map((p) => (
          <div key={p} className="relative group aspect-video rounded-xl overflow-hidden bg-white/[0.04] border border-white/[0.08]">
            {urls[p] ? (
              <button type="button" onClick={() => setLightbox(urls[p])} className="block w-full h-full">
                <img src={urls[p]} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
              </button>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(p)}
                className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/70 hover:bg-red-500/80 text-white flex items-center justify-center backdrop-blur"
                aria-label="Remove"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      {lightbox && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-xl shadow-2xl" />
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </>
  );
}

function MissedEditor({ value, onClose, onSave }: { value: MissedOpportunity; onClose: () => void; onSave: (m: MissedOpportunity) => void }) {
  const { user } = useAuth();
  const { t } = useT();
  const [m, setM] = useState<MissedOpportunity>(value);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof MissedOpportunity>(k: K, v: MissedOpportunity[K]) => setM((p) => ({ ...p, [k]: v }));

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || !user) return;
    const current = m.screenshots ?? [];
    const slots = 3 - current.length;
    if (slots <= 0) { alert(t('missed.maxImages')); return; }
    const picks = Array.from(files).slice(0, slots);
    for (const f of picks) {
      if (f.size > 8 * 1024 * 1024) { alert(t('missed.imageTooLarge')); continue; }
    }
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const f of picks) {
        if (f.size > 8 * 1024 * 1024) continue;
        const path = await uploadMissedScreenshot(user.id, f);
        uploaded.push(path);
      }
      setM((prev) => ({ ...prev, screenshots: [...(prev.screenshots ?? []), ...uploaded] }));
    } catch (e) {
      console.error(e);
      alert(t('missed.uploadFailed'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [user, m.screenshots, t]);

  const removeShot = useCallback((path: string) => {
    setM((prev) => ({ ...prev, screenshots: (prev.screenshots ?? []).filter((p) => p !== path) }));
    deleteScreenshot(path).catch(() => {});
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full md:max-w-2xl bg-[#0a0f1e] md:rounded-3xl rounded-t-3xl border border-white/10 max-h-[92vh] overflow-y-auto animate-slide-up">
        <div className="sticky top-0 bg-[#0a0f1e]/95 backdrop-blur-lg flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-base font-bold text-white flex items-center gap-2"><Target className="w-4 h-4 text-amber-400" /> {t('missed.modalTitle')}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white/[0.05]"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <FieldInput label={t('missed.field.date')} type="date" value={m.date} onChange={(v) => set('date', v)} />
            <FieldInput label={t('missed.field.symbol')} value={m.symbol} onChange={(v) => set('symbol', v.toUpperCase())} placeholder="ES" />
            <FieldInput label={t('missed.field.estR')} type="number" value={String(m.estimatedR)} onChange={(v) => set('estimatedR', Number(v) || 0)} step="0.1" />
          </div>
          <FieldArea label={t('missed.field.why')} value={m.reasonNotTaken} onChange={(v) => set('reasonNotTaken', v)} placeholder={t('missed.field.whyPh')} />
          <FieldArea label={t('missed.field.what')} value={m.whatHappened} onChange={(v) => set('whatHappened', v)} placeholder={t('missed.field.whatPh')} />
          <FieldArea label={t('missed.field.lesson')} value={m.lessonLearned} onChange={(v) => set('lessonLearned', v)} placeholder={t('missed.field.lessonPh')} />
          <FieldArea label={t('missed.field.next')} value={m.nextTimePlan} onChange={(v) => set('nextTimePlan', v)} placeholder={t('missed.field.nextPh')} />

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{t('missed.field.screenshots')} <span className="text-slate-700">({(m.screenshots ?? []).length}/3)</span></span>
              <span className="text-[10px] text-slate-600">{t('missed.field.screenshotsHint')}</span>
            </div>
            <ScreenshotsView paths={m.screenshots ?? []} onRemove={removeShot} />
            {(m.screenshots ?? []).length < 3 && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] hover:bg-white/[0.05] text-sm text-slate-300 hover:text-white transition disabled:opacity-50"
                >
                  {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('missed.uploading')}</> : <><ImagePlus className="w-4 h-4" /> {t('missed.addImage')}</>}
                </button>
              </>
            )}
          </div>
        </div>
        <div className="sticky bottom-0 bg-[#0a0f1e]/95 backdrop-blur-lg flex justify-end gap-2 px-5 py-4 border-t border-white/[0.06]">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 bg-white/[0.04] hover:bg-white/[0.08]">{t('common.cancel')}</button>
          <button onClick={() => onSave(m)} disabled={uploading} className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30 disabled:opacity-50"><Save className="w-4 h-4" /> {t('common.save')}</button>
        </div>
      </div>
    </div>
  );
}

function FieldInput({ label, value, onChange, type = 'text', placeholder, step }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; step?: string }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block mb-1">{label}</span>
      <input
        type={type}
        value={value}
        step={step}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/40"
      />
    </label>
  );
}

function FieldArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block mb-1">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white resize-y min-h-[56px] focus:outline-none focus:border-amber-500/40"
      />
    </label>
  );
}