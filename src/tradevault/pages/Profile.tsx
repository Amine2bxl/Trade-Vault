import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Trade, LANGUAGES, SUPPORT_EMAIL } from '../types';
import { computeStats, formatPnl, formatPct } from '../utils/tradeCalcs';
import {
  loadLanguage,
  saveLanguage,
  loadStartingBalance,
  saveStartingBalance,
} from '../store';
import { LogOut, Mail, User as UserIcon, TrendingUp, Hash, Trash2, Globe, DollarSign, MessageSquare, Handshake, Lightbulb, Check } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';
import { PushNotificationSettings } from '../components/PushNotificationSettings';

interface ProfileProps {
  trades: Trade[];
  onDeleteAll: () => void;
}

export default function Profile({ trades, onDeleteAll }: ProfileProps) {
  const { user, logout } = useAuth();
  const { t, setLang } = useT();
  const stats = computeStats(trades);
  const [language, setLanguage] = useState('en');
  const [startingEquity, setStartingEquity] = useState('25000');
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadLanguage(user.id).then(setLanguage).catch(() => {});
    loadStartingBalance(user.id).then((v) => setStartingEquity(String(v))).catch(() => {});
  }, [user?.id]);

  const flash = (k: string) => { setSavedFlash(k); setTimeout(() => setSavedFlash(null), 1500); };

  const handleLanguage = async (val: string) => {
    if (!user) return;
    setLanguage(val);
    setLang(val as never);
    try { await saveLanguage(user.id, val); flash('lang'); } catch (e) { console.error(e); }
  };

  const handleEquityBlur = async () => {
    if (!user) return;
    const n = Number(startingEquity);
    if (!Number.isFinite(n) || n < 0) return;
    try { await saveStartingBalance(user.id, n); flash('eq'); } catch (e) { console.error(e); }
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <div className="relative glass-strong rounded-3xl p-6 sm:p-8 overflow-hidden">
        <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-2xl bg-blue-500/40 blur-lg opacity-70" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-blue-500/20">
              {user.name.charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">{user.name}</h1>
            <p className="text-sm text-slate-400 truncate flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{user.email}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat icon={<TrendingUp className="w-4 h-4" />} label={t('stats.totalPnl')} value={formatPnl(stats.totalPnl)} accent={stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        <Stat icon={<Hash className="w-4 h-4" />} label={t('stats.trades')} value={String(stats.totalTrades)} accent="text-white" />
        <Stat icon={<UserIcon className="w-4 h-4" />} label={t('stats.winRate')} value={formatPct(stats.winRate)} accent="text-blue-400" />
      </div>

      {/* Preferences */}
      <div className="glass-strong rounded-3xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">{t('profile.preferences')}</h2>

        <label className="block">
          <span className="flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">
            <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> {t('profile.language')}</span>
            {savedFlash === 'lang' && <span className="flex items-center gap-1 text-emerald-400 normal-case tracking-normal"><Check className="w-3 h-3" /> {t('common.saved')}</span>}
          </span>
          <select
            value={language}
            onChange={(e) => handleLanguage(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/40"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code} className="bg-[#0a0f1e]">{l.label}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">
            <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> {t('profile.startingEquity')}</span>
            {savedFlash === 'eq' && <span className="flex items-center gap-1 text-emerald-400 normal-case tracking-normal"><Check className="w-3 h-3" /> {t('common.saved')}</span>}
          </span>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
            <input
              type="number"
              inputMode="decimal"
              value={startingEquity}
              onChange={(e) => setStartingEquity(e.target.value)}
              onBlur={handleEquityBlur}
              min={0}
              step={100}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-7 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/40"
            />
          </div>
          <p className="text-[10px] text-slate-600 mt-1.5">{t('profile.startingEquityHint')}</p>
        </label>
      </div>

      {/* Contact / Support */}
      <div className="glass-strong rounded-3xl p-6 space-y-3">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">{t('profile.getInTouch')}</h2>
        <ContactLink icon={<MessageSquare className="w-4 h-4" />} label={t('profile.support')} sub={t('profile.supportSub')} subject="TradeVault — Support request" />
        <ContactLink icon={<Handshake className="w-4 h-4" />} label={t('profile.collab')} sub={t('profile.collabSub')} subject="TradeVault — Collab inquiry" />
        <ContactLink icon={<Lightbulb className="w-4 h-4" />} label={t('profile.improvements')} sub={t('profile.improvementsSub')} subject="TradeVault — Improvement idea" />
      </div>

      <PushNotificationSettings />

      <div className="glass-strong rounded-3xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">{t('profile.account')}</h2>
        <button
          onClick={onDeleteAll}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15 transition"
        >
          <span className="text-sm font-medium">{t('profile.deleteAllTrades')}</span>
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          onClick={logout}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-200 hover:bg-white/[0.06] transition"
        >
          <span className="text-sm font-medium">{t('common.signOut')}</span>
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="glass rounded-2xl p-2.5 md:p-4 min-w-0">
      <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 md:mb-2 truncate">{icon}{label}</div>
      <div className={`text-sm md:text-base font-bold truncate ${accent}`}>{value}</div>
    </div>
  );
}

function ContactLink({ icon, label, sub, subject }: { icon: React.ReactNode; label: string; sub: string; subject: string }) {
  const href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
  return (
    <a
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition"
    >
      <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white">{label}</div>
        <div className="text-[11px] text-slate-500 truncate">{sub} · {SUPPORT_EMAIL}</div>
      </div>
      <Mail className="w-4 h-4 text-slate-500" />
    </a>
  );
}