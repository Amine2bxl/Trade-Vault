import { useMemo } from 'react';
import { AlertTriangle, TrendingDown, AlertCircle, Lightbulb, CheckCircle2, ShieldCheck, Target } from 'lucide-react';
import { Trade } from '../types';
import { formatPnl } from '../utils/tradeCalcs';
import { computeBehavioral, Severity } from '../utils/behavioral';
import { cn } from '../utils/cn';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ComposedChart, Line } from 'recharts';
import { useT } from '../i18n/LanguageContext';
import { CHART_ANIMATION, tooltipStyle, glowActiveDot } from '../utils/chartTheme';

interface MistakesProps { trades: Trade[]; embedded?: boolean; }

// Mistake names are stored data (fixed English presets); their coaching tips
// live in the i18n dicts so the advice follows the app language.
const MISTAKE_TIP_KEYS: Record<string, string> = {
  'No stop loss': 'mistakes.tipNoStop',
  'Overtrading': 'mistakes.tipOvertrading',
  'Revenge trade': 'mistakes.tipRevenge',
  'FOMO entry': 'mistakes.tipFomo',
  'Premature exit': 'mistakes.tipPrematureExit',
  'Holding too long': 'mistakes.tipHolding',
  'Size too large': 'mistakes.tipSize',
  'Ignored plan': 'mistakes.tipIgnoredPlan',
  'Chased entry': 'mistakes.tipChased',
  'Averaged down': 'mistakes.tipAveraged',
  'Ignored market conditions': 'mistakes.tipConditions',
  'Low liquidity': 'mistakes.tipLiquidity',
};

const SEV_STYLE: Record<Severity, { text: string; bg: string; bar: string; dot: string }> = {
  high: { text: 'text-red-400', bg: 'bg-red-500/10 border-red-500/25', bar: 'bg-red-500/60', dot: 'bg-red-400' },
  medium: { text: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/25', bar: 'bg-amber-500/60', dot: 'bg-amber-400' },
  low: { text: 'text-slate-300', bg: 'bg-slate-500/10 border-slate-500/25', bar: 'bg-slate-400/50', dot: 'bg-slate-400' },
};

export default function Mistakes({ trades, embedded = false }: MistakesProps) {
  const { t, lang } = useT();
  const locale = ({ en: 'en-US', es: 'es-ES', pt: 'pt-PT', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', nl: 'nl-NL', ru: 'ru-RU', zh: 'zh-CN', ja: 'ja-JP', ar: 'ar-SA', hi: 'hi-IN' } as Record<string, string>)[lang] || 'en-US';
  const DAY_NAMES = useMemo(() => Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2023, 0, 1 + i))), [locale]);

  const b = useMemo(() => computeBehavioral(trades), [trades]);
  const topMistakes = b.rows.slice(0, 3);

  const dayData = useMemo(() => Array.from({ length: 5 }, (_, i) => i + 1).map(d => ({ day: DAY_NAMES[d], count: b.byDay[d] || 0 })), [b.byDay, DAY_NAMES]);
  const sessionData = useMemo(() => (['london', 'newyork', 'asia'] as const).map(s => ({ session: t(`session.${s}` as never), count: b.bySession[s] })), [b.bySession, t]);
  const maxSessionCount = Math.max(...sessionData.map(s => s.count), 1);
  const severityTotal = b.severityCounts.high + b.severityCounts.medium + b.severityCounts.low;

  if (trades.length === 0) {
    if (embedded) return null;
    return (<div className="p-4 md:p-8"><h1 className="text-xl md:text-2xl font-bold text-white mb-2">{t('mistakes.title')}</h1><div className="glass rounded-2xl p-10 text-center text-slate-600">{t('mistakes.noTrades')}</div></div>);
  }

  // Discipline dial color
  const disc = b.disciplineScore;
  const discColor = disc >= 80 ? 'text-emerald-400' : disc >= 60 ? 'text-cyan-400' : disc >= 40 ? 'text-amber-400' : 'text-red-400';
  const discStroke = disc >= 80 ? '#10b981' : disc >= 60 ? 'var(--tv-accent)' : disc >= 40 ? '#f59e0b' : '#ef4444';
  const R = 34, C = 2 * Math.PI * R;

  return (
    <div className={cn(embedded ? 'pt-2' : 'p-4 md:p-8 max-w-[1400px] mx-auto')}>
      <div className="mb-4 md:mb-6 animate-fade-in-up stagger-0"><h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">{t('mistakes.title')}</h1><p className="text-xs md:text-sm text-slate-500 mt-1">{t('mistakes.subtitle')}</p></div>

      <div className="space-y-4 md:space-y-6">
        {/* ── Discipline score + summary KPIs ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Discipline dial */}
          <div className="glass rounded-2xl p-4 md:p-5 card-premium animate-fade-in-up stagger-1 flex items-center gap-4">
            <div className="relative shrink-0" style={{ width: 84, height: 84 }}>
              <svg width="84" height="84" viewBox="0 0 84 84" className="-rotate-90">
                <circle cx="42" cy="42" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
                <circle cx="42" cy="42" r={R} fill="none" stroke={discStroke} strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={C * (1 - disc / 100)}
                  style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1)', filter: `drop-shadow(0 0 5px ${discStroke})` }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn('text-xl font-bold tabular-nums', discColor)}>{disc}</span>
                <span className="text-[8px] text-slate-500 uppercase tracking-wider">/ 100</span>
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5"><ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /><span className="text-xs font-bold text-white">{t('mistakes.discipline')}</span></div>
              <p className="text-[10px] text-slate-500 leading-snug">{t('mistakes.disciplineSub')}</p>
              <div className="mt-1.5 text-[10px] text-slate-400">{b.cleanTrades}/{trades.length} {t('mistakes.cleanSuffix')}</div>
            </div>
          </div>

          {/* KPIs (2×2) */}
          <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
            {[
              { icon: <AlertTriangle className="w-3.5 h-3.5 text-red-400" />, label: t('mistakes.totalMistakes'), value: String(b.totalIncidents), sub: `${b.tradesWithMistakes} ${t('mistakes.tradesSuffix')}`, color: 'text-white' },
              { icon: <TrendingDown className="w-3.5 h-3.5 text-red-400" />, label: t('mistakes.totalCost'), value: formatPnl(b.totalCost), sub: `${t('mistakes.avgPrefix')} ${formatPnl(b.totalIncidents > 0 ? b.totalCost / b.totalIncidents : 0)}`, color: 'text-red-400' },
              { icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />, label: t('mistakes.cleanWr'), value: b.cleanWinRate !== null ? `${(b.cleanWinRate * 100).toFixed(0)}%` : '—', sub: t('mistakes.cleanSuffix'), color: 'text-emerald-400' },
              { icon: <AlertCircle className="w-3.5 h-3.5 text-amber-400" />, label: t('mistakes.mistakeWr'), value: b.mistakeWinRate !== null ? `${(b.mistakeWinRate * 100).toFixed(0)}%` : '—', sub: t('mistakes.mistakeSuffix'), color: 'text-amber-400' },
            ].map((card, i) => (
              <div key={i} className="glass rounded-xl p-3 card-premium animate-fade-in-up" style={{ animationDelay: `${(i + 1) * 60}ms` }}>
                <div className="flex items-center gap-1.5 mb-1">{card.icon}<span className="text-[9px] text-slate-500 truncate">{card.label}</span></div>
                <div className={cn('text-base md:text-lg font-bold leading-none', card.color)}>{card.value}</div>
                <div className="text-[9px] text-slate-600 mt-1 truncate">{card.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Clean vs mistake edge callout */}
        {b.cleanWinRate !== null && b.mistakeWinRate !== null && (
          <div className="glass rounded-2xl p-3.5 md:p-4 card-premium animate-fade-in-up stagger-2 flex items-center gap-3 text-xs">
            <Target className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-slate-400">
              {t('mistakes.edgePrefix')} <span className="font-bold text-emerald-400">{((b.cleanWinRate - b.mistakeWinRate) * 100).toFixed(0)} {t('mistakes.edgePoints')}</span> {t('mistakes.edgeSuffix')}
            </span>
          </div>
        )}

        {/* ── Behavioral breakdown: severity + cost ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {/* Severity distribution */}
          <div className="glass rounded-2xl p-4 md:p-5 card-premium animate-fade-in-up stagger-3">
            <h3 className="text-sm font-semibold text-white mb-3">{t('mistakes.severity')}</h3>
            {severityTotal > 0 ? (
              <div className="space-y-3">
                {(['high', 'medium', 'low'] as Severity[]).map(sev => {
                  const cnt = b.severityCounts[sev];
                  return (
                    <div key={sev}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn('flex items-center gap-1.5 text-xs font-semibold', SEV_STYLE[sev].text)}>
                          <span className={cn('w-1.5 h-1.5 rounded-full', SEV_STYLE[sev].dot)} />{t(`mistakes.sev_${sev}` as never)}
                        </span>
                        <span className="text-xs font-bold text-slate-400 tabular-nums">{cnt}</span>
                      </div>
                      <div className="w-full bg-white/[0.05] rounded-full h-1.5 overflow-hidden">
                        <div className={cn('h-full rounded-full', SEV_STYLE[sev].bar)} style={{ width: `${(cnt / severityTotal) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
                <p className="text-[10px] text-slate-600 pt-1">{t('mistakes.severityHint')}</p>
              </div>
            ) : (<div className="h-32 flex items-center justify-center text-slate-600 text-sm text-center"><div><CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />{t('mistakes.noMistakesShort')}</div></div>)}
          </div>

          {/* Cost per mistake type */}
          <div className="md:col-span-2 glass rounded-2xl p-4 md:p-5 card-premium animate-fade-in-up stagger-4">
            <h3 className="text-sm font-semibold text-white mb-3">{t('mistakes.costAnalysis')}</h3>
            {b.rows.length > 0 ? (
              <div className="h-56 md:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...b.rows].sort((x, y) => x.totalPnl - y.totalPnl)} layout="vertical">
                    <XAxis type="number" tick={{ fill: '#475569', fontSize: 10 }} tickFormatter={(v) => `$${v}`} axisLine={false} tickLine={false} />
                    <YAxis dataKey="mistake" type="category" tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false} width={104} />
                    <Tooltip {...tooltipStyle} formatter={((value: any) => [`$${Number(value).toFixed(2)}`])} />
                    <Bar dataKey="totalPnl" radius={[0, 4, 4, 0]} {...CHART_ANIMATION}>{[...b.rows].sort((x, y) => x.totalPnl - y.totalPnl).map((e, i) => <Cell key={i} fill={e.totalPnl >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.7} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (<div className="h-40 flex items-center justify-center text-slate-600 text-sm"><div className="text-center"><CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />{t('mistakes.noMistakesShort')}</div></div>)}
          </div>
        </div>

        {/* ── When mistakes happen: weekly trend + session + day ── */}
        {b.totalIncidents > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* Weekly trend */}
            <div className="glass rounded-2xl p-4 md:p-5 card-premium animate-fade-in-up stagger-5">
              <h3 className="text-sm font-semibold text-white mb-1">{t('mistakes.weeklyTrend')}</h3>
              <p className="text-[10px] text-slate-600 mb-3">{t('mistakes.weeklyTrendSub')}</p>
              {b.weeklyTrend.length > 0 ? (
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={b.weeklyTrend}>
                      <XAxis dataKey="week" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
                      <Tooltip {...tooltipStyle} formatter={((value: any, name: any) => [name === 'count' ? `${value}` : `$${Number(value).toFixed(2)}`, name === 'count' ? t('mistakes.incidents') : t('mistakes.totalCost')])} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#f59e0b" fillOpacity={0.5} {...CHART_ANIMATION} />
                      <Line type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 2, strokeWidth: 0 }} activeDot={glowActiveDot('#f59e0b')} {...CHART_ANIMATION} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : <div className="h-40 flex items-center justify-center text-slate-600 text-sm">—</div>}
            </div>

            {/* Session + day distribution */}
            <div className="glass rounded-2xl p-4 md:p-5 card-premium animate-fade-in-up stagger-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white mb-2">{t('mistakes.bySession')}</h3>
                <div className="space-y-2">
                  {sessionData.map(s => (
                    <div key={s.session} className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 w-16 shrink-0">{s.session}</span>
                      <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden"><div className="h-full rounded-full bg-amber-500/50" style={{ width: `${(s.count / maxSessionCount) * 100}%` }} /></div>
                      <span className="text-[10px] font-bold text-slate-400 w-6 text-right tabular-nums">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-2">{t('mistakes.byDay')}</h3>
                <div className="h-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dayData}>
                      <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis hide allowDecimals={false} />
                      <Tooltip {...tooltipStyle} formatter={((value: any) => [`${value}`, t('mistakes.incidents')])} />
                      <Bar dataKey="count" radius={[3, 3, 0, 0]} fill="#f59e0b" fillOpacity={0.5} {...CHART_ANIMATION} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Personalized recommendations + progression goal ── */}
        <div className="glass rounded-2xl p-4 md:p-5 card-premium animate-fade-in-up stagger-7">
          <div className="flex items-center gap-2 mb-3 md:mb-4"><Lightbulb className="w-4 h-4 text-amber-400" /><h3 className="text-sm font-semibold text-white">{t('mistakes.improvementTips')}</h3></div>
          {topMistakes.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                {topMistakes.map((m, idx) => (
                  <div key={m.mistake} className={cn('rounded-xl md:rounded-2xl p-3 md:p-4 border card-premium', idx === 0 ? SEV_STYLE[m.severity].bg : 'bg-white/[0.03] border-white/[0.06]')}>
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      {idx === 0 && <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-red-500/20 text-red-400">{t('mistakes.priority')}</span>}
                      <span className={cn('text-[8px] font-bold px-1 py-0.5 rounded uppercase', SEV_STYLE[m.severity].bg, SEV_STYLE[m.severity].text)}>{t(`mistakes.sev_${m.severity}` as never)}</span>
                      <span className={cn('text-[10px] md:text-xs font-bold', SEV_STYLE[m.severity].text)}>{m.mistake}</span>
                    </div>
                    <p className="text-[10px] md:text-xs text-slate-400 leading-relaxed">{MISTAKE_TIP_KEYS[m.mistake] ? t(MISTAKE_TIP_KEYS[m.mistake] as never) : t('mistakes.defaultTip')}</p>
                    <div className="mt-1.5 text-[9px] text-slate-600"><span className="font-bold text-slate-400">{m.count}×</span> · <span className={cn('font-bold', m.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>{formatPnl(m.totalPnl)}</span></div>
                  </div>
                ))}
              </div>
              {/* Progression goal */}
              <div className="mt-4 flex items-start gap-3 rounded-xl bg-cyan-500/[0.06] border border-cyan-500/15 p-3.5">
                <Target className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300 leading-relaxed">
                  <span className="font-bold text-cyan-300">{t('mistakes.goal')}: </span>
                  {t('mistakes.goalIntro')} <span className="font-bold text-white">{topMistakes[0].mistake}</span> {t('mistakes.goalMid')} <span className="font-bold text-emerald-400">{Math.min(100, disc + 10)}/100</span> {t('mistakes.goalEnd')}
                </div>
              </div>
            </>
          ) : <div className="text-center py-6 text-slate-500 text-sm"><CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-2" />{t('mistakes.noMistakesGreat')}</div>}
        </div>
      </div>
    </div>
  );
}
