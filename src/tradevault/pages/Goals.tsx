import { useMemo, useState } from 'react';
import { Check, Plus, Target, Trash2 } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';
import { saveGoals } from '../store';
import type { GoalConfig, GoalTask, Trade } from '../types';
import { buildGoalTasks, DEFAULT_GOALS } from '../planning';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../utils/cn';

type Props = { trades: Trade[]; goals: GoalConfig[]; onGoalsChange: (goals: GoalConfig[]) => void };

export default function Goals({ goals, onGoalsChange }: Props) {
  const { user } = useAuth();
  const { t } = useT();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [customTitle, setCustomTitle] = useState('');
  const [customTarget, setCustomTarget] = useState('');
  const selected = goals.filter((goal) => goal.selected);
  const tasks = useMemo(() => buildGoalTasks(goals, month), [goals, month]);

  const persist = async (next: GoalConfig[]) => {
    onGoalsChange(next);
    if (user) await saveGoals(user.id, next);
  };
  const toggle = (id: string) => persist(goals.map((goal) => goal.id === id ? { ...goal, selected: !goal.selected } : goal));
  const addGoal = () => {
    const title = customTitle.trim();
    if (!title) return;
    const id = `custom-${Date.now()}`;
    persist([...goals, { id, title, description: 'Custom objective', target: customTarget.trim() || 'Define a measurable next step', selected: true, custom: true }]);
    setCustomTitle(''); setCustomTarget('');
  };
  const removeCustom = (id: string) => persist(goals.filter((goal) => goal.id !== id));
  const reset = () => persist(DEFAULT_GOALS);
  const completed = new Set<string>();
  const toggleTask = (id: string) => {
    if (completed.has(id)) completed.delete(id); else completed.add(id);
    onGoalsChange(goals);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">TradeVault / Goals</p>
          <h1 className="mt-2 text-3xl md:text-4xl font-bold text-white">{t('nav.goals')}</h1>
          <p className="mt-2 text-sm text-slate-400">Choose several objectives. TradeVault turns the combination into one focused monthly action plan.</p>
        </div>
        <label className="text-xs text-slate-500">Month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="mt-1 block rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white" /></label>
      </div>
      <section className="grid gap-4 md:grid-cols-[1.35fr_.65fr]">
        <div className="glass-strong rounded-3xl p-5 md:p-6">
          <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-bold uppercase tracking-wider text-white">Your objectives</h2><span className="text-xs text-slate-500">{selected.length} selected</span></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {goals.map((goal) => (
              <div key={goal.id} className={cn('rounded-2xl border p-4 transition-all', goal.selected ? 'border-cyan-400/50 bg-cyan-400/[0.08]' : 'border-white/[0.08] bg-white/[0.025]')}>
                <button onClick={() => toggle(goal.id)} className="flex w-full items-start gap-3 text-left">
                  <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border', goal.selected ? 'border-cyan-300 bg-cyan-300 text-slate-950' : 'border-white/20 text-transparent')}><Check className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-white">{goal.title}</span><span className="mt-1 block text-xs leading-relaxed text-slate-400">{goal.description}</span></span>
                </button>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3"><span className="text-[11px] text-cyan-200/80">Target: {goal.target}</span>{goal.custom && <button onClick={() => removeCustom(goal.id)} className="text-slate-500 hover:text-red-300" aria-label="Remove goal"><Trash2 className="h-3.5 w-3.5" /></button>}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl border border-dashed border-cyan-300/25 bg-cyan-300/[0.03] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-white"><Plus className="h-4 w-4 text-cyan-300" />Add a custom objective</div><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><input value={customTitle} onChange={(event) => setCustomTitle(event.target.value)} placeholder="Objective name" className="h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white placeholder:text-slate-600" /><input value={customTarget} onChange={(event) => setCustomTarget(event.target.value)} placeholder="How will you measure it?" className="h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white placeholder:text-slate-600" /><button onClick={addGoal} className="h-10 rounded-xl bg-cyan-400 px-4 text-sm font-bold text-slate-950 hover:bg-cyan-300">Add</button></div></div>
          <button onClick={reset} className="mt-4 text-xs text-slate-500 underline decoration-white/20 underline-offset-4 hover:text-white">Reset default objectives</button>
        </div>
        <div className="glass-strong rounded-3xl p-5 md:p-6"><div className="flex items-center gap-2"><Target className="h-4 w-4 text-cyan-300" /><h2 className="text-sm font-bold uppercase tracking-wider text-white">Plan generated</h2></div><p className="mt-2 text-sm text-slate-400">Each selected objective creates a small set of actions for {new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(`${month}-15`))}.</p><div className="mt-5 space-y-2">{selected.length ? selected.map((goal) => <div key={goal.id} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><div className="text-xs font-semibold text-white">{goal.title}</div><div className="mt-1 text-[11px] text-slate-500">{goal.target}</div></div>) : <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-500">Select at least one objective to generate your plan.</div>}</div></div>
      </section>
      <section className="glass-strong rounded-3xl p-5 md:p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold uppercase tracking-wider text-white">Monthly actions</h2><p className="mt-1 text-xs text-slate-500">Generated from every selected objective.</p></div><span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">{tasks.length} actions</span></div><div className="mt-4 grid gap-2 md:grid-cols-2">{tasks.map((task: GoalTask) => <div key={task.id} className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3"><span className="mt-0.5 h-5 w-5 rounded-md border border-white/15" /><div><div className="text-sm text-slate-200">{task.title}</div><div className="mt-1 text-xs text-slate-500">{task.detail}</div></div></div>)}</div></section>
    </div>
  );
}
