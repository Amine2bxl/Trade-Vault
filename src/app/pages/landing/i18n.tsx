import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Langue de la landing page — détectée depuis le navigateur.
 *
 * Règle : on suit la langue de base du navigateur (`navigator.language`).
 *   - commence par « fr » → français
 *   - commence par « en » → anglais
 *   - toute autre valeur (es, de, it, inconnue ou indétectable) → anglais
 *
 * L'utilisateur peut basculer manuellement (persisté en localStorage) ; la
 * détection ne s'exécute qu'une fois, au premier rendu. Le contexte partage
 * l'état entre tous les composants de la landing (nav + sections).
 */

export type LandingLang = "en" | "fr";
export type LandingKey = keyof typeof M;

const STORAGE_KEY = "tv.landing.lang";

function detectBrowserLang(): LandingLang {
  if (typeof navigator === "undefined") return "en";
  const nav = (navigator.language || "").toLowerCase();
  if (nav.startsWith("fr")) return "fr";
  if (nav.startsWith("en")) return "en";
  return "en";
}

function readInitial(): LandingLang {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "fr" || stored === "en") return stored;
  } catch {
    /* storage indisponible — on retombe sur la détection */
  }
  return detectBrowserLang();
}

interface LandingLangCtx {
  lang: LandingLang;
  setLang: (l: LandingLang) => void;
  t: (k: LandingKey) => string;
}

const Ctx = createContext<LandingLangCtx | null>(null);

export function LandingLangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LandingLang>(readInitial);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: LandingLang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* best-effort */
    }
  }, []);

  const value = useMemo<LandingLangCtx>(
    () => ({ lang, setLang, t: (k) => tr(lang, k) }),
    [lang, setLang],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLandingT() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLandingT must be used within LandingLangProvider");
  return ctx;
}

/* ─────────────────────────── Dictionary ─────────────────────────── */

export interface Msg {
  en: string;
  fr: string;
}

const M: Record<string, Msg> = {
  /* nav */
  "nav.product": { en: "Product", fr: "Produit" },
  "nav.resources": { en: "Resources", fr: "Ressources" },
  "nav.problem": { en: "Problem", fr: "Problème" },
  "nav.features": { en: "Features", fr: "Fonctionnalités" },
  "nav.signin": { en: "Sign in", fr: "Se connecter" },
  "nav.cta": { en: "Start free", fr: "Essai gratuit" },
  "nav.cta.plan": { en: "Premium 14-day trial", fr: "Essai Premium 14 jours" },

  "nav.p.jarvis": { en: "Jarvis — AI Coach", fr: "Jarvis — Coach IA" },
  "nav.p.jarvis.d": {
    en: "A coach that reads every one of your trades.",
    fr: "Un coach qui lit chacun de tes trades.",
  },
  "nav.p.discipline": { en: "Discipline OS", fr: "Discipline OS" },
  "nav.p.discipline.d": {
    en: "Checklist, Risk Guard, discipline before every trade.",
    fr: "Checklist, Risk Guard, discipline avant chaque trade.",
  },
  "nav.p.analytics": { en: "Analytics", fr: "Analytics" },
  "nav.p.analytics.d": {
    en: "20+ metrics on your real data.",
    fr: "20+ métriques sur tes données réelles.",
  },
  "nav.p.journal": { en: "Journal", fr: "Journal" },
  "nav.p.journal.d": {
    en: "Every trade logged in 45 seconds.",
    fr: "Chaque trade enregistré en 45 secondes.",
  },
  "nav.r.demo": { en: "Demo", fr: "Démo" },
  "nav.r.demo.d": { en: "See the app in action.", fr: "Vois l'app en action." },
  "nav.r.pricing": { en: "Pricing", fr: "Tarifs" },
  "nav.r.pricing.d": { en: "Free or Pro, no commitment.", fr: "Free ou Pro, sans engagement." },
  "nav.r.faq": { en: "FAQ", fr: "FAQ" },
  "nav.r.faq.d": { en: "Answers to your questions.", fr: "Les réponses à tes questions." },

  /* hero */
  "hero.eyebrow": {
    en: "TradeVault · The AI coach for traders",
    fr: "TradeVault · Le coach IA des traders",
  },
  "hero.h1a": { en: "Trade better.", fr: "Trade better." },
  "hero.h1b": { en: "Understand why.", fr: "Understand why." },
  "hero.sub": {
    en: "TradeVault reads your trades, spots the mistakes you keep repeating, and tells you exactly what to fix. Built for intraday and futures traders.",
    fr: "TradeVault lit tes trades, détecte les erreurs que tu répètes et te dit exactement quoi corriger. Conçu pour les traders intraday et futures.",
  },
  "hero.cta": { en: "Start free", fr: "Commencer gratuitement" },
  "hero.demo": { en: "or watch a 2-min demo", fr: "ou regarde une démo de 2 min" },
  "hero.t1": { en: "No credit card", fr: "Sans carte bancaire" },
  "hero.t2": { en: "Cancel in 1 click", fr: "Annulation en 1 clic" },
  "hero.t3": { en: "Set up in 2 min", fr: "Setup en 2 min" },
  "hero.google": {
    en: "Google sign-in is only used to create your TradeVault account securely and sync your data across devices.",
    fr: "La connexion Google sert uniquement à créer ton compte TradeVault en toute sécurité et à synchroniser tes données sur tous tes appareils.",
  },
  "hero.trust": { en: "Verified reviews on", fr: "Avis vérifiés sur" },

  /* hero product visual */
  "hero.eq": { en: "Equity curve", fr: "Courbe de capital" },
  "hero.winrate": { en: "Win rate", fr: "Réussite" },
  "hero.pf": { en: "Profit Factor", fr: "Profit Factor" },
  "hero.sharpe": { en: "Sharpe", fr: "Sharpe" },
  "hero.coach": { en: "AI Coach", fr: "Coach IA" },
  "hero.coach.tip": { en: "You overtrade after a loss.", fr: "Tu surtrades après une perte." },
  "hero.coach.action": { en: "Cap it at 3 setups tomorrow.", fr: "Limite à 3 setups demain." },
  "hero.pattern": { en: "Pattern detected", fr: "Pattern détecté" },
  "hero.pattern.tip": {
    en: "Your VWAP setups: 71% win rate.",
    fr: "Tes setups VWAP : 71% de réussite.",
  },

  /* platforms */
  "platforms.label": { en: "Import from your platforms", fr: "Importe depuis tes plateformes" },

  /* problem */
  "problem.tag": { en: "The real problem", fr: "Le vrai problème" },
  "problem.title.a": { en: "It's not your strategy", fr: "Ce n'est pas ta stratégie" },
  "problem.title.b": { en: "that makes you lose.", fr: "qui te fait perdre." },
  "problem.sub": {
    en: "It's the lack of memory and feedback. Three symptoms you know:",
    fr: "C'est l'absence de mémoire et de feedback. Trois symptômes que tu connais :",
  },
  "problem.p1.t": { en: "You repeat the same mistakes", fr: "Tu répètes les mêmes erreurs" },
  "problem.p1.d": {
    en: "Without structured memory, the same mistake comes back — and costs money.",
    fr: "Sans mémoire structurée, la même erreur revient — et coûte cher.",
  },
  "problem.p2.t": { en: "You trade on emotion", fr: "Tu trades sous émotion" },
  "problem.p2.d": {
    en: "FOMO, revenge trading, feel-based sizing. Emotion kills more accounts than bad setups.",
    fr: "FOMO, revenge trading, sizing au feeling. L'émotion détruit plus de comptes que les mauvais setups.",
  },
  "problem.p3.t": { en: "You don't know why you lose", fr: "Tu ne sais pas pourquoi tu perds" },
  "problem.p3.d": {
    en: "No data, no diagnosis. You change strategy at random.",
    fr: "Pas de data, pas de diagnostic. Tu changes de stratégie au hasard.",
  },

  /* journey */
  "journey.tag": { en: "The journey", fr: "Le parcours" },
  "journey.title.a": { en: "From raw trades to", fr: "De tes trades bruts à de" },
  "journey.title.b": { en: "better decisions.", fr: "meilleures décisions." },
  "journey.sub": {
    en: "TradeVault turns your history into actionable intelligence — not just numbers.",
    fr: "TradeVault transforme ton historique en intelligence actionnable — pas seulement des chiffres.",
  },
  "journey.s1.t": { en: "Trades", fr: "Trades" },
  "journey.s1.d": { en: "You log in 45s", fr: "Tu journalises en 45 s" },
  "journey.s2.t": { en: "Data", fr: "Data" },
  "journey.s2.d": { en: "20+ metrics computed", fr: "20+ métriques calculées" },
  "journey.s3.t": { en: "Patterns", fr: "Patterns" },
  "journey.s3.d": { en: "Recurring patterns detected", fr: "Schémas récurrents détectés" },
  "journey.s4.t": { en: "Insights", fr: "Insights" },
  "journey.s4.d": { en: "The coach names your biases", fr: "Le coach nomme tes biais" },
  "journey.s5.t": { en: "Decisions", fr: "Décisions" },
  "journey.s5.d": { en: "You fix, you improve", fr: "Tu corriges, tu progresses" },

  /* ai */
  "ai.tag": { en: "The solution", fr: "La solution" },
  "ai.title.a": { en: "An AI coach who knows", fr: "Un coach IA qui connaît" },
  "ai.title.b": { en: "every one of your trades.", fr: "chacun de tes trades." },
  "ai.sub": {
    en: "It reads your real history, spots what costs you money and tells you exactly what to fix.",
    fr: "Il lit ton historique réel, détecte ce qui te coûte et te dit exactement quoi corriger.",
  },
  "ai.head.a": { en: "A mentor who knows", fr: "Un mentor qui connaît" },
  "ai.head.b": { en: "every one of your trades.", fr: "chacun de tes trades." },
  "ai.body": {
    en: "Ask a question. The coach draws on your history — no generalities, only the concrete.",
    fr: "Pose une question. Le coach puise dans ton historique — pas de généralités, que du concret.",
  },
  "ai.b1": { en: "Answers based on your real data", fr: "Réponses basées sur tes vraies données" },
  "ai.b2": { en: "Diagnosis in seconds", fr: "Diagnostic en quelques secondes" },
  "ai.b3": { en: "Action plans, not theory", fr: "Plans d'action, pas de théorie" },
  "ai.f1.t": { en: "Answers about YOUR trades", fr: "Des réponses sur TES trades" },
  "ai.f1.d": {
    en: "Ask anything. The coach answers from your real history.",
    fr: "Pose ta question. Le coach répond à partir de ton historique réel.",
  },
  "ai.f2.t": { en: "Your patterns, auto-detected", fr: "Tes schémas, détectés seuls" },
  "ai.f2.d": {
    en: "Hours, setups, recurring mistakes: the AI flags them.",
    fr: "Heures, setups, erreurs récurrentes : l'IA les repère et t'alerte.",
  },
  "ai.f3.t": { en: "Your biases, exposed", fr: "Tes biais, mis à nu" },
  "ai.f3.d": {
    en: "Overtrading, drifting sizing… the coach names what costs you.",
    fr: "Overtrading, sizing qui dérape… le coach nomme ce qui te coûte.",
  },

  /* ai conversation */
  "ai.c.title": { en: "TradeVault AI Coach", fr: "TradeVault Coach IA" },
  "ai.c.sub": { en: "Analyzing 248 trades · live", fr: "Analyse de 248 trades · en direct" },
  "ai.c.active": { en: "Active", fr: "Actif" },
  "ai.c.q": {
    en: "Why do I lose money on Fridays?",
    fr: "Pourquoi je perds de l'argent le vendredi ?",
  },
  "ai.c.a": {
    en: "Your win rate drops to 38% on Fridays (vs 64% midweek): you increase position size by +42% after a losing start to the week.",
    fr: "Ton win rate chute à 38% le vendredi (vs 64% en semaine) : tu augmentes ta taille de position de +42% après un début de semaine perdant.",
  },
  "ai.c.plan": { en: "Recommended plan", fr: "Plan recommandé" },
  "ai.c.plan.d": {
    en: "Friday: fixed size, max 2 trades, stop after 1 loss.",
    fr: "Vendredi : taille fixe, max 2 trades, stop après 1 perte.",
  },

  /* stats */

  /* features */
  "features.tag": { en: "Features", fr: "Fonctionnalités" },
  "features.title.a": { en: "Everything to", fr: "Tout pour" },
  "features.title.b": { en: "improve.", fr: "progresser." },
  "features.title.c": { en: "Nothing useless.", fr: "Rien d'inutile." },
  "features.sub": {
    en: "Each tool serves one thing: better decisions, trade after trade.",
    fr: "Chaque outil sert une seule chose : de meilleures décisions, trade après trade.",
  },
  "features.cta": { en: "Unlock everything free", fr: "Tout débloquer gratuitement" },
  "features.cta.sub": {
    en: "14 days Premium · no credit card",
    fr: "14 jours Premium · sans carte bancaire",
  },

  /* bento */
  "bento.jarvis.t": { en: "Jarvis, your AI coach", fr: "Jarvis, ton coach IA" },
  "bento.jarvis.d": {
    en: "A coach that reads every one of your trades and tells you exactly what to fix.",
    fr: "Un coach qui lit chacun de tes trades et te dit exactement quoi corriger.",
  },
  "bento.jarvis.pattern": { en: "Pattern detected:", fr: "Pattern détecté :" },
  "bento.jarvis.msg": {
    en: "your losses are 2.4× larger after 2 wins. Overconfidence.",
    fr: "tes pertes sont 2.4× plus grandes après 2 gains. Excès de confiance.",
  },
  "bento.jarvis.q": { en: "How do I fix that tomorrow?", fr: "Comment je corrige ça demain ?" },
  "bento.jarvis.mission": { en: "Today's mission", fr: "Mission du jour" },
  "bento.jarvis.mission.d": {
    en: "2 trades max · stop after 1 loss",
    fr: "2 trades max · stop après 1 perte",
  },
  "bento.errors.t": { en: "Mistakes detected", fr: "Erreurs détectées" },
  "bento.errors.d": {
    en: "TradeVault automatically spots what costs you money.",
    fr: "TradeVault repère automatiquement ce qui te coûte de l'argent.",
  },
  "bento.errors.thismonth": { en: "this month", fr: "ce mois-ci" },
  "bento.edge.t": { en: "Edge Score", fr: "Edge Score" },
  "bento.edge.d": {
    en: "A score that tells you if you're ready to trade.",
    fr: "Un score qui te dit si tu es prêt à trader.",
  },
  "bento.edge.ready": { en: "Ready to trade", fr: "Ready to trade" },
  "bento.analytics.t": { en: "Pro analytics", fr: "Analytics pro" },
  "bento.analytics.d": {
    en: "20+ metrics computed on your real data.",
    fr: "20+ métriques calculées sur tes données réelles.",
  },
  "bento.progress.t": { en: "Your progress", fr: "Ta progression" },
  "bento.progress.d": {
    en: "Watch your capital grow and your discipline improve.",
    fr: "Vois ton capital évoluer et ta discipline s'améliorer.",
  },

  /* proof */
  "proof.title.a": { en: "Built by a trader,", fr: "Conçu par un trader," },
  "proof.title.b": { en: "for traders.", fr: "pour les traders." },
  "proof.body": {
    en: "TradeVault isn't another spreadsheet. It's the tool I wanted when I kept repeating mistakes without seeing them.",
    fr: "TradeVault n'est pas un tableur de plus. C'est l'outil que je voulais avoir quand je répétais les mêmes erreurs sans les voir.",
  },
  "proof.f1.v": { en: "20+", fr: "20+" },
  "proof.f1.l": { en: "metrics per trade", fr: "métriques calculées sur chaque trade" },
  "proof.f2.v": { en: "<10s", fr: "<10s" },
  "proof.f2.l": { en: "to import your history", fr: "pour importer tout ton historique" },
  "proof.f3.v": { en: "24/7", fr: "24/7" },
  "proof.f3.l": { en: "AI coach available", fr: "coach IA disponible" },
  "proof.quote": {
    en: "I built TradeVault because no journal told me why I was losing. It doesn't promise gains: it shows you what your data says, and lets you decide.",
    fr: "J'ai construit TradeVault parce qu'aucun journal ne me disait pourquoi je perdais. Il ne te promet pas de gains : il te montre ce que tes données disent, et te laisse décider.",
  },
  "proof.author": { en: "TradeVault's creator", fr: "Le créateur de TradeVault" },
  "proof.author.sub": { en: "Trader, and first user", fr: "Trader, et premier utilisateur" },
  "proof.cta.t": { en: "Ready to transform your trading?", fr: "Prêt à transformer ton trading ?" },
  "proof.cta.d": {
    en: "Open your journal, import your history, and see what comes out.",
    fr: "Ouvre ton journal, importe ton historique, et vois ce qu'il en sort.",
  },
  "proof.cta.p1": { en: "14-day free trial", fr: "Essai gratuit 14 jours" },
  "proof.cta.p2": {
    en: "Full access to all features",
    fr: "Accès complet à toutes les fonctionnalités",
  },
  "proof.cta.p3": { en: "AI coach + advanced analytics", fr: "Coach IA + analytics avancées" },
  "proof.cta.p4": {
    en: "No commitment, cancel in 1 click",
    fr: "Sans engagement, annulation en 1 clic",
  },
  "proof.cta.btn": { en: "Get started free", fr: "Commencer gratuitement" },

  /* trust strip */
  "trust.t1": { en: "Encrypted in transit and at rest", fr: "Chiffré, en transit et au repos" },
  "trust.d1": {
    en: "Payments via Stripe, cloud backups.",
    fr: "Paiements par Stripe, sauvegardes cloud.",
  },
  "trust.t2": { en: "No access to your broker", fr: "Aucun accès à ton courtier" },
  "trust.d2": {
    en: "TradeVault reads a file, never your account.",
    fr: "TradeVault lit un fichier, jamais ton compte.",
  },
  "trust.t3": { en: "Your data is yours", fr: "Tes données t'appartiennent" },
  "trust.d3": { en: "Full export, anytime.", fr: "Export complet, à tout moment." },

  /* pricing */
  "pricing.tag": { en: "Pricing", fr: "Tarifs" },
  "pricing.title": {
    en: "An investment that pays for itself in one trade",
    fr: "Un investissement qui se rembourse en un trade",
  },
  "pricing.sub": {
    en: "Start free. Go Premium when you're ready.",
    fr: "Commence gratuitement. Passe Premium quand tu es prêt.",
  },
  "pricing.save": {
    // Pas de montant en dur : l'économie dépend de l'offre choisie et elle est
    // affichée, exacte, sur chaque colonne de la grille.
    en: "2 months free on every yearly plan",
    fr: "2 mois offerts sur chaque offre annuelle",
  },
  "pricing.free": { en: "Free", fr: "Free" },
  "pricing.free.price": { en: "€0", fr: "0 €" },
  "pricing.free.per": { en: "/ forever", fr: "/ toujours" },
  "pricing.free.d": {
    en: "To log your trades and lay the foundations.",
    fr: "Pour noter tes trades et poser les bases.",
  },
  "pricing.free.btn": { en: "Start free", fr: "Commencer gratuitement" },
  "pricing.f1": {
    en: "Trading journal — 30 trades / month",
    fr: "Journal de trading — 30 trades / mois",
  },
  "pricing.f2": { en: "Dashboard & equity curve", fr: "Dashboard & courbe d'equity" },
  "pricing.f3": { en: "Pre-market checklist", fr: "Checklist pré-market" },
  "pricing.f4": {
    en: "Basic stats (P&L, win rate, R)",
    fr: "Statistiques de base (P&L, win rate, R)",
  },
  "pricing.notincluded": { en: "Not included", fr: "Pas inclus" },
  "pricing.m1": { en: "Jarvis AI coach", fr: "Coach IA Jarvis" },
  "pricing.m2": { en: "Automatic CSV import", fr: "Import CSV automatique" },
  "pricing.m3": { en: "Advanced quantitative analytics", fr: "Analytics quantitatives avancées" },
  "pricing.m4": { en: "Automatic monthly reports", fr: "Rapports mensuels automatiques" },
  "pricing.pro.year": { en: "Pro · Yearly", fr: "Pro · Annuel" },
  "pricing.pro.badge": { en: "2 months free", fr: "2 mois offerts" },
  "pricing.pro.per": { en: "/ month", fr: "/ mois" },
  "pricing.pro.billed": { en: "billed once a year", fr: "facturés une fois par an" },
  "pricing.pro.save": { en: "saved / year", fr: "/ an économisés" },
  "pricing.pro.btn": { en: "Start — 14 days free", fr: "Démarrer — 14 jours gratuits" },
  "pricing.pro.note": {
    en: "No commitment · No card required",
    fr: "Sans engagement · Sans carte requise",
  },
  "pricing.pro.all": {
    en: "Everything in Free, unlimited — plus:",
    fr: "Tout le plan Free, sans limite — et :",
  },
  "pricing.pro.pf1": {
    en: "Jarvis AI coach, unlimited 24/7",
    fr: "Coach IA Jarvis, illimité 24h/24",
  },
  "pricing.pro.pf1d": {
    en: "Reads YOUR trades and tells you what to fix.",
    fr: "Il lit TES trades et te dit quoi corriger.",
  },
  "pricing.pro.pf2": {
    en: "Unlimited trades + accounts",
    fr: "Trades illimités + comptes illimités",
  },
  "pricing.pro.pf2d": {
    en: "Prop firm, demo, live — each separate.",
    fr: "Prop firm, démo, réel — chacun séparé.",
  },
  "pricing.pro.pf3": {
    en: "Quantitative analytics (20+ metrics)",
    fr: "Analytics quantitatives (20+ métriques)",
  },
  "pricing.pro.pf3d": {
    en: "Drawdown, expectancy, seasonality.",
    fr: "Drawdown, expectancy, saisonnalité.",
  },
  "pricing.pro.pf4": {
    en: "Mistake & missed-setup tracking",
    fr: "Suivi des erreurs & setups manqués",
  },
  "pricing.pro.pf4d": {
    en: "The real cost of every bad habit.",
    fr: "Le coût réel de chaque mauvaise habitude.",
  },
  "pricing.pro.pf5": {
    en: "Unlimited automatic CSV import",
    fr: "Import CSV automatique illimité",
  },
  "pricing.pro.pf5d": {
    en: "Your full history in seconds.",
    fr: "Ton historique complet en quelques secondes.",
  },
  "pricing.pro.pf6": { en: "Automatic monthly reports", fr: "Rapports mensuels automatiques" },
  "pricing.pro.pf6d": {
    en: "Your written review, with no effort.",
    fr: "Ton bilan écrit, sans rien faire.",
  },
  "pricing.pro.pf7": {
    en: "Position calculator & ⌘K palette",
    fr: "Calculateur de position & palette ⌘K",
  },
  "pricing.pro.pf7d": { en: "The daily grind, friction-free.", fr: "Le quotidien, sans friction." },
  "pricing.pro.pf8": { en: "Priority support", fr: "Support prioritaire" },
  "pricing.pro.pf8d": { en: "A real answer, fast.", fr: "Une vraie réponse, vite." },
  "pricing.monthly": { en: "Pro · Monthly", fr: "Pro · Mensuel" },
  "pricing.monthly.d": {
    en: "Same features as yearly — only the billing changes.",
    fr: "Mêmes fonctionnalités que l'annuel — seule la facturation change.",
  },
  "pricing.monthly.btn": { en: "Go monthly", fr: "Prendre au mois" },
  "pricing.trust1": { en: "14 days free", fr: "14 jours gratuits" },
  "pricing.trust2": { en: "Secure Stripe payment", fr: "Paiement Stripe sécurisé" },
  "pricing.trust3": { en: "Cancel in 1 click", fr: "Annulation en 1 clic" },
  "pricing.trust4": { en: "Exportable data", fr: "Données exportables" },

  /* faq */
  "faq.tag": { en: "FAQ", fr: "FAQ" },
  "faq.title": { en: "Everything you need to know", fr: "Tout ce que tu dois savoir" },
  "faq.q1": {
    en: "How is it better than a simple journal?",
    fr: "En quoi c'est mieux qu'un simple journal ?",
  },
  "faq.a1": {
    en: "A journal records. TradeVault understands: it analyzes your data, spots your patterns and tells you what to fix.",
    fr: "Un journal enregistre. TradeVault comprend : il analyse tes données, détecte tes schémas et te dit quoi corriger.",
  },
  "faq.q2": {
    en: "Is the free trial really commitment-free?",
    fr: "L'essai gratuit est-il vraiment sans engagement ?",
  },
  "faq.a2": {
    en: "Yes. 14 days of full Premium, no credit card. Cancel in 1 click.",
    fr: "Oui. 14 jours d'accès Premium complet, sans carte bancaire. Annulation en 1 clic.",
  },
  "faq.q3": {
    en: "Is my trading data secure?",
    fr: "Mes données de trading sont-elles sécurisées ?",
  },
  "faq.a3": {
    en: "Encrypted in transit and at rest. Stripe payments. We never touch your broker account.",
    fr: "Chiffrées en transit et au repos. Paiements Stripe. On ne touche jamais à ton compte de courtage.",
  },
  "faq.q4": {
    en: "Can I import my existing history?",
    fr: "Puis-je importer mon historique existant ?",
  },
  "faq.a4": {
    en: "Yes. Import a CSV from your broker, TradeVault structures it automatically.",
    fr: "Oui. Importe un CSV depuis ton courtier, TradeVault structure tout automatiquement.",
  },

  /* final cta */
  "cta.countdown": { en: "Markets open in", fr: "Ouverture des marchés dans" },
  "cta.title.a": { en: "Your next trade deserves", fr: "Ton prochain trade mérite" },
  "cta.title.b": { en: "a real coach.", fr: "un vrai coach." },
  "cta.sub": {
    en: "TradeVault doesn't just record your trades. It understands them, spots your patterns and tells you what to fix.",
    fr: "TradeVault ne se contente pas d'enregistrer tes trades. Il les comprend, détecte tes schémas et te dit quoi corriger.",
  },
  "cta.btn": { en: "Get started free", fr: "Commencer gratuitement" },
  "cta.note": {
    en: "14 days Premium · No credit card · Cancel in 1 click",
    fr: "14 jours Premium · Sans carte bancaire · Annulation en 1 clic",
  },

  /* footer */
  "footer.tagline": {
    en: "The trader's intelligent cockpit. Journal, analytics, AI coach.",
    fr: "Le cockpit intelligent du trader. Journal, analytics, Coach IA.",
  },
  "footer.product": { en: "Product", fr: "Produit" },
  "footer.resources": { en: "Resources", fr: "Ressources" },
  "footer.f1": { en: "Features", fr: "Fonctionnalités" },
  "footer.f2": { en: "Pricing", fr: "Tarifs" },
  "footer.f3": { en: "Integrations", fr: "Intégrations" },
  "footer.f4": { en: "Changelog", fr: "Changelog" },
  "footer.r1": { en: "Documentation", fr: "Documentation" },
  "footer.r2": { en: "Blog", fr: "Blog" },
  "footer.r3": { en: "Support", fr: "Support" },
  "footer.r4": { en: "Contact", fr: "Contact" },
  "footer.rights": {
    en: "© 2026 TradeVault. All rights reserved.",
    fr: "© 2026 TradeVault. Tous droits réservés.",
  },
  "footer.privacy": { en: "Privacy", fr: "Confidentialité" },
  "footer.terms": { en: "Terms", fr: "CGU" },
  "footer.cookies": { en: "Cookies", fr: "Cookies" },
};

export function tr(lang: LandingLang, key: LandingKey): string {
  const m = M[key];
  if (!m) return key;
  return m[lang] ?? m.en;
}
