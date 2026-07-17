import { useState } from 'react';
import { BookOpen, Check, Plus, Save, Trash2 } from 'lucide-react';
import type { TradingPlan } from '../types';
import { saveTradingPlan } from '../store';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../utils/cn';

export default function TradingPlanPage({ plan, onPlanChange }: { plan: TradingPlan; onPlanChange: (plan: TradingPlan) => void }) {
  const { user } = useAuth();
  const [draft, setDraft] = useState(plan);
  const [saved, setSaved] = useState(false);
  const update = (patch: Partial<TradingPlan>) => setDraft((current) => ({ ...current, ...patch }));
  const save = async () => { onPlanChange(draft); if (user) await saveTradingPlan(user.id, draft); setSaved(true); window.setTimeout(() => setSaved(false), 1800); };
  const addRule = () => update({ rules: [...draft.rules, ''] });
  const removeRule = (index: number) => update({ rules: draft.rules.filter((_, i) => i !== index) });
  const updateRule = (index: number, value: string) => update({ rules: draft.rules.map((rule, i) => i === index ? value : rule) });
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">TradeVault / Plan</p><h1 className="mt-2 text-3xl font-bold text-white">Trading Plan</h1><p className="mt-2 text-sm text-slate-400">Write the rules you want to follow before the market opens.</p></div><button onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300"><Save className="h-4 w-4" />{saved ? 'Saved' : 'Save plan'}</button></div>
      <section className="glass-strong rounded-3xl p-5 md:p-6 space-y-5"><div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-cyan-300" /><h2 className="text-sm font-bold uppercase tracking-wider text-white">Core plan</h2></div><label className="block"><span className="text-xs font-semibold text-slate-400">Plan name</span><input value={draft.name} onChange={(event) => update({ name: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white" /></label><div className="grid gap-4 md:grid-cols-2"><TextArea label="Market thesis" value={draft.marketThesis} onChange={(value) => update({ marketThesis: value })} /><TextArea label="Risk rules" value={draft.riskRules} onChange={(value) => update({ riskRules: value })} /></div></section>
      <section className="glass-strong rounded-3xl p-5 md:p-6"><div className="flex items-center justify-between"><div><h2 className="text-sm font-bold uppercase tracking-wider text-white">Execution rules</h2><p className="mt-1 text-xs text-slate-500">One rule per line. Keep them visible and measurable.</p></div><button onClick={addRule} className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.05] px-3 py-2 text-xs font-semibold text-cyan-200"><Plus className="h-3.5 w-3.5" />Add rule</button></div><div className="mt-4 space-y-2">{draft.rules.map((rule, index) => <div key={index} className="flex items-center gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-xs text-slate-500">{index + 1}</span><input value={rule} onChange={(event) => updateRule(index, event.target.value)} placeholder="e.g. I only enter after a confirmed retest" className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white placeholder:text-slate-600" /><button onClick={() => removeRule(index)} className="text-slate-600 hover:text-red-300" aria-label="Remove rule"><Trash2 className="h-4 w-4" /></button></div>)}</div></section>
      <section className="glass-strong rounded-3xl p-5 md:p-6"><h2 className="text-sm font-bold uppercase tracking-wider text-white">Pre-session checklist</h2><div className="mt-4 grid gap-2 md:grid-cols-2">{draft.checklist.map((item, index) => <label key={index} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><input type="checkbox" className="h-4 w-4 accent-cyan-400" /><span className="text-sm text-slate-300">{item}</span><Check className="ml-auto h-4 w-4 text-cyan-300/40" /></label>)}</div></section>
    </div>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block"><span className="text-xs font-semibold text-slate-400">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} rows={5} className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white" /></label>; }
