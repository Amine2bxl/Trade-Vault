import { useAuth } from "../contexts/AuthContext";
import { Trade, SUPPORT_EMAIL } from "../types";
import { computeStats, formatPnl, formatPct } from "../utils/tradeCalcs";
import {
  LogOut,
  Mail,
  User as UserIcon,
  TrendingUp,
  Hash,
  MessageSquare,
  Handshake,
  Lightbulb,
} from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import ThemeSettings from "../components/ThemeSettings";
import SubscriptionSection from "../components/SubscriptionSection";
import TradingRulesSection from "../components/TradingRulesSection";

interface ProfileProps {
  trades: Trade[];
}

export default function Profile({ trades }: ProfileProps) {
  const { user, logout } = useAuth();
  const { t } = useT();
  const stats = computeStats(trades);

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <div className="relative glass-strong rounded-3xl p-6 sm:p-8 overflow-hidden">
        <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-2xl bg-cyan-500/40 blur-lg opacity-70" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-cyan-500/20">
              {user.name.charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">{user.name}</h1>
            <p className="text-sm text-slate-400 truncate flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              {user.email}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat
          icon={<TrendingUp className="w-4 h-4" />}
          label={t("stats.totalPnl")}
          value={formatPnl(stats.totalPnl)}
          accent={stats.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}
        />
        <Stat
          icon={<Hash className="w-4 h-4" />}
          label={t("stats.trades")}
          value={String(stats.totalTrades)}
          accent="text-white"
        />
        <Stat
          icon={<UserIcon className="w-4 h-4" />}
          label={t("stats.winRate")}
          value={formatPct(stats.winRate)}
          accent="text-cyan-400"
        />
      </div>

      {/* Subscription management — upgrade, card change, cancel */}
      <SubscriptionSection />

      {/* Personal trading rules — checked on every trade save (anti-bias push) */}
      <TradingRulesSection />

      {/* Appearance / themes */}
      <ThemeSettings />

      {/* Contact / Support */}
      <div className="glass-strong rounded-3xl p-6 space-y-3">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
          {t("profile.getInTouch")}
        </h2>
        <ContactLink
          icon={<MessageSquare className="w-4 h-4" />}
          label={t("profile.support")}
          sub={t("profile.supportSub")}
          subject="TradeVault — Support request"
        />
        <ContactLink
          icon={<Handshake className="w-4 h-4" />}
          label={t("profile.collab")}
          sub={t("profile.collabSub")}
          subject="TradeVault — Collab inquiry"
        />
        <ContactLink
          icon={<Lightbulb className="w-4 h-4" />}
          label={t("profile.improvements")}
          sub={t("profile.improvementsSub")}
          subject="TradeVault — Improvement idea"
        />
      </div>

      <div className="glass-strong rounded-3xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
          {t("profile.account")}
        </h2>
        <button
          onClick={logout}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-200 hover:bg-white/[0.06] transition"
        >
          <span className="text-sm font-medium">{t("common.signOut")}</span>
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="glass rounded-2xl p-2.5 md:p-4 min-w-0">
      <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 md:mb-2 truncate">
        {icon}
        {label}
      </div>
      <div className={`text-sm md:text-base font-bold truncate ${accent}`}>{value}</div>
    </div>
  );
}

function ContactLink({
  icon,
  label,
  sub,
  subject,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  subject: string;
}) {
  const href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
  return (
    <a
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition"
    >
      <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white">{label}</div>
        <div className="text-[11px] text-slate-500 truncate">
          {sub} · {SUPPORT_EMAIL}
        </div>
      </div>
      <Mail className="w-4 h-4 text-slate-500" />
    </a>
  );
}
