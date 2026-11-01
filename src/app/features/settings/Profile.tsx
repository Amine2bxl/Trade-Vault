import {
  PageContainer,
  SettingsAction,
  SettingsFact,
  SettingsGroup,
  SettingsHero,
} from "@/shared/ui";
import { useAuth } from "@/app/contexts/AuthContext";
import { Trade, SUPPORT_EMAIL } from "@/app/types";
import { computeStats, formatPnl, formatPct } from "@/domain/tradeCalcs";
import { LogOut, Mail, RotateCcw, MessageSquare, Handshake, Lightbulb } from "@/shared/ui/icons";
import { useT } from "@/app/i18n/LanguageContext";

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
 * Ce qui reste tient sur UN ÉCRAN : la carte héros commune aux pages de
 * réglages (`SettingsHero` — l'identité, et son bilan à droite), puis deux
 * listes groupées — contact, compte — sur l'anatomie commune
 * (`SettingsGroup`).
 */
export default function Profile({ trades }: ProfileProps) {
  const { user, logout } = useAuth();
  const { t } = useT();
  const stats = computeStats(trades);

  if (!user) return null;

  const mail = (subject: string) =>
    `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;

  return (
    <PageContainer measure="settings" className="space-y-6">
      {/* ── L'IDENTITÉ, ET LE BILAN QUI VA AVEC — la carte héros commune ── */}
      <SettingsHero
        media={user.name.charAt(0).toUpperCase()}
        mediaTone="accent"
        title={user.name}
        subtitle={
          <span className="flex min-w-0 items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{user.email}</span>
          </span>
        }
        aside={
          <>
            <SettingsFact
              label={t("stats.totalPnl")}
              value={formatPnl(stats.totalPnl)}
              tone={stats.totalPnl >= 0 ? "pos" : "neg"}
            />
            <SettingsFact label={t("stats.trades")} value={String(stats.totalTrades)} />
            <SettingsFact label={t("stats.winRate")} value={formatPct(stats.winRate)} />
          </>
        }
      />

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
