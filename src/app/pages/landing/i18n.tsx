import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Langue de la landing page.
 *
 * Règle : l'ANGLAIS est la langue par défaut, pour tout le monde, quelle que
 * soit la langue du navigateur. La vitrine ne passe en français que lorsque le
 * visiteur le choisit EXPLICITEMENT via le sélecteur EN/FR (persisté dans
 * `localStorage`). Pas de détection navigateur : un navigateur en espagnol ou
 * en allemand ne doit pas basculer la page de vente dans une langue non
 * couverte — et un navigateur francophone voit une vitrine anglaise, comme
 * l'app une fois connectée.
 *
 * `preferredLang()` n'est PLUS appelée pendant le rendu — uniquement depuis
 * l'effet de mise en page, donc côté navigateur uniquement.
 */

// La langue servie vit dans `shared/lang.ts` — un module sans dépendance, pour
// que `__root.tsx` puisse la lire sans traîner tout ce dictionnaire dans le
// chunk d'entrée de chaque route. Réexportée ici par commodité.
export { SSR_LANG } from "@/shared/lang";
import { SSR_LANG, FR_PREFIX } from "@/shared/lang";

/** `useLayoutEffect` côté navigateur, `useEffect` côté serveur — où il ne
 *  s'exécute de toute façon pas, mais où React avertirait à chaque rendu. */
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type LandingLang = "en" | "fr";
export type LandingKey = keyof typeof M;

const STORAGE_KEY = "tv.landing.lang";

/**
 * La langue voulue par CE visiteur : son choix explicite s'il en a fait un
 * (sélecteur EN/FR, persisté en localStorage), sinon l'anglais — la langue
 * PAR DÉFAUT de la vitrine. Aucune détection navigateur.
 *
 * N'est PLUS appelée pendant le rendu — uniquement depuis l'effet de mise en
 * page, donc côté navigateur uniquement.
 */
function preferredLang(): LandingLang {
  if (typeof window === "undefined") return SSR_LANG;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "fr" || stored === "en") return stored;
  } catch {
    /* storage indisponible — on retombe sur l'anglais */
  }
  return "en";
}

interface LandingLangCtx {
  lang: LandingLang;
  setLang: (l: LandingLang) => void;
  t: (k: LandingKey) => string;
}

const Ctx = createContext<LandingLangCtx | null>(null);

/**
 * `pinned` — la langue imposée par l'URL, quand il y en a une.
 *
 * `/fr` sert la vitrine française au SSR (voir `shared/lang.ts`). Sur cette
 * route, l'ADRESSE est la source de vérité, pas la préférence enregistrée : un
 * visiteur qui arrive depuis un résultat de recherche français doit lire du
 * français, même si son localStorage garde « en » d'une visite précédente.
 * Laisser la préférence gagner ferait diverger l'URL de son propre contenu —
 * et un moteur qui recrawle `/fr` y trouverait de l'anglais sous un
 * `hreflang="fr"`.
 *
 * Le sélecteur EN/FR NAVIGUE alors au lieu de basculer un état, pour que les
 * deux langues gardent chacune leur adresse.
 */
export function LandingLangProvider({
  children,
  pinned,
}: {
  children: ReactNode;
  pinned?: LandingLang;
}) {
  // Premier rendu IDENTIQUE des deux côtés — c'est ce qui supprime la
  // divergence d'hydratation.
  const [lang, setLangState] = useState<LandingLang>(pinned ?? SSR_LANG);

  // Avant la première peinture : on applique la langue du visiteur. Un
  // `useEffect` ordinaire s'exécuterait APRÈS, et le clignotement serait
  // simplement déplacé au lieu d'être supprimé.
  useIsomorphicLayoutEffect(() => {
    if (pinned) return;
    const wanted = preferredLang();
    if (wanted !== SSR_LANG) setLangState(wanted);
  }, [pinned]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback(
    (l: LandingLang) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, l);
      } catch {
        /* best-effort */
      }

      // CHANGER DE LANGUE CHANGE D'ADRESSE — maintenant que les deux langues en
      // ont chacune une (`/` en anglais, `/fr` en français).
      //
      // Le sélecteur basculait un état React à URL constante. Le visiteur
      // lisait donc du français à une adresse dont le canonical, l'`og:locale`
      // et le `<html lang>` annoncent tous l'anglais — et surtout, la page
      // qu'il venait de lire n'était PARTAGEABLE dans aucune des deux langues :
      // envoyer le lien à quelqu'un lui servait l'autre.
      //
      // Un rechargement complet plutôt qu'une navigation du routeur : ce qu'il
      // faut renouveler, c'est le DOCUMENT SERVI — titre, description,
      // canonical, `hreflang`, `<html lang>` — pas seulement l'arbre React.
      const routeLang = pinned ?? SSR_LANG;
      if (l !== routeLang && typeof window !== "undefined") {
        window.location.href = l === "fr" ? FR_PREFIX : "/";
        return;
      }
      setLangState(l);
    },
    [pinned],
  );

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
  // ── Modale d'authentification ───────────────────────────────────────────
  //
  // Elle était ENTIÈREMENT en français, sans passer par ce dictionnaire, alors
  // que la landing s'ouvre en anglais pour tout navigateur non francophone : un
  // visiteur anglophone traversait une page de vente anglaise et tombait sur un
  // formulaire français au moment exact de la conversion.
  "auth.brandTitle.signup": {
    en: "Start understanding your trading.",
    fr: "Commence à comprendre ton trading.",
  },
  "auth.brandTitle.login": { en: "Good to see you again.", fr: "Ravi de te revoir." },
  "auth.brandSub": {
    en: "Your AI coach reads your trades, spots your mistakes and helps you become the disciplined trader you want to be.",
    fr: "Ton coach IA analyse tes trades, détecte tes erreurs et t'aide à devenir le trader discipliné que tu veux être.",
  },
  "auth.promise1": {
    en: "Your trades analysed from day one",
    fr: "Analyse de tes trades dès le premier jour",
  },
  "auth.promise2": {
    en: "Your data stays exportable at any time",
    fr: "Tes données restent exportables à tout moment",
  },
  "auth.trustpilot": { en: "Verified reviews on", fr: "Avis vérifiés sur" },
  "auth.title.signup": { en: "Create your account", fr: "Créer ton compte" },
  "auth.title.login": { en: "Sign in", fr: "Se connecter" },
  "auth.sub.signup": {
    en: "Free forever. Go Premium when you decide to.",
    fr: "Gratuit pour toujours. Passe Premium quand tu le décides.",
  },
  "auth.sub.login": { en: "Pick up where you left off.", fr: "Reprends où tu t'es arrêté." },
  "auth.google": { en: "Continue with Google", fr: "Continuer avec Google" },
  "auth.orEmail": { en: "or with email", fr: "ou par e-mail" },
  "auth.name": { en: "Username", fr: "Nom d'utilisateur" },
  "auth.namePlaceholder": { en: "Alex Martin", fr: "Alex Martin" },
  "auth.email": { en: "Email", fr: "E-mail" },
  "auth.emailPlaceholder": { en: "name@example.com", fr: "nom@exemple.com" },
  "auth.password": { en: "Password", fr: "Mot de passe" },
  "auth.passwordPlaceholder": { en: "6+ characters", fr: "6+ caractères" },
  "auth.forgot": { en: "Forgot?", fr: "Oublié ?" },
  "auth.showPassword": { en: "Show password", fr: "Afficher le mot de passe" },
  "auth.hidePassword": { en: "Hide password", fr: "Masquer le mot de passe" },
  "auth.close": { en: "Close", fr: "Fermer" },
  "auth.submitting": { en: "One moment…", fr: "Un instant…" },
  "auth.submit.signup": { en: "Create my account", fr: "Créer mon compte" },
  "auth.submit.login": { en: "Sign in", fr: "Se connecter" },
  "auth.switch.toLogin": { en: "Already have an account?", fr: "Déjà un compte ?" },
  "auth.switch.toSignup": { en: "No account yet?", fr: "Pas encore de compte ?" },
  "auth.switchCta.login": { en: "Sign in", fr: "Se connecter" },
  "auth.switchCta.signup": { en: "Create an account", fr: "Créer un compte" },
  "auth.legal.prefix": {
    en: "By continuing, you accept our",
    fr: "En continuant, tu acceptes nos",
  },
  "auth.legal.terms": { en: "Terms", fr: "Conditions" },
  "auth.legal.and": { en: "and our", fr: "et notre" },
  "auth.legal.privacy": { en: "Privacy Policy", fr: "Politique de confidentialité" },
  "auth.err.needEmail": {
    en: "Enter your email to receive the reset link.",
    fr: "Entre ton e-mail pour recevoir le lien de réinitialisation.",
  },
  "auth.info.resetSent": {
    en: "Reset link sent. Check your inbox.",
    fr: "Lien de réinitialisation envoyé. Vérifie ta boîte mail.",
  },
  "nav.product": { en: "Product", fr: "Produit" },
  "nav.resources": { en: "Resources", fr: "Ressources" },
  "nav.problem": { en: "Problem", fr: "Problème" },
  "nav.features": { en: "Features", fr: "Fonctionnalités" },
  "nav.analytics": { en: "Analytics", fr: "Analytics" },
  "nav.alternative": { en: "Excel vs Notion", fr: "Excel vs Notion" },
  "nav.signin": { en: "Sign in", fr: "Se connecter" },
  "nav.cta": { en: "Start free", fr: "Commencer gratuitement" },
  "nav.cta.plan": { en: "Start free", fr: "Commencer gratuitement" },

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
  "hero.h1a": { en: "Your trades already contain", fr: "Tes trades contiennent déjà" },
  "hero.h1b": { en: "the answer.", fr: "la réponse." },
  "hero.sub": {
    en: "TradeVault is an AI trading journal that reads your history, surfaces the patterns behind your results and turns raw data into a clear picture of your trading — so your next decision beats your last.",
    fr: "TradeVault est un journal de trading à coach IA qui lit ton historique, fait remonter les tendances derrière tes résultats et transforme tes données brutes en une image claire de ton trading — pour que ta prochaine décision batte la précédente.",
  },
  "hero.cta": { en: "Start for free", fr: "Commencer gratuitement" },
  "hero.demo": { en: "or watch a 2-min demo", fr: "ou regarde une démo de 2 min" },
  "hero.t1": { en: "No credit card", fr: "Sans carte bancaire" },
  "hero.t2": { en: "Set up in 2 minutes", fr: "Prêt en 2 minutes" },
  "hero.t3": { en: "Cancel anytime", fr: "Sans engagement" },
  "hero.google": {
    en: "Google sign-in is only used to create your TradeVault account securely and sync your data across devices.",
    fr: "La connexion Google sert uniquement à créer ton compte TradeVault en toute sécurité et à synchroniser tes données sur tous tes appareils.",
  },
  "hero.trust": { en: "Verified reviews on", fr: "Avis vérifiés sur" },

  /* analytics */
  "analytics.title.a": { en: "Raw data in.", fr: "Données brutes in." },
  "analytics.title.b": { en: "Understanding out.", fr: "Compréhension out." },
  "analytics.sub": {
    en: "Twenty-plus metrics computed on your real history — an equity curve that tells the truth, drawdown you can measure, expectancy you can trust.",
    fr: "Plus de vingt métriques calculées sur ton historique réel — une courbe d'equity qui dit la vérité, un drawdown mesurable, une expectancy fiable.",
  },
  "analytics.c1.t": { en: "Equity curve", fr: "Courbe d'equity" },
  "analytics.c1.d": {
    en: "Your account trajectory, day by day.",
    fr: "La trajectoire de ton compte, jour après jour.",
  },
  "analytics.c2.t": { en: "Drawdown & recovery", fr: "Drawdown & récupération" },
  "analytics.c2.d": {
    en: "How deep a losing run goes, and how long to come back.",
    fr: "Jusqu'où va une série perdante, et le temps de revenir.",
  },
  "analytics.c3.t": { en: "Expectancy", fr: "Expectancy" },
  "analytics.c3.d": {
    en: "What each trade is really worth, in R.",
    fr: "Ce que vaut réellement chaque trade, en R.",
  },
  "analytics.c4.t": { en: "Win rate by hour, day & setup", fr: "Win rate par heure, jour & setup" },
  "analytics.c4.d": {
    en: "Where your edge lives — and where it dies.",
    fr: "Où vit ton edge — et où il meurt.",
  },

  /* mistakes / psychology */
  "mistakes.title.a": {
    en: "It's not about your win rate.",
    fr: "Ce n'est pas ton taux de réussite.",
  },
  "mistakes.title.b": { en: "It's about what costs you.", fr: "C'est ce qui te coûte." },
  "mistakes.sub": {
    en: "Your history can answer the questions you haven't asked it yet.",
    fr: "Ton historique peut répondre aux questions que tu ne lui as pas encore posées.",
  },
  "mistakes.q1": {
    en: "When do I actually trade well?",
    fr: "Quand est-ce que je trade vraiment bien ?",
  },
  "mistakes.q2": {
    en: "Which mistake costs me the most?",
    fr: "Quelle erreur me coûte le plus cher ?",
  },
  "mistakes.q3": { en: "What pattern keeps repeating?", fr: "Quel schéma ne cesse de revenir ?" },
  "mistakes.q4": {
    en: "Am I overtrading after a loss?",
    fr: "Est-ce que je surtrade après une perte ?",
  },

  /* use cases */
  "uses.title.a": { en: "Built for the way", fr: "Conçu pour la façon dont" },
  "uses.title.b": { en: "you actually trade.", fr: "tu trades réellement." },
  "uses.u1.t": { en: "Futures traders", fr: "Traders futures" },
  "uses.u1.d": {
    en: "Performance per contract, R-multiples, drawdown you can measure in ticks.",
    fr: "Performance par contrat, R-multiples, drawdown mesurable en ticks.",
  },
  "uses.u2.t": { en: "Day traders", fr: "Day traders" },
  "uses.u2.d": {
    en: "A daily review with Jarvis, so every session ends with a verdict.",
    fr: "Une revue quotidienne avec Jarvis, pour que chaque séance se termine par un verdict.",
  },
  "uses.u3.t": { en: "ICT traders", fr: "Traders ICT" },
  "uses.u3.d": {
    en: "Setup, confluences and the patterns you replay every day — tracked as data.",
    fr: "Setup, confluences et les patterns que tu rejoues chaque jour — suivis en données.",
  },

  /* excel / notion */
  "alt.title.a": {
    en: "Spreadsheets gave you freedom.",
    fr: "Les tableurs t'ont donné la liberté.",
  },
  "alt.title.b": {
    en: "They also gave you a full-time job.",
    fr: "Ils t'ont aussi donné un travail à temps plein.",
  },
  "alt.sub": {
    en: "The short version of it.",
    fr: "La version courte.",
  },
  "alt.h.excel": { en: "Excel", fr: "Excel" },
  "alt.h.notion": { en: "Notion", fr: "Notion" },
  "alt.h.tv": { en: "TradeVault", fr: "TradeVault" },
  "alt.excel.d": { en: "Flexible, but manual.", fr: "Flexible, mais manuel." },
  "alt.notion.d": {
    en: "Customizable, but not built for trading.",
    fr: "Personnalisable, mais pas conçu pour le trading.",
  },
  "alt.tv.d": {
    en: "Built around the trading workflow.",
    fr: "Construit autour du flux de travail du trader.",
  },
  "alt.r1": { en: "A trade logged in 45 seconds", fr: "Un trade journalisé en 45 secondes" },
  "alt.r2": {
    en: "Equity curve & drawdown out of the box",
    fr: "Courbe d'equity & drawdown prêts à l'emploi",
  },
  "alt.r3": { en: "Recurring-mistake analysis", fr: "Analyse des erreurs récurrentes" },
  "alt.r4": {
    en: "Jarvis, your AI coach, on your data",
    fr: "Jarvis, ton coach IA, sur tes données",
  },
  "alt.r5": {
    en: "R-multiples, expectancy, seasonality",
    fr: "R-multiples, expectancy, saisonnalité",
  },
  "alt.r6": { en: "Your data, exportable anytime", fr: "Tes données, exportables à tout moment" },

  /* cta final */
  "cta.title.a": {
    en: "Your trades already contain the data.",
    fr: "Tes trades contiennent déjà les données.",
  },
  "cta.title.b": {
    en: "TradeVault helps you understand it.",
    fr: "TradeVault t'aide à les comprendre.",
  },
  "cta.buttonShort": { en: "Start for free", fr: "Commencer gratuitement" },

  /* Captures d'écran du produit — voir `src/assets/product/README.md`.
     Le texte alternatif décrit L'ÉCRAN, jamais le résultat qu'on y voit :
     une capture montre le compte d'un trader, pas une promesse. */
  "shot.dashboard.alt": {
    en: "The TradeVault dashboard: equity curve, key stats and the day's trades.",
    fr: "Le tableau de bord TradeVault : courbe de capital, statistiques et trades du jour.",
  },
  "shot.dashboard.cap": { en: "The dashboard", fr: "Le tableau de bord" },
  "shot.reports.alt": {
    en: "The monthly report: month-by-month performance breakdown.",
    fr: "Le rapport mensuel : la performance détaillée mois par mois.",
  },
  "shot.reports.cap": { en: "Monthly reports", fr: "Les rapports mensuels" },

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

  /* platforms — les VRAIES portes d'entrée des trades (aucune prétention de
     synchro broker, il n'y a pas d'API : import CSV, copier-coller, saisie,
     démo). */
  "platforms.label": {
    en: "Your trades get in — instantly",
    fr: "Tes trades entrent — en un instant",
  },
  "platforms.i1": { en: "Universal CSV import", fr: "Import CSV universel" },
  "platforms.i2": { en: "Copy & paste", fr: "Copier-coller" },
  "platforms.i3": { en: "Quick logging", fr: "Saisie rapide" },
  "platforms.i4": { en: "Demo trades", fr: "Trades de démo" },

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
  "features.cta": { en: "Create my free account", fr: "Créer mon compte gratuit" },
  "features.cta.sub": {
    en: "Free forever · no credit card",
    fr: "Gratuit pour toujours · sans carte bancaire",
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
  "proof.cta.p1": { en: "Free plan, no time limit", fr: "Offre gratuite, sans limite de temps" },
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
    // Conservé pour d'éventuels usages hors grille. Aucun montant en dur : le
    // nombre de mois offerts est calculé depuis le catalogue et affiché sur la
    // bascule mensuel/annuel.
    en: "Months free on every yearly plan",
    fr: "Des mois offerts sur chaque offre annuelle",
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
  "pricing.pro.btn": { en: "Get started", fr: "Commencer" },
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
  "pricing.trust1": { en: "Free plan forever", fr: "Offre gratuite à vie" },
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
    en: "Is the free plan really free?",
    fr: "L'offre gratuite est-elle vraiment gratuite ?",
  },
  "faq.a2": {
    en: "Yes — no time limit, no credit card. Your journal, dashboard, calendar, checklist and plan stay free for good. Paid plans add the analysis tools.",
    fr: "Oui — sans limite de temps ni carte bancaire. Ton journal, ton tableau de bord, ton calendrier, ta checklist et ton plan restent gratuits pour toujours. Les offres payantes ajoutent les outils d'analyse.",
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
  "cta.sub": {
    en: "TradeVault doesn't just record your trades. It understands them, spots your patterns and tells you what to fix.",
    fr: "TradeVault ne se contente pas d'enregistrer tes trades. Il les comprend, détecte tes schémas et te dit quoi corriger.",
  },
  "cta.btn": { en: "Get started free", fr: "Commencer gratuitement" },
  "cta.note": {
    en: "Free plan forever · No credit card · Cancel in 1 click",
    fr: "Offre gratuite à vie · Sans carte bancaire · Annulation en 1 clic",
  },

  /* footer */
  "footer.tagline": {
    en: "The trader's intelligent cockpit. Journal, analytics, AI coach.",
    fr: "Le cockpit intelligent du trader. Journal, analytics, Coach IA.",
  },
  "footer.product": { en: "Product", fr: "Produit" },
  "footer.resources": { en: "Resources", fr: "Ressources" },
  /* LES LIENS DU PIED DE PAGE DÉSIGNENT DES CHOSES QUI EXISTENT.
   *
   * Ils annonçaient « Intégrations », « Changelog », « Documentation » et
   * « Blog » — quatre pages qui n'ont jamais été écrites — et pointaient tous,
   * ainsi que les cinq icônes sociales, vers `href="#"`. Treize liens morts
   * dans le seul bloc du site censé faire circuler le maillage interne, et
   * quatre promesses de contenu inexistant.
   *
   * Chaque libellé ci-dessous correspond maintenant à une ancre réelle de la
   * page ou à une route réelle du produit. Voir `FOOTER_PRODUCT` et
   * `FOOTER_RESOURCES` dans `pages/Landing.tsx`. */
  "footer.f1": { en: "The problem", fr: "Le problème" },
  "footer.f2": { en: "Jarvis — AI coach", fr: "Jarvis — Coach IA" },
  "footer.f3": { en: "Features", fr: "Fonctionnalités" },
  "footer.f4": { en: "Pricing", fr: "Tarifs" },
  "footer.r1": { en: "Guided demo", fr: "Démo guidée" },
  "footer.r2": { en: "Video demo", fr: "Démo en vidéo" },
  "footer.r3": { en: "FAQ", fr: "FAQ" },
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
