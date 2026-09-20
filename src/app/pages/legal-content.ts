import type { Lang } from "../i18n/translations";
import { SUPPORT_EMAIL } from "../types";
import { SITE_DOMAIN } from "@/shared/site";
import { TIER_BY_ID } from "@/domain/plans";

/**
 * LES DOCUMENTS LÉGAUX — écrits contre le produit, pas contre son souvenir.
 *
 * ── CE QUI ÉTAIT FAUX, ET QUI L'EST RESTÉ LONGTEMPS ───────────────────────
 *
 * Les Conditions annonçaient « TradeVault est gratuit pendant l'accès
 * anticipé » et « nous pourrons introduire des offres payantes à l'avenir »
 * pendant que la grille tarifaire vendait Pro et Elite, que Stripe encaissait
 * et qu'une page `/subscription` affichait un plan en cours. Les CGU, elles,
 * décrivaient déjà les abonnements : deux documents légaux du même site se
 * contredisaient sur le point le plus matériel qui soit.
 *
 * La politique de confidentialité, de son côté, parlait d'« IA Insights » et
 * du « coach IA » — deux noms abandonnés — et ne citait que Gemini, alors que
 * le fournisseur se choisit par variable d'environnement et peut être
 * Anthropic ou un service compatible OpenAI. Elle ne disait rien du push, ni
 * des e-mails de cycle de vie, ni de l'export, ni de la suppression de compte
 * — toutes livrées.
 *
 * ── LA RÈGLE D'ÉCRITURE ───────────────────────────────────────────────────
 *
 * Tout ce qui est écrit ici est VÉRIFIABLE dans ce dépôt. Rien n'y est
 * inventé : pas de raison sociale, pas d'adresse postale, pas de numéro
 * d'entreprise, pas de délégué à la protection des données, pas de droit
 * applicable ni de tribunal compétent, pas de durée de conservation chiffrée.
 * Ces mentions existent dans la plupart des CGU parce qu'elles y sont
 * obligatoires — mais une mention légale inventée est pire que son absence :
 * elle est opposable et fausse. Elles arriveront quand l'entité juridique
 * sera constituée ; d'ici là le document dit ce qu'il sait.
 *
 * ── LES PRIX NE SONT PAS RECOPIÉS ─────────────────────────────────────────
 *
 * Ils sont lus dans `@/domain/plans`, la même source que la grille tarifaire
 * et que Stripe. Un document légal qui annonce un prix périmé est un
 * engagement erroné ; recopier les montants à la main garantissait qu'ils le
 * deviennent un jour.
 */

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
  /** Les autres documents, listés au pied de chaque page. */
  related: string;
}

const chromeByLang: Partial<Record<Lang, LegalChrome>> = {
  en: {
    back: "Back to TradeVault",
    toc: "On this page",
    contactCta: "Contact us",
    related: "Other documents",
  },
  fr: {
    back: "Retour à TradeVault",
    toc: "Sur cette page",
    contactCta: "Nous contacter",
    related: "Les autres documents",
  },
};

export function legalChrome(lang: Lang): LegalChrome {
  return chromeByLang[lang] ?? chromeByLang.en!;
}

/**
 * LA TABLE DES DOCUMENTS — une seule liste, lue par le pied de chaque page
 * légale. Un document légal isolé oblige à revenir en arrière pour trouver
 * son voisin ; les quatre se citent donc mutuellement.
 */
export const LEGAL_ROUTES = [
  { path: "/terms", label: { en: "Terms of Service", fr: "Conditions d'utilisation" } },
  { path: "/cgu", label: { en: "General Terms (CGU)", fr: "CGU" } },
  { path: "/privacy", label: { en: "Privacy Policy", fr: "Politique de confidentialité" } },
  { path: "/cookies", label: { en: "Cookies", fr: "Cookies" } },
] as const;

export function legalLabel(path: string, lang: Lang): string {
  const entry = LEGAL_ROUTES.find((r) => r.path === path);
  if (!entry) return path;
  return lang === "fr" ? entry.label.fr : entry.label.en;
}

/* ── Les faits tarifaires, lus dans le catalogue ─────────────────────────── */
const PRO = TIER_BY_ID.pro;
const ELITE = TIER_BY_ID.elite;
const UPDATED_EN = "Last updated: September 2026";
const UPDATED_FR = "Dernière mise à jour : septembre 2026";

/* ══════════════════════ Terms of Service ══════════════════════ */
const termsByLang: Partial<Record<Lang, LegalDoc>> = {
  en: {
    title: "Terms of Service",
    updated: UPDATED_EN,
    intro:
      "These terms govern your use of TradeVault. They are deliberately short, and they describe the product as it exists today - not as it might exist later.",
    blocks: [
      {
        h: "What TradeVault is",
        p: "TradeVault is a trading journal and performance workspace. You record your own trades, it computes statistics from them, and an assistant called Jarvis comments on what it finds. It is provided as is, with no guarantee of availability or of result.",
        list: [
          "It has no broker connection and no market data feed. Everything it knows, you entered - by hand, by CSV import, or by generating demo trades.",
          "It never places, routes or modifies an order.",
        ],
      },
      {
        h: "Not financial advice",
        p: "Nothing in TradeVault is financial, investment or trading advice. Jarvis describes your past; it is explicitly forbidden from predicting a market or issuing a signal. Every trading decision remains yours alone, and so does its outcome.",
      },
      {
        h: "Your account",
        p: "You sign up with an email address and a password, or with Google Sign-In. You are responsible for the accuracy of what you enter and for keeping your credentials secure. One person, one account.",
      },
      {
        h: "Plans and billing",
        p: `A free plan exists with no time limit. Paid plans are Pro (${PRO.monthly} EUR a month or ${PRO.yearly} EUR a year) and Elite (${ELITE.monthly} EUR a month or ${ELITE.yearly} EUR a year). Card payments are handled by Stripe; a cryptocurrency option is handled by Coinbase Commerce. TradeVault never sees or stores your card number.`,
        list: [
          "A subscription renews automatically until you cancel it.",
          "Cancelling takes effect at the end of the period already paid for; you keep your plan until then.",
          "Refunds are considered case by case.",
          "If a price changes, the change applies to your next renewal, never retroactively.",
        ],
      },
      {
        h: "What you may not do",
        list: [
          "Attempt to reach data that is not yours, or to bypass the access controls of a plan you are not on.",
          "Upload unlawful content, or content that infringes someone else's rights.",
          "Resell, scrape or redistribute another user's data.",
          "Use the service in a way that degrades it for other users.",
        ],
      },
      {
        h: "Your content stays yours",
        p: "The trades, notes and screenshots you upload remain yours. You can export your trades to CSV at any time, and deleting your account deletes your data and your uploaded files along with it. We never sell your data.",
      },
      {
        h: "Interruptions and limits",
        p: "TradeVault runs on third-party infrastructure and can be interrupted by an incident outside our control. To the fullest extent permitted by law, we are not liable for trading losses, lost data, or indirect damages arising from use of the service. Keep your own copy of anything you cannot afford to lose: the CSV export exists for that.",
      },
      {
        h: "Ending the relationship",
        p: "You can delete your account at any time from the app. We may suspend an account that breaks these terms, and will say why when we do.",
      },
      {
        h: "Changes to these terms",
        p: "We may update these terms. A material change will be announced before it takes effect. Continuing to use TradeVault afterwards means you accept the updated version.",
      },
      {
        h: "Contact",
        p: `Questions about these terms: ${SUPPORT_EMAIL}`,
      },
    ],
  },
  fr: {
    title: "Conditions d'utilisation",
    updated: UPDATED_FR,
    intro:
      "Ces conditions encadrent votre utilisation de TradeVault. Elles sont volontairement courtes, et elles décrivent le produit tel qu'il existe aujourd'hui - pas tel qu'il pourrait exister plus tard.",
    blocks: [
      {
        h: "Ce qu'est TradeVault",
        p: "TradeVault est un journal de trading et un espace d'analyse de performance. Vous y enregistrez vos propres trades, le service en calcule des statistiques, et un assistant nommé Jarvis commente ce qu'il y trouve. Il est fourni en l'état, sans garantie de disponibilité ni de résultat.",
        list: [
          "Aucune connexion à un courtier, aucun flux de données de marché. Tout ce que le service connaît, vous l'avez saisi - à la main, par import CSV, ou en générant des trades de démonstration.",
          "Il ne passe, ne transmet et ne modifie jamais un ordre.",
        ],
      },
      {
        h: "Aucun conseil financier",
        p: "Rien dans TradeVault ne constitue un conseil financier, en investissement ou en trading. Jarvis décrit votre passé ; il lui est explicitement interdit de prédire un marché ou d'émettre un signal. Chaque décision de trading reste la vôtre, et son résultat aussi.",
      },
      {
        h: "Votre compte",
        p: "Vous créez un compte avec une adresse e-mail et un mot de passe, ou via la connexion Google. Vous êtes responsable de l'exactitude de ce que vous saisissez et de la sécurité de vos identifiants. Une personne, un compte.",
      },
      {
        h: "Offres et facturation",
        p: `Une offre gratuite existe, sans limite de durée. Les offres payantes sont Pro (${PRO.monthly} € par mois ou ${PRO.yearly} € par an) et Elite (${ELITE.monthly} € par mois ou ${ELITE.yearly} € par an). Les paiements par carte passent par Stripe ; une option en cryptomonnaie passe par Coinbase Commerce. TradeVault ne voit ni ne conserve jamais votre numéro de carte.`,
        list: [
          "Un abonnement se renouvelle automatiquement jusqu'à ce que vous le résiliiez.",
          "La résiliation prend effet à la fin de la période déjà payée ; vous gardez votre offre jusque-là.",
          "Les remboursements sont examinés au cas par cas.",
          "Si un prix change, le changement s'applique à votre prochain renouvellement, jamais rétroactivement.",
        ],
      },
      {
        h: "Ce que vous ne pouvez pas faire",
        list: [
          "Tenter d'accéder à des données qui ne sont pas les vôtres, ou de contourner les restrictions d'une offre à laquelle vous n'avez pas souscrit.",
          "Téléverser un contenu illégal ou portant atteinte aux droits d'un tiers.",
          "Revendre, extraire ou rediffuser les données d'un autre utilisateur.",
          "Utiliser le service d'une manière qui le dégrade pour les autres.",
        ],
      },
      {
        h: "Vos contenus restent les vôtres",
        p: "Les trades, notes et captures d'écran que vous téléversez vous appartiennent. Vous pouvez exporter vos trades en CSV à tout moment, et supprimer votre compte supprime vos données et vos fichiers avec lui. Nous ne vendons jamais vos données.",
      },
      {
        h: "Interruptions et limites",
        p: "TradeVault s'appuie sur des infrastructures tierces et peut être interrompu par un incident hors de notre contrôle. Dans toute la mesure permise par la loi, nous ne sommes pas responsables des pertes financières, des pertes de données ni des dommages indirects résultant de l'utilisation du service. Gardez votre propre copie de ce que vous ne pouvez pas perdre : l'export CSV est là pour ça.",
      },
      {
        h: "Mettre fin à la relation",
        p: "Vous pouvez supprimer votre compte à tout moment depuis l'application. Nous pouvons suspendre un compte qui enfreint ces conditions, et nous dirons alors pourquoi.",
      },
      {
        h: "Modifications",
        p: "Nous pouvons mettre à jour ces conditions. Toute modification importante sera annoncée avant son entrée en vigueur. Continuer à utiliser TradeVault ensuite vaut acceptation de la version mise à jour.",
      },
      {
        h: "Contact",
        p: `Questions sur ces conditions : ${SUPPORT_EMAIL}`,
      },
    ],
  },
};

/* ══════════════════════ Privacy Policy ══════════════════════ */
const privacyByLang: Partial<Record<Lang, LegalDoc>> = {
  en: {
    title: "Privacy Policy",
    updated: UPDATED_EN,
    intro:
      "Your trading data says more about you than most things you put online. This policy says exactly what is collected, where it goes, and what you can take back.",
    blocks: [
      {
        h: "What we collect",
        list: [
          "Account: your email address, and the name and profile picture Google returns if you sign in with Google.",
          "What you enter: trades, notes, mistakes, missed setups, goals, your written trading plan, your personal rules, and the screenshots you upload.",
          "What the app derives from it: statistics, behavioural signals and your Edge Score. These are computed, not collected.",
          "Operational data: the technical minimum needed to serve the app and keep it secure.",
        ],
      },
      {
        h: "What we do not collect",
        list: [
          "No broker credentials, no API key to a broker - TradeVault has no broker connection at all.",
          "No card number. Stripe and Coinbase Commerce handle payment; the card never reaches our servers.",
          "No advertising identifier, no third-party tracking pixel, no behavioural advertising profile.",
        ],
      },
      {
        h: "Google Sign-In",
        p: "If you sign in with Google, we request your email address and basic profile only, to create and authenticate your account. We never access your Gmail, your contacts, your files or any other Google data. Google is set to always show the account chooser, so you decide which account is used each time.",
      },
      {
        h: "Where your data lives",
        p: `Your data is stored in a Supabase (PostgreSQL) project hosted in the European Union, and your uploaded screenshots in the storage of that same project. Every table is protected by row-level security: a query can only ever return rows belonging to the signed-in account. The application is served by Vercel. The site is reachable at ${SITE_DOMAIN}.`,
      },
      {
        h: "Jarvis and the AI provider",
        p: "When you ask Jarvis a question, the data needed to answer it is sent to an AI provider for processing: trade dates, symbols, P&L, strategies, mistake tags, your behavioural signals, your rules and your trade notes. Your screenshots and your credentials are never sent.",
        list: [
          "This only happens when you actively ask. Nothing is sent in the background.",
          "The provider is configurable and is currently Google Gemini; Anthropic and OpenAI-compatible services are also supported. The provider processes the request to produce the answer.",
          "Jarvis also has a fully local mode that uses no provider at all: when none is configured, or when the call fails, the answer is built on this server from the same data.",
          "If you would rather share none of it, do not use Jarvis. Every other feature keeps working.",
        ],
      },
      {
        h: "Emails and notifications",
        p: "We send account emails (welcome, end of trial, and a reminder if you leave mid-trial) and, if you generate them, your monthly reports. Push notifications are strictly opt-in, asked for during onboarding, and can be revoked in your browser at any time; refusing them changes nothing else in the app.",
      },
      {
        h: "Who else sees it",
        p: "We do not sell your data and we do not share it for advertising. It is processed only by the providers the service needs to run: Supabase for storage and authentication, Vercel for hosting, the AI provider above when you use Jarvis, Stripe or Coinbase Commerce when you pay, and the email provider for the messages listed above.",
      },
      {
        h: "What you can do about it",
        list: [
          "Export: your trades can be downloaded as CSV at any time, from the app.",
          "Delete a part: any trade, missed setup, note or screenshot can be deleted individually.",
          "Delete everything: deleting your account removes your data, your uploaded files and your authentication record.",
          "Ask: write to us at the address below for anything the app does not let you do yourself.",
        ],
      },
      {
        h: "Changes",
        p: "If this policy changes in a way that affects what is collected or where it goes, we will say so before the change takes effect.",
      },
      {
        h: "Contact",
        p: `Questions about this policy: ${SUPPORT_EMAIL}`,
      },
    ],
  },
  fr: {
    title: "Politique de confidentialité",
    updated: UPDATED_FR,
    intro:
      "Vos données de trading en disent plus long sur vous que la plupart de ce que vous mettez en ligne. Cette politique dit précisément ce qui est collecté, où cela va, et ce que vous pouvez reprendre.",
    blocks: [
      {
        h: "Ce que nous collectons",
        list: [
          "Compte : votre adresse e-mail, ainsi que le nom et la photo de profil renvoyés par Google si vous vous connectez avec Google.",
          "Ce que vous saisissez : trades, notes, erreurs, setups manqués, objectifs, votre plan de trading écrit, vos règles personnelles et les captures d'écran que vous téléversez.",
          "Ce que l'application en déduit : statistiques, signaux comportementaux et Edge Score. Ce sont des calculs, pas une collecte.",
          "Données de fonctionnement : le minimum technique nécessaire pour servir l'application et la garder sûre.",
        ],
      },
      {
        h: "Ce que nous ne collectons pas",
        list: [
          "Aucun identifiant de courtier, aucune clé d'API vers un courtier - TradeVault n'a aucune connexion à un courtier.",
          "Aucun numéro de carte. Stripe et Coinbase Commerce traitent le paiement ; la carte n'atteint jamais nos serveurs.",
          "Aucun identifiant publicitaire, aucun pixel de suivi tiers, aucun profil publicitaire comportemental.",
        ],
      },
      {
        h: "La connexion Google",
        p: "Si vous vous connectez avec Google, nous demandons uniquement votre adresse e-mail et votre profil de base, pour créer et authentifier votre compte. Nous n'accédons jamais à votre Gmail, à vos contacts, à vos fichiers ni à aucune autre donnée Google. Google est configuré pour toujours afficher le sélecteur de compte : vous choisissez à chaque fois lequel est utilisé.",
      },
      {
        h: "Où vivent vos données",
        p: `Vos données sont stockées dans un projet Supabase (PostgreSQL) hébergé dans l'Union européenne, et vos captures d'écran dans le stockage de ce même projet. Chaque table est protégée par une sécurité au niveau des lignes : une requête ne peut renvoyer que des lignes appartenant au compte connecté. L'application est servie par Vercel. Le site est joignable à l'adresse ${SITE_DOMAIN}.`,
      },
      {
        h: "Jarvis et le fournisseur d'IA",
        p: "Lorsque vous posez une question à Jarvis, les données nécessaires pour y répondre sont envoyées à un fournisseur d'IA : dates, symboles, P&L, stratégies, tags d'erreurs, vos signaux comportementaux, vos règles et vos notes de trade. Vos captures d'écran et vos identifiants ne sont jamais envoyés.",
        list: [
          "Cela n'arrive que lorsque vous le demandez. Rien n'est envoyé en arrière-plan.",
          "Le fournisseur est configurable et est actuellement Google Gemini ; Anthropic et les services compatibles OpenAI sont également pris en charge. Le fournisseur traite la requête pour produire la réponse.",
          "Jarvis dispose aussi d'un mode entièrement local, sans aucun fournisseur : quand aucun n'est configuré, ou quand l'appel échoue, la réponse est construite sur ce serveur à partir des mêmes données.",
          "Si vous préférez ne rien partager de tout cela, n'utilisez pas Jarvis. Toutes les autres fonctions continuent de marcher.",
        ],
      },
      {
        h: "E-mails et notifications",
        p: "Nous envoyons des e-mails de compte (bienvenue, fin d'essai, et une relance si vous partez en cours d'essai) et, si vous les générez, vos rapports mensuels. Les notifications push sont strictement facultatives, proposées pendant l'inscription, et révocables à tout moment depuis votre navigateur ; les refuser ne change rien d'autre dans l'application.",
      },
      {
        h: "Qui d'autre y a accès",
        p: "Nous ne vendons pas vos données et nous ne les partageons pas à des fins publicitaires. Elles ne sont traitées que par les prestataires dont le service a besoin pour fonctionner : Supabase pour le stockage et l'authentification, Vercel pour l'hébergement, le fournisseur d'IA ci-dessus quand vous utilisez Jarvis, Stripe ou Coinbase Commerce quand vous payez, et le prestataire d'envoi pour les e-mails listés plus haut.",
      },
      {
        h: "Ce que vous pouvez en faire",
        list: [
          "Exporter : vos trades se téléchargent en CSV à tout moment, depuis l'application.",
          "Supprimer une partie : chaque trade, setup manqué, note ou capture peut être supprimé individuellement.",
          "Tout supprimer : supprimer votre compte efface vos données, vos fichiers téléversés et votre enregistrement d'authentification.",
          "Demander : écrivez-nous à l'adresse ci-dessous pour tout ce que l'application ne vous permet pas de faire vous-même.",
        ],
      },
      {
        h: "Modifications",
        p: "Si cette politique change d'une manière qui affecte ce qui est collecté ou où cela va, nous le dirons avant que le changement prenne effet.",
      },
      {
        h: "Contact",
        p: `Questions sur cette politique : ${SUPPORT_EMAIL}`,
      },
    ],
  },
};

/* ══════════════════════ Cookies ══════════════════════ */
/**
 * LA PAGE COOKIES N'EXISTAIT PAS.
 *
 * Le pied de page portait pourtant un lien « Cookies » — qui menait à la
 * politique de confidentialité, laquelle ne mentionnait pas un seul cookie.
 * Un lien qui promet un document et en sert un autre est un lien mort qui
 * n'en a pas l'air.
 *
 * Le contenu ci-dessous énumère le stockage RÉELLEMENT utilisé, clé par clé,
 * lisible dans le code. C'est le seul inventaire honnête possible : aucun
 * gestionnaire de consentement tiers n'est installé, donc personne ne peut
 * le produire à notre place.
 */
const cookiesByLang: Partial<Record<Lang, LegalDoc>> = {
  en: {
    title: "Cookies and local storage",
    updated: UPDATED_EN,
    intro:
      "TradeVault runs no advertising and no third-party analytics, so there is very little to declare. Here is all of it.",
    blocks: [
      {
        h: "The short version",
        p: "Everything TradeVault stores in your browser is there to make the app work or to remember a choice you made. Nothing is used to track you across other sites, and nothing is shared with an advertiser.",
      },
      {
        h: "Strictly necessary",
        list: [
          "Your session: the token that keeps you signed in between visits, issued by Supabase authentication. Clearing it signs you out.",
          "Cookie notice: remembers that you have seen the notice, so it is not shown again.",
        ],
      },
      {
        h: "Your preferences",
        list: [
          "Interface language, and the marketing site's language, kept separately - the two are independent on purpose.",
          "Your theme and its resolved colours, so the app paints in the right colours before the first frame.",
          "Which notifications you have already been shown today, so the same one is not repeated.",
          "Work in progress: a half-written trade, an open Jarvis conversation. Stored per account on that device so two people sharing a browser never see each other's drafts.",
        ],
      },
      {
        h: "Short-lived cache",
        p: "The economic calendar of the week you are looking at is kept for the duration of the tab, so coming back to the page does not refetch it. It disappears when the tab closes.",
      },
      {
        h: "Third parties",
        p: "Stripe and Coinbase Commerce set their own cookies on their own payment pages, when you go there to pay. Google may set cookies on its sign-in page when you use Google Sign-In. Neither happens on TradeVault itself. We install no analytics tag, no advertising pixel and no social widget.",
      },
      {
        h: "Refusing and removing",
        p: "Clearing your browsing data for this site removes all of it. The preferences come back as defaults and you are signed out; nothing you stored in your account is affected. Signing out of TradeVault also purges your theme keys from the device.",
      },
      {
        h: "Contact",
        p: `Questions about this page: ${SUPPORT_EMAIL}`,
      },
    ],
  },
  fr: {
    title: "Cookies et stockage local",
    updated: UPDATED_FR,
    intro:
      "TradeVault n'affiche aucune publicité et n'utilise aucune mesure d'audience tierce : il y a donc très peu à déclarer. Voici la totalité.",
    blocks: [
      {
        h: "La version courte",
        p: "Tout ce que TradeVault stocke dans votre navigateur sert soit à faire fonctionner l'application, soit à retenir un choix que vous avez fait. Rien ne sert à vous suivre sur d'autres sites, et rien n'est transmis à un annonceur.",
      },
      {
        h: "Strictement nécessaires",
        list: [
          "Votre session : le jeton qui vous garde connecté d'une visite à l'autre, émis par l'authentification Supabase. L'effacer vous déconnecte.",
          "L'avis cookies : retient que vous l'avez vu, pour ne pas le réafficher.",
        ],
      },
      {
        h: "Vos préférences",
        list: [
          "La langue de l'interface, et celle du site vitrine, conservées séparément - les deux sont indépendantes, délibérément.",
          "Votre thème et ses couleurs résolues, pour que l'application s'affiche dans les bonnes couleurs dès la première image.",
          "Les notifications déjà montrées aujourd'hui, pour ne pas répéter la même.",
          "Le travail en cours : un trade à moitié saisi, une conversation Jarvis ouverte. Stocké par compte sur cet appareil, pour que deux personnes partageant un navigateur ne voient jamais les brouillons de l'autre.",
        ],
      },
      {
        h: "Cache de courte durée",
        p: "Le calendrier économique de la semaine consultée est gardé le temps de l'onglet, pour ne pas le retélécharger en revenant sur la page. Il disparaît à la fermeture de l'onglet.",
      },
      {
        h: "Tiers",
        p: "Stripe et Coinbase Commerce déposent leurs propres cookies sur leurs propres pages de paiement, lorsque vous vous y rendez pour payer. Google peut en déposer sur sa page de connexion si vous utilisez la connexion Google. Ni l'un ni l'autre n'intervient sur TradeVault même. Nous n'installons aucune balise de mesure d'audience, aucun pixel publicitaire et aucun widget social.",
      },
      {
        h: "Refuser et effacer",
        p: "Effacer les données de navigation de ce site supprime l'ensemble. Les préférences reviennent à leurs valeurs par défaut et vous êtes déconnecté ; rien de ce qui est enregistré dans votre compte n'est touché. Se déconnecter de TradeVault purge par ailleurs les clés de thème de l'appareil.",
      },
      {
        h: "Contact",
        p: `Questions sur cette page : ${SUPPORT_EMAIL}`,
      },
    ],
  },
};

/* ══════════════════════ CGU ══════════════════════ */
/**
 * LES CGU NE SONT PAS UN DOUBLON DES CONDITIONS.
 *
 * Elles l'étaient : deux documents disaient la même chose, l'un en français
 * seulement, et ils se contredisaient sur la facturation. Un visiteur qui
 * ouvrait les deux ne pouvait pas savoir lequel l'engageait.
 *
 * Elles gardent leur raison d'être — l'usage attend ce nom et cette adresse
 * dans l'espace francophone — mais elles renvoient désormais explicitement
 * aux Conditions pour le fond, et ne détaillent que ce qui leur est propre :
 * l'accès, les règles d'usage, et les mentions qui manquent encore.
 *
 * La version anglaise existe parce que le pied de page lie ce document dans
 * les deux langues : lier « General Terms » et servir du français serait le
 * même défaut que celui qu'on vient de corriger ailleurs.
 */
const cguByLang: Partial<Record<Lang, LegalDoc>> = {
  en: {
    title: "General Terms of Use",
    updated: UPDATED_EN,
    intro:
      "This document covers access to and use of the service. The commercial terms - plans, billing, cancellation, liability - are in the Terms of Service, and they prevail in case of any difference.",
    blocks: [
      {
        h: "1. Scope",
        p: "These general terms apply to anyone who opens the site or uses the application, with or without an account. Using the service means accepting them.",
      },
      {
        h: "2. Access",
        p: "Consultation of the public pages is open. Everything else requires an account. Access to certain analysis pages depends on the plan in force on your account; the pricing page lists which.",
      },
      {
        h: "3. Rules of use",
        list: [
          "One person, one account. An account is not transferable.",
          "Do not attempt to reach data that is not yours, nor to bypass a plan restriction.",
          "Do not automate access in a way that degrades the service for others.",
          "Do not upload unlawful content or content infringing third-party rights.",
        ],
      },
      {
        h: "4. Content you upload",
        p: "You keep ownership of your trades, notes and screenshots. You grant us only what is technically necessary to store them and display them back to you. We use no user content for promotion without explicit permission.",
      },
      {
        h: "5. Availability",
        p: "The service is provided as is. Maintenance, an incident at a provider, or a security measure can interrupt it without notice. No availability level is guaranteed.",
      },
      {
        h: "6. No financial advice",
        p: "TradeVault issues no investment advice, no buy or sell recommendation, and no market prediction. What Jarvis produces are observations on your own data.",
      },
      {
        h: "7. Personal data",
        p: "Handled in the Privacy Policy, and the use of browser storage in the Cookies page. Both are linked at the bottom of this page.",
      },
      {
        h: "8. Legal notices still missing",
        p: "This product is published by an individual and no legal entity is constituted yet. Company name, registered address, company number, applicable law and competent court will be published here as soon as they exist. We would rather state the gap than fill it with something untrue.",
      },
      {
        h: "9. Contact",
        p: `For anything concerning these terms: ${SUPPORT_EMAIL}`,
      },
    ],
  },
  fr: {
    title: "Conditions Générales d'Utilisation",
    updated: UPDATED_FR,
    intro:
      "Ce document couvre l'accès au service et son usage. Les conditions commerciales - offres, facturation, résiliation, responsabilité - sont dans les Conditions d'utilisation, et elles priment en cas de différence.",
    blocks: [
      {
        h: "1. Champ d'application",
        p: "Les présentes conditions générales s'appliquent à toute personne qui ouvre le site ou utilise l'application, avec ou sans compte. Utiliser le service vaut acceptation.",
      },
      {
        h: "2. Accès",
        p: "La consultation des pages publiques est libre. Tout le reste demande un compte. L'accès à certaines pages d'analyse dépend de l'offre en cours sur votre compte ; la page des tarifs indique lesquelles.",
      },
      {
        h: "3. Règles d'usage",
        list: [
          "Une personne, un compte. Un compte n'est pas cessible.",
          "Ne pas tenter d'accéder à des données qui ne sont pas les vôtres, ni de contourner une restriction d'offre.",
          "Ne pas automatiser l'accès d'une manière qui dégrade le service pour les autres.",
          "Ne pas téléverser de contenu illégal ou portant atteinte aux droits d'un tiers.",
        ],
      },
      {
        h: "4. Les contenus que vous téléversez",
        p: "Vous restez propriétaire de vos trades, notes et captures d'écran. Vous ne nous accordez que ce qui est techniquement nécessaire pour les stocker et vous les réafficher. Aucun contenu utilisateur n'est utilisé à des fins promotionnelles sans autorisation explicite.",
      },
      {
        h: "5. Disponibilité",
        p: "Le service est fourni en l'état. Une maintenance, un incident chez un prestataire ou une mesure de sécurité peuvent l'interrompre sans préavis. Aucun niveau de disponibilité n'est garanti.",
      },
      {
        h: "6. Aucun conseil financier",
        p: "TradeVault n'émet aucun conseil en investissement, aucune recommandation d'achat ou de vente, et aucune prédiction de marché. Ce que produit Jarvis sont des observations sur vos propres données.",
      },
      {
        h: "7. Données personnelles",
        p: "Traitées dans la Politique de confidentialité, et l'usage du stockage navigateur dans la page Cookies. Les deux sont liées en bas de cette page.",
      },
      {
        h: "8. Mentions légales encore manquantes",
        p: "Ce produit est édité par une personne physique et aucune société n'est encore constituée. Raison sociale, siège, numéro d'entreprise, droit applicable et tribunal compétent seront publiés ici dès qu'ils existeront. Nous préférons signaler ce manque plutôt que de le combler par une mention inexacte.",
      },
      {
        h: "9. Contact",
        p: `Pour toute question relative aux présentes : ${SUPPORT_EMAIL}`,
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

export function getCguDoc(lang: Lang): LegalDoc {
  return cguByLang[lang] ?? cguByLang.en!;
}

export function getCookiesDoc(lang: Lang): LegalDoc {
  return cookiesByLang[lang] ?? cookiesByLang.en!;
}
