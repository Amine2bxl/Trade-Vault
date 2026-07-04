import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, X, Send, Loader2, Mic, MicOff } from 'lucide-react';
import { Trade } from '../types';
import { toInsightTradesPayload } from '../utils/tradeCalcs';
import { askTradingInsight } from '@/lib/ai-insights.functions';
import { cn } from '../utils/cn';
import { useT } from '../i18n/LanguageContext';
import MarkdownAnswer from './MarkdownAnswer';

interface AiAssistantProps { trades: Trade[]; }

interface ChatMessage {
  role: 'user' | 'assistant' | 'error';
  text: string;
}

// Minimal typing for the Web Speech API — not in lib.dom.d.ts, and we only need
// the handful of members this component touches.
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: any) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export default function AiAssistant({ trades }: AiAssistantProps) {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const SpeechRecognitionCtor = getSpeechRecognition();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const ask = useCallback(async (q: string) => {
    const query = q.trim();
    if (!query || loading) return;
    setMessages((prev) => [...prev, { role: 'user', text: query }]);
    setQuestion('');
    setLoading(true);
    try {
      const res = await askTradingInsight({ data: { question: query, trades: toInsightTradesPayload(trades), language: lang } });
      setMessages((prev) => [...prev, { role: 'assistant', text: res.answer || 'No response.' }]);
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: 'error', text: e?.message || 'Something went wrong.' }]);
    } finally {
      setLoading(false);
    }
  }, [loading, trades, lang]);

  const toggleMic = useCallback(() => {
    if (!SpeechRecognitionCtor) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (e: any) => {
      const transcript = e.results?.[0]?.[0]?.transcript;
      if (transcript) setQuestion((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [SpeechRecognitionCtor, listening, lang]);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? t('assistant.close') : t('assistant.open')}
        className="fixed z-40 bottom-20 right-4 md:bottom-6 md:right-6 w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 hover:scale-105 active:scale-95 transition-transform animate-glow"
      >
        {open ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
      </button>

      {open && (
        <div className="fixed z-40 bottom-36 right-4 left-4 md:left-auto md:bottom-24 md:right-6 md:w-[380px] h-[65vh] md:h-[600px] max-h-[calc(100vh-180px)] glass-strong rounded-3xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06] bg-gradient-to-b from-blue-500/[0.06] to-transparent shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-white">{t('assistant.title')}</h3>
              <p className="text-[11px] text-slate-500 truncate">{t('assistant.subtitle')}</p>
            </div>
            <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-sm text-slate-500 leading-relaxed">{t('assistant.empty')}</div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                    m.role === 'user' && 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-medium',
                    m.role === 'assistant' && 'bg-white/[0.04] border border-white/[0.08] text-slate-200',
                    m.role === 'error' && 'bg-red-500/10 border border-red-500/20 text-red-300'
                  )}
                >
                  {m.role === 'assistant' ? <MarkdownAnswer content={m.text} /> : m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('assistant.thinking')}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-white/[0.06] shrink-0">
            {listening && (
              <div className="flex items-center gap-1.5 text-[11px] text-blue-400 font-semibold mb-2 px-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" /> {t('assistant.listening')}
              </div>
            )}
            <div className="flex items-center gap-2">
              {SpeechRecognitionCtor && (
                <button
                  type="button"
                  onClick={toggleMic}
                  aria-label="Voice input"
                  className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                    listening ? 'bg-red-500/15 text-red-400' : 'bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08]'
                  )}
                >
                  {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') ask(question); }}
                placeholder={t('assistant.placeholder')}
                disabled={loading}
                className="flex-1 min-w-0 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 transition-all disabled:opacity-50"
              />
              <button
                onClick={() => ask(question)}
                disabled={loading || !question.trim()}
                aria-label="Send"
                className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white shrink-0 transition-all"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
