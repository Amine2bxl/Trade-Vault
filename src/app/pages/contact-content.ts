import type { Lang } from "../i18n/translations";
import { SUPPORT_EMAIL } from "../types";

/**
 * Copy for the /contact route. Same contract as `legal-content.ts`: this route
 * renders outside the app tree, so it can't use `useT()` — English is the
 * source of truth and the fallback, French is fully translated, every other
 * locale falls back to English.
 *
 * The support address always comes from `SUPPORT_EMAIL` so a single constant
 * governs the footer, the legal pages, the profile page and this one — and
 * matches the address declared on the Google OAuth consent screen.
 */

export interface ContactChannel {
  /** Lucide icon key, resolved by the page. */
  icon: "mail" | "shield" | "receipt" | "bug";
  title: string;
  body: string;
  /** Optional mailto subject prefill. */
  subject?: string;
}

export interface ContactDoc {
  title: string;
  intro: string;
  back: string;
  emailLabel: string;
  responseTitle: string;
  responseBody: string;
  channelsTitle: string;
  channels: ContactChannel[];
  includeTitle: string;
  include: string[];
  legalNote: string;
}

const byLang: Partial<Record<Lang, ContactDoc>> = {
  en: {
    title: "Contact",
    intro:
      "TradeVault is built by a small team that reads every message. There is no ticket queue and no chatbot — write to us and a human answers.",
    back: "Back to TradeVault",
    emailLabel: "Write to us",
    responseTitle: "Response time",
    responseBody:
      "We answer within 48 hours on business days. Account access and billing issues are handled first.",
    channelsTitle: "What can we help with?",
    channels: [
      {
        icon: "mail",
        title: "Product & support",
        body: "A question about your journal, your statistics, the pre-market checklist or Jarvis — or something that simply does not work as expected.",
        subject: "TradeVault — support",
      },
      {
        icon: "receipt",
        title: "Billing & subscription",
        body: "Invoices, plan changes, renewals, refunds. The free plan stays free forever — upgrade only when you want Pro.",
        subject: "TradeVault — billing",
      },
      {
        icon: "shield",
        title: "Privacy & your data",
        body: "Access, export or deletion of your personal data. You can also delete your account and every trace of it directly from Settings, at any time.",
        subject: "TradeVault — data request",
      },
      {
        icon: "bug",
        title: "Security disclosure",
        body: "Found a vulnerability? Tell us privately before disclosing it publicly and we will confirm receipt quickly. We will never take legal action against good-faith research.",
        subject: "TradeVault — security disclosure",
      },
    ],
    includeTitle: "To get a faster answer",
    include: [
      "The email address of your TradeVault account.",
      "What you expected to happen, and what happened instead.",
      "The page you were on and, if possible, a screenshot.",
      "Your device and browser (for a display or performance issue).",
    ],
    legalNote:
      "TradeVault is a trading journal and an analysis tool. We do not provide financial advice, we never predict markets, and we never place orders on your behalf.",
  },
  fr: {
    title: "Contact",
    intro:
      "TradeVault est construit par une petite équipe qui lit chaque message. Pas de file de tickets, pas de chatbot — tu écris, un humain répond.",
    back: "Retour à TradeVault",
    emailLabel: "Nous écrire",
    responseTitle: "Délai de réponse",
    responseBody:
      "Nous répondons sous 48 heures les jours ouvrés. Les problèmes d'accès au compte et de facturation passent en premier.",
    channelsTitle: "Sur quoi peut-on t'aider ?",
    channels: [
      {
        icon: "mail",
        title: "Produit & support",
        body: "Une question sur ton journal, tes statistiques, la checklist pré-market ou Jarvis — ou quelque chose qui ne fonctionne simplement pas comme prévu.",
        subject: "TradeVault — support",
      },
      {
        icon: "receipt",
        title: "Facturation & abonnement",
        body: "Factures, changement de formule, renouvellements, remboursements. L'offre gratuite reste gratuite pour toujours — passe à Pro seulement quand tu le veux.",
        subject: "TradeVault — facturation",
      },
      {
        icon: "shield",
        title: "Confidentialité & tes données",
        body: "Accès, export ou suppression de tes données personnelles. Tu peux aussi supprimer ton compte et toute trace de celui-ci directement depuis les Réglages, à tout moment.",
        subject: "TradeVault — demande RGPD",
      },
      {
        icon: "bug",
        title: "Faille de sécurité",
        body: "Tu as trouvé une vulnérabilité ? Préviens-nous en privé avant toute divulgation publique, nous accusons réception rapidement. Aucune action en justice ne sera engagée contre une recherche de bonne foi.",
        subject: "TradeVault — signalement de sécurité",
      },
    ],
    includeTitle: "Pour une réponse plus rapide",
    include: [
      "L'adresse e-mail de ton compte TradeVault.",
      "Ce que tu attendais, et ce qui s'est passé à la place.",
      "La page concernée et, si possible, une capture d'écran.",
      "Ton appareil et ton navigateur (pour un souci d'affichage ou de performance).",
    ],
    legalNote:
      "TradeVault est un journal de trading et un outil d'analyse. Nous ne fournissons aucun conseil financier, nous ne prédisons jamais les marchés et nous ne passons jamais d'ordres à ta place.",
  },
};

export function getContactDoc(lang: Lang): ContactDoc {
  return byLang[lang] ?? byLang.en!;
}
