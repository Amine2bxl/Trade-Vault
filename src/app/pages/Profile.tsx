import { useAuth } from "../contexts/AuthContext";
import { Trade, SUPPORT_EMAIL, type Page } from "../types";
import { computeStats, formatPnl, formatPct } from "../utils/tradeCalcs";
import {
  LogOut,
  Mail,
  RotateCcw,
  Target,
  TrendingUp,
  Hash,
  MessageSquare,
  Handshake,
  Lightbulb,
  ChevronRight,
  CreditCard,
  SlidersHorizontal,
  Palette,
  ClipboardList,
} from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import type { TKey } from "../i18n/translations";
import { Button, Card, Metric, PageContainer } from "@/shared/ui";

interface ProfileProps {
  trades: Trade[];
  /** Profile is the account hub — it needs to be able to hand off. */
  setPage?: (p: Page) => void;
}

/**
 * Profile — who the trader is, and the way into everything about their account.
 *
 * The page used to be a dead end: an avatar, three numbers, three mailto links
 * and a sign-out button. It is now the hub it should be — identity, the record
 * so far, and one tap to each account surface (subscription, settings,
 * appearance, trading plan) — built entirely on the design system so it carries
 * the same density and surfaces as the rest of the product.
 */
export default function Profile({ trades, setPage }: ProfileProps) {
  const { user, logout } = useAuth();
  const { t } = useT();
  const stats = computeStats(trades);

  if (!user) return null;

  const links: { icon: typeof CreditCard; label: TKey; page: Page }[] = [
    { icon: CreditCard, label: "nav.subscription", page: "subscription" },
    { icon: SlidersHorizontal, label: "settings.title", page: "settings" },
    { icon: Palette, label: "nav.appearance", page: "appearance" },
    { icon: ClipboardList, label: "nav.tradingPlan", page: "tradingplan" },
  ];

  return (
    <PageContainer className="max-w-2xl space-y-3">
      {/* Identity */}
      <div className="relative overflow-hidden rounded-3xl border border-cyan-500/15 bg-[linear-gradient(160deg,rgba(14,58,82,.45),rgba(7,14,24,.9)_60%)] p-5 sm:p-6 animate-fade-in-up">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
        <div className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="absolute -inset-1 rounded-2xl bg-cyan-500/40 blur-lg opacity-60" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 text-xl font-bold text-white shadow-lg shadow-cyan-500/25">
              {user.name.charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="font-display truncate text-xl font-extrabold tracking-tight text-white">
              {user.name}
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-slate-400">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              {user.email}
            </p>
          </div>
        </div>
      </div>

      {/* The record so far — the design system's KPI tile, not a bespoke one. */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <Metric
          title={t("stats.totalPnl")}
          value={formatPnl(stats.totalPnl)}
          trend={stats.totalPnl >= 0 ? "up" : "down"}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <Metric
          title={t("stats.trades")}
          value={String(stats.totalTrades)}
          icon={<Hash className="h-4 w-4" />}
        />
        <Metric
          title={t("stats.winRate")}
          value={formatPct(stats.winRate)}
          icon={<Target className="h-4 w-4" />}
        />
      </div>

      {/* Account surfaces. Profile is where a trader looks for "my account",
          so every account page is one tap from here instead of buried in the
          sidebar's lower half. */}
      {setPage && (
        <Card pad="tight" className="divide-y divide-white/[0.05] p-0!">
          {links.map(({ icon: Icon, label, page }) => (
            <button
              key={page}
              onClick={() => setPage(page)}
              className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex-1 text-sm font-semibold text-white">{t(label)}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </Card>
      )}

      {/* Contact / Support */}
      <Card variant="glass-strong" pad="default" className="space-y-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {t("profile.getInTouch")}
        </h2>
        <ContactLink
          icon={<MessageSquare className="h-4 w-4" />}
          label={t("profile.support")}
          sub={t("profile.supportSub")}
          subject="TradeVault — Support request"
        />
        <ContactLink
          icon={<Handshake className="h-4 w-4" />}
          label={t("profile.collab")}
          sub={t("profile.collabSub")}
          subject="TradeVault — Collab inquiry"
        />
        <ContactLink
          icon={<Lightbulb className="h-4 w-4" />}
          label={t("profile.improvements")}
          sub={t("profile.improvementsSub")}
          subject="TradeVault — Improvement idea"
        />
      </Card>

      <Button variant="subtle" onClick={logout} className="w-full justify-between">
        <span>{t("common.signOut")}</span>
        <LogOut className="h-4 w-4" />
      </Button>
      <button
        onClick={async () => {
          try {
            // @ts-expect-error — supabase client via global for simplicity
            const { supabase } = await import("@/integrations/supabase/client");
            await supabase.from("profiles").update({ onboarded_at: null }).eq("id", user?.id);
            window.location.reload();
          } catch {}
        }}
        className="w-full mt-3 flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition text-xs text-slate-500"
      >
        <span>{t("profile.redoOnboarding")}</span>
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </PageContainer>
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
      className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:bg-white/[0.05]"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-white">{label}</span>
        <span className="block truncate text-[11px] text-slate-500">{sub}</span>
      </span>
      <Mail className="h-4 w-4 shrink-0 text-slate-600 transition-colors group-hover:text-slate-400" />
    </a>
  );
}
