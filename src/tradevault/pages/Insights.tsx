import { useState } from 'react';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Trade } from '../types';
import { askTradingInsight } from '@/lib/ai-insights.functions';
import { cn } from '../utils/cn';
import { useT } from '../i18n/LanguageContext';

interface InsightsProps { trades: Trade[]; }

export default function Insights({ trades }: InsightsProps) {
  const { t, lang } = useT();
  const QUICK_PROMPTS = [
    { label: t('insights.quick.winLoss'), q: 'Analyze my win/loss patterns. What separates my winning trades from my losing ones?' },
    { label: t('insights.quick.days'), q: 'Which days of the week are my best and worst performing? Why?' },
    { label: t('insights.quick.symbols'), q: 'Break down my performance by symbol. Which should I focus on or avoid?' },
    { label: t('insights.quick.improvements'), q: 'What are my biggest weaknesses and the top 3 concrete improvements I should make?' },
  ];
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ask = async (q: string) => {
    const query = q.trim();
    if (!query || loading) return;
    setLoading(true);
    setError('');
    setAnswer('');
    try {
      const tradesPayload = trades.slice(0, 200).map(t => ({
        date: t.date, symbol: t.symbol, direction: t.direction, pnl: t.pnl,
        rMultiple: t.rMultiple, strategy: t.strategy, mistakes: t.mistakes,
        setupQuality: t.setupQuality, confluences: t.confluences,
      }));
      const res = await askTradingInsight({ data: { question: query, trades: tradesPayload, language: lang } });
      setAnswer(res.answer || 'No response.');
    } catch (e: any) {
      setError(e?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-4 md:mb-6 animate-fade-in-up stagger-0 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">{t('insights.title')}</h1>
          <p className="text-xs md:text-sm text-slate-500">{t('insights.subtitle')}</p>
        </div>
      </div>

      <div className="glass-strong rounded-2xl p-4 md:p-5 space-y-4">
        <div>
          <label className="text-sm font-semibold text-white block mb-2">{t('insights.askLabel')}</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') ask(question); }}
              placeholder={t('insights.placeholder')}
              disabled={loading}
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 transition-all disabled:opacity-50"
            />
            <button
              onClick={() => ask(question)}
              disabled={loading || !question.trim()}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 md:px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span className="hidden md:inline">{t('insights.analyze')}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map(p => (
            <button
              key={p.label}
              onClick={() => { setQuestion(p.q); ask(p.q); }}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs md:text-sm text-slate-300 hover:bg-white/[0.08] hover:border-blue-500/30 hover:text-white transition-all disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className={cn(
          'rounded-xl border p-4 min-h-[140px] text-sm',
          error ? 'border-red-500/20 bg-red-500/5 text-red-300'
                : answer ? 'border-white/[0.08] bg-white/[0.02] text-slate-200'
                : 'border-white/[0.06] bg-white/[0.02] text-slate-500'
        )}>
          {loading ? (
            <div className="flex items-center gap-2 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> {t('insights.analyzing')}</div>
          ) : error ? error
            : answer ? (
              <div className="insights-md space-y-3 leading-relaxed">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h2: ({ children }) => (
                      <h2 className="text-base md:text-lg font-bold text-white mt-4 first:mt-0 pb-1.5 border-b border-white/[0.06] flex items-center gap-2">{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-sm font-semibold text-white mt-3">{children}</h3>
                    ),
                    p: ({ children }) => <p className="text-slate-300">{children}</p>,
                    strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                    em: ({ children }) => <em className="text-blue-300 not-italic font-medium">{children}</em>,
                    ul: ({ children }) => <ul className="space-y-1.5 ml-1">{children}</ul>,
                    ol: ({ children }) => <ol className="space-y-1.5 ml-5 list-decimal marker:text-blue-400 marker:font-bold">{children}</ol>,
                    li: ({ children, ...props }) => {
                      const ordered = (props as any).ordered;
                      if (ordered) return <li className="text-slate-300 pl-1">{children}</li>;
                      return (
                        <li className="flex gap-2 text-slate-300">
                          <span className="text-blue-400 mt-1.5 shrink-0 w-1 h-1 rounded-full bg-blue-400" />
                          <span className="flex-1">{children}</span>
                        </li>
                      );
                    },
                    table: ({ children }) => (
                      <div className="overflow-x-auto rounded-lg border border-white/[0.08] my-2">
                        <table className="w-full text-xs md:text-sm">{children}</table>
                      </div>
                    ),
                    thead: ({ children }) => <thead className="bg-white/[0.04]">{children}</thead>,
                    th: ({ children }) => <th className="text-left px-3 py-2 font-semibold text-white border-b border-white/[0.08]">{children}</th>,
                    td: ({ children }) => <td className="px-3 py-2 text-slate-300 border-b border-white/[0.04] last:border-0">{children}</td>,
                    code: ({ children }) => (
                      <code className="px-1.5 py-0.5 rounded bg-white/[0.06] text-blue-300 text-[0.85em] font-mono">{children}</code>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-2 border-blue-500/60 pl-3 py-1 bg-blue-500/5 rounded-r text-slate-200 italic">{children}</blockquote>
                    ),
                    hr: () => <hr className="border-white/[0.06] my-3" />,
                  }}
                >
                  {answer}
                </ReactMarkdown>
              </div>
            )
            : t('insights.empty')}
        </div>

        {trades.length === 0 && !loading && !answer && (
          <p className="text-[11px] text-slate-600">{t('insights.tip')}</p>
        )}
      </div>
    </div>
  );
}