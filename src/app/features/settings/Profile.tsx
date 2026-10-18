import { PageContainer, SettingsAction, SettingsGroup } from "@/shared/ui";
import { useAuth } from "@/app/contexts/AuthContext";
import { Trade, SUPPORT_EMAIL } from "@/app/types";
import { computeStats, formatPnl, formatPct } from "@/domain/tradeCalcs";
import { LogOut, Mail, RotateCcw, MessageSquare, Handshake, Lightbulb } from "@/shared/ui/icons";
import { useT } from "@/app/i18n/LanguageContext";
import { cn } from "@/shared/ui/cn";

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
 * Ce qui reste tient sur UN ÉCRAN : l'identité (avec son bilan), puis deux
 * listes à filets — contact, compte — sur l'anatomie commune des pages de
 * paramètres (`SettingsGroup`). Plus de cartes vitrées ni de pastilles.
 */
export default function Profile({ trades }: ProfileProps) {
  const { user, logout } = useAuth();
  const { t } = useT();
  const stats = computeStats(trades);

  if (!user) return null;

  const mail = (subject: string) =>
    `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;

  return (
    <PageContainer className="max-w-3xl space-y-5">
      {/* ── L'IDENTITÉ, ET LE BILAN QUI VA AVEC — à plat, sans carte ────── */}
      <section className="animate-fade-in-up flex flex-wrap items-center gap-x-6 gap-y-4 px-1">
        {/* `basis-[240px]` : ce sont les chiffres qui passent à la ligne sur
            téléphone, jamais le nom qui se comprime. */}
        <div className="flex min-w-0 flex-1 basis-[240px] items-center gap-3.5">
          <div className="tv-accent-fill grid h-11 w-11 shrink-0 place-items-center rounded-xl text-base font-bold">
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

      <SettingsGroup title={t("profile.getInTouch")}>
        <SettingsAction
          icon={<MessageSquare className="h-4 w-4" />}
          label={t("profile.support")}
          hint={t("profile.supportSub")}
          href={mail("TradeVault — Support request")}
        />
        <SettingsAction
          icon={<Handshake className="h-4 w-4" />}
          label={t("profile.collab")}
          hint={t("profile.collabSub")}
          href={mail("TradeVault — Collab inquiry")}
        />
        <SettingsAction
          icon={<Lightbulb className="h-4 w-4" />}
          label={t("profile.improvements")}
          hint={t("profile.improvementsSub")}
          href={mail("TradeVault — Improvement idea")}
        />
      </SettingsGroup>

      <SettingsGroup title={t("profile.accountActions")}>
        <SettingsAction
          icon={<RotateCcw className="h-4 w-4" />}
          label={t("profile.redoOnboarding")}
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
        <SettingsAction
          danger
          icon={<LogOut className="h-4 w-4" />}
          label={t("common.signOut")}
          onClick={logout}
        />
      </SettingsGroup>
    </PageContainer>
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
