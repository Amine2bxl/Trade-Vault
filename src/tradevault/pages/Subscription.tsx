import { useCallback } from "react";
import { Check, Sparkles, Shield, Zap, Crown, Clock } from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";

// Subscription — VISUAL PLACEHOLDER ONLY. No Stripe, no checkout, no billing
// logic on purpose: this page previews the future plans while payments keep
// living where they already work. Do not wire payment calls here.

export default function Subscription() {
  const { lang } = useT();
  const fr = lang === "fr";
  const tr = useCallback((f: string, e: string) => (fr ? f : e), [fr]);

  const features = [
    {
      icon: Sparkles,
      title: tr("Coach IA illimité", "Unlimited AI coach"),
      sub: tr("Analyses et débriefs sans limite", "Unlimited analysis and debriefs"),
    },
    {
      icon: Zap,
      title: tr("Rapports mensuels IA", "AI monthly reports"),
      sub: tr("Synthèse automatique chaque mois", "Automatic synthesis every month"),
    },
    {
      icon: Shield,
      title: tr("Comptes illimités", "Unlimited accounts"),
      sub: tr("Prop firms, démo, réel — tout séparé", "Prop firms, demo, live — all separate"),
    },
  ];

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-5">
      <div className="mb-1 animate-fade-in-up">
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
          {tr("Abonnement", "Subscription")}
        </h1>
        <p className="text-xs md:text-sm text-slate-500 mt-1">
          {tr("Aperçu des formules TradeVault Pro.", "Preview of the TradeVault Pro plans.")}
        </p>
      </div>

      {/* Hero */}
      <div className="relative glass-strong rounded-3xl p-6 md:p-8 overflow-hidden animate-fade-in-up stagger-1">
        <div className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 shrink-0">
            <Crown className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">TradeVault Pro</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {tr(
                "Tout TradeVault, sans limite — pensé pour les traders sérieux.",
                "All of TradeVault, unlimited — built for serious traders.",
              )}
            </p>
          </div>
        </div>
        <div className="relative grid md:grid-cols-3 gap-2.5 mt-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-3.5"
            >
              <f.icon className="w-4.5 h-4.5 text-cyan-400 mb-2" />
              <div className="text-xs font-bold text-white">{f.title}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{f.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Plans (visual only) */}
      <div className="grid sm:grid-cols-2 gap-3.5">
        <PlanCard
          highlight
          delay={2}
          badge={tr("Meilleure offre", "Best value")}
          title={tr("Pro Annuel", "Pro Yearly")}
          price="239 €"
          per={tr("/ an", "/ year")}
          note={tr("Soit 19,92 €/mois — 2 mois offerts", "That's €19.92/mo — 2 months free")}
          cta={tr("Bientôt disponible ici", "Coming soon here")}
          items={[
            tr("Trades illimités", "Unlimited trades"),
            tr("Coach IA + Insights", "AI coach + Insights"),
            tr("Rapports mensuels IA", "AI monthly reports"),
            tr("Multi-comptes", "Multi-account"),
          ]}
        />
        <PlanCard
          delay={3}
          title={tr("Pro Mensuel", "Pro Monthly")}
          price="24,99 €"
          per={tr("/ mois", "/ month")}
          note={tr("Sans engagement, annulable à tout moment", "No commitment, cancel anytime")}
          cta={tr("Bientôt disponible ici", "Coming soon here")}
          items={[
            tr("Trades illimités", "Unlimited trades"),
            tr("Coach IA + Insights", "AI coach + Insights"),
            tr("Rapports mensuels IA", "AI monthly reports"),
            tr("Multi-comptes", "Multi-account"),
          ]}
        />
      </div>

      {/* Placeholder notice */}
      <div className="glass rounded-2xl px-4 py-3.5 flex items-center gap-3 animate-fade-in-up stagger-4">
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
          <Clock className="w-4 h-4" />
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          {tr(
            "La gestion de l'abonnement depuis cette page arrive bientôt. En attendant, ton accès actuel reste inchangé.",
            "Managing your subscription from this page is coming soon. Meanwhile, your current access stays unchanged.",
          )}
        </p>
      </div>
    </div>
  );
}

function PlanCard({
  title,
  price,
  per,
  note,
  cta,
  items,
  badge,
  highlight = false,
  delay,
}: {
  title: string;
  price: string;
  per: string;
  note: string;
  cta: string;
  items: string[];
  badge?: string;
  highlight?: boolean;
  delay: number;
}) {
  return (
    <div
      className={cn(
        "relative rounded-3xl p-5 border flex flex-col gap-4 card-premium animate-fade-in-up",
        highlight
          ? "border-cyan-500/30 bg-cyan-500/[0.05] shadow-lg shadow-cyan-500/10"
          : "glass border-white/[0.07]",
      )}
      style={{ animationDelay: `${delay * 70}ms` }}
    >
      {badge && (
        <span className="absolute -top-2.5 right-4 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-lg shadow-cyan-500/30">
          {badge}
        </span>
      )}
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</span>
        <div className="mt-2 flex items-end gap-1.5">
          <span className="text-3xl font-extrabold text-white tabular-nums">{price}</span>
          <span className="mb-1 text-xs text-slate-500">{per}</span>
        </div>
        <p className="text-[11px] text-slate-500 mt-1">{note}</p>
      </div>
      <ul className="space-y-2 flex-1">
        {items.map((it) => (
          <li key={it} className="flex items-center gap-2 text-xs text-slate-300">
            <span className="w-4 h-4 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
              <Check className="w-2.5 h-2.5 text-emerald-400" />
            </span>
            {it}
          </li>
        ))}
      </ul>
      {/* Visual placeholder — intentionally not wired to any payment flow. */}
      <div
        aria-disabled="true"
        className={cn(
          "w-full h-11 rounded-xl text-sm font-bold flex items-center justify-center select-none",
          highlight
            ? "bg-gradient-to-r from-cyan-500/40 to-teal-500/40 text-white/70"
            : "bg-white/[0.05] border border-white/[0.08] text-slate-500",
        )}
      >
        {cta}
      </div>
    </div>
  );
}
