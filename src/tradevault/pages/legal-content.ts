import type { Lang } from "../i18n/translations";
import { SUPPORT_EMAIL } from "../types";

// Standalone legal copy for the /terms and /privacy routes. These routes render
// OUTSIDE the app tree, so they have no LanguageProvider — the LegalPage reads
// the persisted language ("tv.lang") directly and picks the doc here. English is
// the source-of-truth and the fallback; French is fully translated. Any other
// locale falls back to English, matching the app-wide i18n philosophy.

export interface LegalBlock {
  h: string;
  /** Paragraph text. Rendered before `list` when both are present. */
  p?: string;
  /** Bullet list items. */
  list?: string[];
}

export interface LegalDoc {
  title: string;
  updated: string;
  intro: string;
  blocks: LegalBlock[];
}

export interface LegalChrome {
  back: string;
  toc: string;
  contactCta: string;
}

const chromeByLang: Partial<Record<Lang, LegalChrome>> = {
  en: { back: "Back to TradeVault", toc: "On this page", contactCta: "Contact us" },
  fr: { back: "Retour à TradeVault", toc: "Sur cette page", contactCta: "Nous contacter" },
};

export function legalChrome(lang: Lang): LegalChrome {
  return chromeByLang[lang] ?? chromeByLang.en!;
}

// ── Terms of Service ──────────────────────────────────────────────────────
const termsByLang: Partial<Record<Lang, LegalDoc>> = {
  en: {
    title: "Terms of Service",
    updated: "Last updated: July 2026",
    intro:
      "These terms govern your use of TradeVault. They are written to be short and readable — no hidden clauses.",
    blocks: [
      {
        h: "Acceptance of terms",
        p: "By creating an account and using TradeVault, you agree to these terms. If you do not agree, please do not use the service.",
      },
      {
        h: "The service",
        p: 'TradeVault is a personal trading journal for logging trades, tracking performance, and reviewing missed opportunities. It is provided "as is", without warranty of any kind.',
      },
      {
        h: "Not financial advice",
        p: "TradeVault is a record-keeping and analytics tool only. Nothing in the app constitutes financial, investment, or trading advice. You are solely responsible for your own trading decisions.",
      },
      {
        h: "Your account and content",
        p: "You are responsible for the accuracy of the data you enter and for keeping your account credentials secure. You retain ownership of the trades, notes, and screenshots you upload.",
      },
      {
        h: "Acceptable use",
        p: "You agree not to misuse the service, attempt to access other users' data, or use the app for any unlawful purpose.",
      },
      {
        h: "Availability and price",
        p: "TradeVault is free during early access. We may change the feature set or introduce paid plans in the future; if we do, we will give clear notice beforehand and never charge you without your explicit consent.",
      },
      {
        h: "Changes",
        p: "We may update these terms from time to time. Continued use of TradeVault after changes means you accept the updated terms.",
      },
      {
        h: "Contact",
        p: `Questions about these terms: ${SUPPORT_EMAIL}`,
      },
    ],
  },
  fr: {
    title: "Conditions d'utilisation",
    updated: "Dernière mise à jour : juillet 2026",
    intro:
      "Ces conditions encadrent votre utilisation de TradeVault. Elles se veulent courtes et lisibles — aucune clause cachée.",
    blocks: [
      {
        h: "Acceptation des conditions",
        p: "En créant un compte et en utilisant TradeVault, vous acceptez ces conditions. Si vous n'êtes pas d'accord, merci de ne pas utiliser le service.",
      },
      {
        h: "Le service",
        p: "TradeVault est un journal de trading personnel permettant de consigner vos trades, suivre vos performances et analyser vos opportunités manquées. Il est fourni « en l'état », sans garantie d'aucune sorte.",
      },
      {
        h: "Pas un conseil financier",
        p: "TradeVault est uniquement un outil de suivi et d'analyse. Rien dans l'application ne constitue un conseil financier, en investissement ou en trading. Vous êtes seul responsable de vos décisions de trading.",
      },
      {
        h: "Votre compte et vos contenus",
        p: "Vous êtes responsable de l'exactitude des données que vous saisissez et de la sécurité de vos identifiants. Vous restez propriétaire des trades, notes et captures d'écran que vous téléversez.",
      },
      {
        h: "Utilisation acceptable",
        p: "Vous vous engagez à ne pas détourner le service, à ne pas tenter d'accéder aux données d'autres utilisateurs, ni à utiliser l'application à des fins illégales.",
      },
      {
        h: "Disponibilité et prix",
        p: "TradeVault est gratuit pendant l'accès anticipé. Nous pourrons faire évoluer les fonctionnalités ou introduire des offres payantes à l'avenir ; le cas échéant, nous vous préviendrons clairement à l'avance et ne vous facturerons jamais sans votre consentement explicite.",
      },
      {
        h: "Modifications",
        p: "Nous pouvons mettre à jour ces conditions de temps à autre. Continuer à utiliser TradeVault après une modification vaut acceptation des conditions mises à jour.",
      },
      {
        h: "Contact",
        p: `Questions sur ces conditions : ${SUPPORT_EMAIL}`,
      },
    ],
  },
};

// ── Privacy Policy ────────────────────────────────────────────────────────
const privacyByLang: Partial<Record<Lang, LegalDoc>> = {
  en: {
    title: "Privacy Policy",
    updated: "Last updated: July 2026",
    intro:
      "Your trading data is personal. This policy explains exactly what we collect, why, and the control you keep over it.",
    blocks: [
      {
        h: "What TradeVault is",
        p: "TradeVault is a personal trading journal application. It lets you log trades, upload trade screenshots, and track your trading performance over time.",
      },
      {
        h: "Information we collect",
        list: [
          "Account information: your name and email address, provided directly or via Google Sign-In.",
          "Trading data you enter: trades, notes, missed opportunities, and screenshots you upload.",
          "Basic technical data (browser, device) needed to operate the service.",
        ],
      },
      {
        h: "How we use Google account data",
        p: "When you sign in with Google, we only request your email address and basic profile information to create and authenticate your TradeVault account. We do not access your Gmail, contacts, files, or any other Google data.",
      },
      {
        h: "Where your data is stored",
        p: "Your data is stored in a Supabase (PostgreSQL) database dedicated to TradeVault, protected by row-level security so that only you can access your own trades and files. We do not sell your data to third parties.",
      },
      {
        h: "AI features and third-party processing",
        p: "When you use the AI Insights or AI coach features, the trading data needed to answer your question (trade dates, symbols, P&L, strategies, mistake tags, and your trade notes — never your screenshots or account credentials) is sent to Google's Gemini API for processing. This only happens when you actively ask the AI a question. Google processes this data to generate the response and does not use it to identify you. If you prefer not to share this data, simply do not use the AI features.",
      },
      {
        h: "Your rights",
        p: "You can delete your trades, missed opportunities, and screenshots at any time from within the app. To request full account deletion, contact us at the address below.",
      },
      {
        h: "Contact",
        p: `Questions about this policy: ${SUPPORT_EMAIL}`,
      },
    ],
  },
  fr: {
    title: "Politique de confidentialité",
    updated: "Dernière mise à jour : juillet 2026",
    intro:
      "Vos données de trading sont personnelles. Cette politique explique précisément ce que nous collectons, pourquoi, et le contrôle que vous gardez dessus.",
    blocks: [
      {
        h: "Ce qu'est TradeVault",
        p: "TradeVault est une application de journal de trading personnel. Elle vous permet de consigner vos trades, téléverser des captures d'écran et suivre vos performances dans le temps.",
      },
      {
        h: "Informations que nous collectons",
        list: [
          "Informations de compte : votre nom et votre adresse e-mail, fournis directement ou via la connexion Google.",
          "Données de trading que vous saisissez : trades, notes, opportunités manquées et captures d'écran téléversées.",
          "Données techniques de base (navigateur, appareil) nécessaires au fonctionnement du service.",
        ],
      },
      {
        h: "Utilisation des données du compte Google",
        p: "Lorsque vous vous connectez avec Google, nous demandons uniquement votre adresse e-mail et les informations de profil de base pour créer et authentifier votre compte TradeVault. Nous n'accédons ni à votre Gmail, ni à vos contacts, ni à vos fichiers, ni à aucune autre donnée Google.",
      },
      {
        h: "Où vos données sont stockées",
        p: "Vos données sont stockées dans une base de données Supabase (PostgreSQL) dédiée à TradeVault, protégée par une sécurité au niveau des lignes (RLS) : vous seul pouvez accéder à vos propres trades et fichiers. Nous ne vendons pas vos données à des tiers.",
      },
      {
        h: "Fonctions IA et traitement par des tiers",
        p: "Lorsque vous utilisez les fonctions IA Insights ou le coach IA, les données de trading nécessaires pour répondre à votre question (dates, symboles, P&L, stratégies, tags d'erreurs et vos notes de trade — jamais vos captures d'écran ni vos identifiants) sont envoyées à l'API Gemini de Google pour traitement. Cela ne se produit que lorsque vous posez activement une question à l'IA. Google traite ces données pour générer la réponse et ne les utilise pas pour vous identifier. Si vous préférez ne pas partager ces données, n'utilisez simplement pas les fonctions IA.",
      },
      {
        h: "Vos droits",
        p: "Vous pouvez supprimer vos trades, opportunités manquées et captures d'écran à tout moment depuis l'application. Pour demander la suppression complète de votre compte, contactez-nous à l'adresse ci-dessous.",
      },
      {
        h: "Contact",
        p: `Questions sur cette politique : ${SUPPORT_EMAIL}`,
      },
    ],
  },
};

export function getTermsDoc(lang: Lang): LegalDoc {
  return termsByLang[lang] ?? termsByLang.en!;
}

export function getPrivacyDoc(lang: Lang): LegalDoc {
  return privacyByLang[lang] ?? privacyByLang.en!;
}
