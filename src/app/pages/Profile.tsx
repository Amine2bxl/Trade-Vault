import { useAuth } from "../contexts/AuthContext";
import { Trade, SUPPORT_EMAIL } from "../types";
import { computeStats, formatPnl, formatPct } from "../utils/tradeCalcs";
import {
  LogOut,
  Mail,
  RotateCcw,
  MessageSquare,
  Handshake,
  Lightbulb,
  ChevronRight,
} from "lucide-react";
import { useT } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";

interface ProfileProps {
  trades: Trade[];
}

/**
 * PROFIL — qui est le trader, et rien d'autre.
 *
 * DEUX CHOSES ONT ÉTÉ RETIRÉES, ET C'EST L'ESSENTIEL DE LA PAGE.
 *
 *   • LA LISTE DE NAVIGATION. La page portait quatre grandes lignes cliquables
 *     — Abonnement, Réglages, Apparence, Plan de trading — présentées comme le
 *     « hub du compte ». Or la barre d'onglets de la section Réglages, posée
 *     TRENTE PIXELS AU-DESSUS, contient déjà les trois premières, et le rail
 *     porte la quatrième. Quatre boutons pour aller là où deux rangées de
 *     navigation mènent déjà : le doublon coûtait un tiers de la hauteur de la
 *     page.
 *   • LA TUILE DE MÉTRIQUE `Metric`. Elle est faite pour un tableau de bord —
 *     un cadre, une jauge, un pied de tuile. Ici les trois chiffres ne sont pas
 *     le sujet, ils sont la CARTE D'IDENTITÉ : ils tiennent sur la même ligne
 *     que le nom, séparés par un filet.
 *
 * Ce qui reste tient sur UN ÉCRAN, sans défilement, en deux rangées :
 * l'identité (avec son bilan), puis le contact et les actions de compte côte à
 * côte. La page n'utilise plus une colonne étroite centrée mais toute la
 * largeur disponible — c'est elle qui permet aux deux blocs de vivre côte à
 * côte au lieu de s'empiler.
 */
export default function Profile({ trades }: ProfileProps) {
  const { user, logout } = useAuth();
  const { t } = useT();
  const stats = computeStats(trades);

  if (!user) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-3 p-4 md:p-5">
      {/* ── L'IDENTITÉ, ET LE BILAN QUI VA AVEC ────────────────────────── */}
      <section className="glass animate-fade-in-up flex flex-wrap items-center gap-x-6 gap-y-4 rounded-3xl px-4 py-4 sm:px-5">
        {/* `basis-[240px]` : la rangée peut passer à la ligne, encore
            faut-il qu'elle SACHE quand. Sans base, le bloc d'identité était
            comprimé à 39px sur un téléphone pendant que les trois chiffres,
            eux, gardaient leur largeur. Avec elle, ce sont les chiffres qui
            descendent d'une ligne. */}
        <div className="flex min-w-0 flex-1 basis-[240px] items-center gap-3.5">
          <div className="tv-accent-fill grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-base font-bold">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="font-display truncate text-base font-extrabold tracking-tight text-white">
              {user.name}
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-slate-400">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{user.email}</span>
            </p>
          </div>
        </div>

        {/* Le bilan — trois faits, sur la même ligne que le nom. */}
        <div className="flex shrink-0 items-stretch gap-5">
          <Fait
            label={t("stats.totalPnl")}
            value={formatPnl(stats.totalPnl)}
            tone={stats.totalPnl >= 0 ? "pos" : "neg"}
          />
          <Fait label={t("stats.trades")} value={String(stats.totalTrades)} />
          <Fait label={t("stats.winRate")} value={formatPct(stats.winRate)} />
        </div>
      </section>

      {/* ── LE CONTACT, ET LES ACTIONS DE COMPTE ───────────────────────── */}
      {/* `items-start` : sans lui, la colonne « Compte » — deux lignes — est
          étirée à la hauteur de la colonne « Contact » qui en a trois, et
          finit sur un tiers de cadre vide. */}
      <div className="grid items-start gap-3 md:grid-cols-[1.35fr_1fr]">
        <section className="glass animate-fade-in-up stagger-1 overflow-hidden rounded-3xl">
          <header className="flex items-center gap-2 border-b border-white/[0.05] px-4 py-3 sm:px-5">
            <MessageSquare className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <h2 className="tv-label text-slate-400">{t("profile.getInTouch")}</h2>
          </header>
          <div className="divide-y divide-white/[0.04]">
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
          </div>
        </section>

        <section className="glass animate-fade-in-up stagger-2 overflow-hidden rounded-3xl">
          <header className="flex items-center gap-2 border-b border-white/[0.05] px-4 py-3 sm:px-5">
            <LogOut className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <h2 className="tv-label text-slate-400">{t("profile.accountActions")}</h2>
          </header>
          <div className="divide-y divide-white/[0.04]">
            <ActionRow
              label={t("profile.redoOnboarding")}
              icon={<RotateCcw className="h-4 w-4" />}
              onClick={async () => {
                try {
                  const { supabase } = await import("@/integrations/supabase/client");
                  await supabase.from("profiles").update({ onboarded_at: null }).eq("id", user.id);
                  window.location.reload();
                } catch {
                  /* ignore */
                }
              }}
            />
            <ActionRow
              label={t("common.signOut")}
              icon={<LogOut className="h-4 w-4" />}
              onClick={logout}
              danger
            />
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * UN FAIT DE LA CARTE D'IDENTITÉ. Filet vertical à gauche, jamais de cadre :
 * ces trois chiffres accompagnent le nom, ils ne le concurrencent pas.
 */
function Fait({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="min-w-0 border-l border-white/[0.07] pl-5 first:border-l-0 first:pl-0">
      <div className="tv-label truncate text-slate-500">{label}</div>
      <div
        className={cn(
          "tv-figure mt-1 truncate text-base leading-none",
          tone === "pos" ? "rp-pos" : tone === "neg" ? "rp-neg" : "text-white",
        )}
      >
        {value}
      </div>
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
      className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03] sm:px-5"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-white">{label}</span>
        <span className="block truncate text-[11px] text-slate-500">{sub}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 transition-transform group-hover:translate-x-0.5" />
    </a>
  );
}

function ActionRow({
  label,
  icon,
  onClick,
  danger,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors sm:px-5",
        danger ? "hover:bg-red-500/[0.06]" : "hover:bg-white/[0.03]",
      )}
    >
      <span
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-xl border",
          danger
            ? "border-red-500/20 bg-red-500/10 text-red-400"
            : "border-white/[0.08] bg-white/[0.03] text-slate-400",
        )}
      >
        {icon}
      </span>
      {/* Pas de `truncate` : sur tablette la colonne fait 250px et « Redo
          onboarding tutorial » y était coupé. Deux lignes valent mieux qu'une
          phrase amputée. */}
      <span
        className={cn(
          "min-w-0 flex-1 text-sm font-semibold leading-snug",
          danger ? "text-red-300" : "text-white",
        )}
      >
        {label}
      </span>
    </button>
  );
}
