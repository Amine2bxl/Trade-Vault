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
  "nav.edge": { en: "Edge Score", fr: "Edge Score" },
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
  // ── LE HÉROS ────────────────────────────────────────────────────────────
  //
  // L'accroche nommait un journal (« tes trades contiennent la réponse ») sur
  // un marché — journal + analytics — déjà saturé et indifférencié. Elle vend
  // maintenant ce que le produit fait RÉELLEMENT de différent, et ce que
  // `docs/POSITIONNEMENT.md` désigne comme la douleur centrale de la cible :
  // « je sais trader, je n'arrive pas à être discipliné quand ça compte ».
  //
  // Le contre-temps du titre est la promesse entière : on ne dit pas au trader
  // qu'il est mauvais, on lui dit qu'il se saborde — ce qu'il sait déjà, et
  // que personne ne lui chiffre.
  "hero.h1a": { en: "You know how to trade.", fr: "Tu sais trader." },
  "hero.h1b": {
    en: "You break your own rules when it counts.",
    fr: "Tu casses tes propres règles quand ça compte.",
  },
  "hero.sub": {
    en: "TradeVault reads your history and puts a number on what indiscipline costs you — size drift after a loss, overtrading, off-plan entries — then hands you one rule to hold tomorrow.",
    fr: "TradeVault lit ton historique et chiffre ce que l'indiscipline te coûte — dérive de taille après une perte, overtrading, entrées hors plan — puis te donne une seule règle à tenir demain.",
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
  "analytics.title.a": { en: "The numbers exist", fr: "Les chiffres existent" },
  "analytics.title.b": { en: "to serve the diagnosis.", fr: "pour servir le diagnostic." },
  "analytics.sub": {
    en: "Twenty-plus metrics computed on your real history — not to decorate a dashboard, but to show where your edge lives and where it dies.",
    fr: "Plus de vingt métriques calculées sur ton historique réel — pas pour décorer un tableau de bord, mais pour montrer où vit ton edge et où il meurt.",
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
  "mistakes.title.a": { en: "Your biggest leak", fr: "Ta plus grosse fuite" },
  "mistakes.title.b": { en: "has a name and a price.", fr: "a un nom et un prix." },
  "mistakes.sub": {
    en: "Recurring mistakes and missed setups, counted and priced — month after month, on your own data. Your history can answer the questions you've never asked it.",
    fr: "Erreurs récurrentes et setups manqués, comptés et chiffrés — mois après mois, sur tes propres données. Ton historique peut répondre aux questions que tu ne lui as jamais posées.",
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
  // Les trois cartes ne listent plus des STYLES de trading (futures, day, ICT)
  // — le produit les sert tous et ça ne distingue rien. Elles nomment les trois
  // situations où tenir une règle a un coût immédiat et mesurable : c'est le
  // cœur de cible de `docs/product/PRODUCT.md` §4.
  "uses.title.a": { en: "Built for the trader", fr: "Conçu pour le trader" },
  "uses.title.b": { en: "who has rules to hold.", fr: "qui a des règles à tenir." },
  "uses.u1.t": { en: "Prop firm challenge", fr: "Challenge prop firm" },
  "uses.u1.d": {
    en: "Daily loss, max drawdown, consistency. The rules that end a challenge are the ones TradeVault watches.",
    fr: "Perte journalière, drawdown max, régularité. Les règles qui font échouer un challenge sont celles que TradeVault surveille.",
  },
  "uses.u2.t": { en: "Funded account", fr: "Compte financé" },
  "uses.u2.d": {
    en: "Keeping it is a discipline problem, not a strategy problem. The Edge Score moves before the balance does.",
    fr: "Le garder est un problème de discipline, pas de stratégie. L'Edge Score bouge avant le solde.",
  },
  "uses.u3.t": { en: "Serious retail", fr: "Retail sérieux" },
  "uses.u3.d": {
    en: "Futures, forex, indices — several trades a week. Enough data for the patterns to surface.",
    fr: "Futures, forex, indices — plusieurs trades par semaine. Assez de données pour que les schémas sortent.",
  },

  /* excel / notion */
  "alt.title.a": {
    en: "Spreadsheets gave you freedom.",
    fr: "Les tableurs t'ont donné la liberté.",
  },
  "alt.title.b": {
    en: "They never once told you to stop.",
    fr: "Ils ne t'ont jamais dit d'arrêter.",
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
  "alt.r3": {
    en: "Your own rules checked on every trade",
    fr: "Tes propres règles vérifiées à chaque trade",
  },
  "alt.r4": { en: "Recurring mistakes, priced", fr: "Erreurs récurrentes, chiffrées" },
  "alt.r5": {
    en: "Jarvis, grounded in your own history",
    fr: "Jarvis, ancré dans ton propre historique",
  },
  "alt.r6": { en: "Your data, exportable anytime", fr: "Tes données, exportables à tout moment" },

  /* cta final */
  // Le CTA final joue le seul moment que le produit existe pour tenir : celui
  // d'APRÈS la perte. C'est la promesse du héros, refermée.
  "cta.title.a": { en: "Your next loss is coming.", fr: "Ta prochaine perte arrive." },
  "cta.title.b": {
    en: "Decide now what you'll do after it.",
    fr: "Décide maintenant ce que tu feras après.",
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
  "shot.edge.alt": {
    en: "The Edge Score dial on the dashboard, with the four behaviour components below it.",
    fr: "Le cadran de l'Edge Score sur le tableau de bord, avec ses quatre composantes de comportement.",
  },
  "shot.edge.cap": { en: "The Edge Score", fr: "L'Edge Score" },
  "shot.jarvis.alt": {
    en: "A Jarvis conversation: the question, the weekday numbers it answers with, and the rule it proposes.",
    fr: "Une conversation avec Jarvis : la question, les chiffres par jour de semaine qu'il cite, et la règle qu'il propose.",
  },
  "shot.jarvis.cap": { en: "Jarvis, answering", fr: "Jarvis, en train de répondre" },
  "shot.mistakes.alt": {
    en: "The mistakes page: the correction plan, and the week-by-week series for each mistake.",
    fr: "La page Erreurs : le plan de correction, et la série semaine par semaine de chaque erreur.",
  },
  "shot.mistakes.cap": { en: "The correction plan", fr: "Le plan de correction" },
  "shot.journal.alt": {
    en: "The trade journal: every trade with its P&L, R multiple, setup and risk.",
    fr: "Le journal de trades : chaque trade avec son P&L, son multiple de R, son setup et son risque.",
  },
  "shot.journal.cap": { en: "The journal", fr: "Le journal" },
  "shot.calendar.alt": {
    en: "The trading calendar: each day tinted by its P&L.",
    fr: "Le calendrier de trading : chaque journée teintée par son P&L.",
  },
  "shot.calendar.cap": { en: "The calendar", fr: "Le calendrier" },

  /* hero product visual */
  // L'illustration du héros mène désormais avec ce que le tableau de bord
  // montre EN PREMIER dans le produit — l'Edge Score et la règle du jour —
  // et non avec une courbe qui monte. Une courbe qui monte est une promesse de
  // gain ; l'Edge Score est une promesse de discipline, et c'est celle-là qu'on
  // tient. La mention « illustration » est obligatoire tant que la vraie
  // capture n'est pas déposée : un visiteur ne distingue pas un dessin soigné
  // d'une capture.
  "hero.illustration": {
    en: "Illustration — not a client result",
    fr: "Illustration — pas un résultat client",
  },
  "hero.edge": { en: "Edge Score", fr: "Edge Score" },
  "hero.edge.sub": { en: "Behaviour, not P&L", fr: "Le comportement, pas le P&L" },
  "hero.rule": { en: "Today's rule", fr: "Ta règle du jour" },
  "hero.rule.d": {
    en: "Two trades max. Stop after one loss.",
    fr: "Deux trades max. Stop après une perte.",
  },
  "hero.eq": { en: "Equity curve", fr: "Courbe de capital" },
  "hero.winrate": { en: "Win rate", fr: "Réussite" },
  "hero.pf": { en: "Profit Factor", fr: "Profit Factor" },
  "hero.sharpe": { en: "Sharpe", fr: "Sharpe" },
  "hero.coach": { en: "AI Coach", fr: "Coach IA" },
  "hero.coach.tip": {
    en: "You size up after every loss.",
    fr: "Tu montes en taille après chaque perte.",
  },
  "hero.coach.action": { en: "Fixed size tomorrow.", fr: "Taille fixe demain." },
  "hero.pattern": { en: "Pattern detected", fr: "Pattern détecté" },
  // Le pattern affiché n'est PLUS un taux de réussite flatteur : c'est une
  // fuite. C'est ce que le produit sait dire et que les journaux ne disent pas.
  "hero.pattern.tip": {
    en: "Risk +80% on the trade after a loss.",
    fr: "Risque +80 % sur le trade qui suit une perte.",
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
  // ── LE PROBLÈME ─────────────────────────────────────────────────────────
  //
  // Les trois symptômes ne sont plus des généralités sur « l'émotion » : ce
  // sont les trois comportements que le moteur déterministe sait RÉELLEMENT
  // détecter et chiffrer (`computeBehaviorSignals`, flags `revenge_window`,
  // `oversized_risk`, `overtrading_day`). Une section problème dont le produit
  // ne sait pas mesurer les symptômes ne vend rien.
  "problem.tag": { en: "The real problem", fr: "Le vrai problème" },
  "problem.title.a": { en: "It's not your setup", fr: "Ce n'est pas ton setup" },
  "problem.title.b": { en: "that blows the account.", fr: "qui fait sauter le compte." },
  "problem.sub": {
    en: "It's the twenty minutes after a loss. Three symptoms you already recognise:",
    fr: "Ce sont les vingt minutes après une perte. Trois symptômes que tu reconnais déjà :",
  },
  "problem.p1.t": { en: "You size up after a loss", fr: "Tu montes en taille après une perte" },
  "problem.p1.d": {
    en: "The plan said 1%. The next trade went in at 1.8%. Nobody ever tells you, so it happens again.",
    fr: "Le plan disait 1 %. Le trade suivant est parti à 1,8 %. Personne ne te le dit, donc ça recommence.",
  },
  "problem.p2.t": {
    en: "You take trades your plan never allowed",
    fr: "Tu prends des trades que ton plan n'autorise pas",
  },
  "problem.p2.d": {
    en: "FOMO, boredom, the need to win it back. The setup was on no list — and there was nothing to stop you.",
    fr: "FOMO, ennui, besoin de se refaire. Le setup n'était sur aucune liste — et rien ne t'a arrêté.",
  },
  "problem.p3.t": { en: "You have no idea what it costs", fr: "Tu ignores ce que ça te coûte" },
  "problem.p3.d": {
    en: "The account bleeds, but no number ever names the habit responsible. So you change strategy instead.",
    fr: "Le compte saigne, mais aucun chiffre ne nomme l'habitude responsable. Alors tu changes de stratégie.",
  },

  /* journey */
  // ── LA MÉCANIQUE ────────────────────────────────────────────────────────
  //
  // Les quatre temps ne décrivent plus un pipeline de données
  // (trades → data → patterns → insights), qui ne dit rien au trader : ils
  // décrivent SA journée. C'est la boucle du produit telle que la navigation
  // l'organise déjà (Préparation → Journal → Analyse → Jarvis), et c'est ce qui
  // rend la discipline crédible : elle se tient à des moments, pas en général.
  "journey.tag": { en: "The loop", fr: "La boucle" },
  "journey.title.a": {
    en: "Discipline isn't a promise.",
    fr: "La discipline n'est pas une promesse.",
  },
  "journey.title.b": { en: "It's a loop.", fr: "C'est une boucle." },
  "journey.sub": {
    en: "Four moments, every trading day. TradeVault holds all four — most journals only show up for the third.",
    fr: "Quatre moments, chaque jour de marché. TradeVault tient les quatre — la plupart des journaux n'arrivent qu'au troisième.",
  },
  "journey.s1.t": { en: "Before", fr: "Avant" },
  "journey.s1.d": {
    en: "Pre-market checklist, five steps, today's rule in front of you",
    fr: "Checklist pré-market en 5 étapes, ta règle du jour sous les yeux",
  },
  "journey.s2.t": { en: "During", fr: "Pendant" },
  "journey.s2.d": {
    en: "A trade logged in 45 seconds, your own rules checked on each one",
    fr: "Un trade noté en 45 secondes, tes règles vérifiées sur chacun",
  },
  "journey.s3.t": { en: "After", fr: "Après" },
  "journey.s3.d": {
    en: "The engine prices the gap between your plan and what you did",
    fr: "Le moteur chiffre l'écart entre ton plan et ce que tu as fait",
  },
  "journey.s4.t": { en: "Tomorrow", fr: "Demain" },
  "journey.s4.d": {
    en: "One priority — not a wall of statistics",
    fr: "Une seule priorité — pas un mur de statistiques",
  },

  /* ── CLAIM → EVIDENCE ─────────────────────────────────────────────────
   *
   * La section qui n'existait pas, et qui porte le seul argument qu'aucun
   * concurrent ne peut reprendre sans refaire son architecture : Jarvis reçoit
   * des statistiques PRÉCALCULÉES par des moteurs purs et n'a pas le droit de
   * produire un chiffre qu'il n'a pas reçu (règle `ANTI_HALLUCINATION`,
   * `docs/product/JARVIS.md` §5).
   *
   * En 2026, « IA » sur une page de vente est un signal de bruit. La preuve
   * qu'on ne raconte pas d'histoires vaut plus que l'annonce qu'on a une IA. */
  "evidence.title.a": { en: "A coach that isn't allowed", fr: "Un coach qui n'a pas le droit" },
  "evidence.title.b": { en: "to make things up.", fr: "d'inventer." },
  "evidence.sub": {
    en: "Every sentence Jarvis writes carries its numbers, its period and its sample size. The claim, then the evidence — and a link to the trades it read.",
    fr: "Chaque phrase de Jarvis porte ses chiffres, sa période et la taille de son échantillon. L'affirmation, puis la preuve — et un lien vers les trades qu'il a lus.",
  },
  "evidence.claim.l": { en: "The claim", fr: "L'affirmation" },
  "evidence.claim": {
    en: "Your risk drifts up after a loss.",
    fr: "Ton risque dérive à la hausse après une perte.",
  },
  "evidence.proof.l": { en: "The evidence", fr: "La preuve" },
  "evidence.r1.l": { en: "Risk planned", fr: "Risque prévu" },
  "evidence.r2.l": { en: "Risk taken after a loss", fr: "Risque pris après une perte" },
  "evidence.r3.l": { en: "Sample", fr: "Échantillon" },
  "evidence.r3.v": { en: "12 trades", fr: "12 trades" },
  "evidence.r4.l": { en: "Period", fr: "Période" },
  "evidence.r4.v": { en: "Last 30 days", fr: "30 derniers jours" },
  "evidence.link": { en: "See the 12 trades", fr: "Voir les 12 trades" },
  "evidence.b1": {
    en: "No number Jarvis wasn't given",
    fr: "Aucun chiffre que Jarvis n'a pas reçu",
  },
  "evidence.b2": { en: "No market prediction, ever", fr: "Aucune prédiction de marché, jamais" },
  "evidence.b3": {
    en: "No conclusion on a thin sample — it says so instead",
    fr: "Aucune conclusion sur un échantillon faible — il le dit à la place",
  },
  "evidence.guard": {
    en: "Only 4 trades this month. Not enough to conclude — I'll wait.",
    fr: "Seulement 4 trades ce mois-ci. Pas assez pour conclure — j'attends.",
  },
  "evidence.guard.l": { en: "Statistical safety", fr: "Sécurité statistique" },

  /* ── EDGE SCORE ────────────────────────────────────────────────────────
   *
   * Le différenciateur le plus court à expliquer et le plus difficile à
   * copier : un score de comportement dont le P&L est VOLONTAIREMENT absent
   * (`app/utils/edgeScore.ts`). Il dit la philosophie du produit — la
   * discipline avant le profit — en un seul chiffre. */
  "edge.title.a": { en: "A score that doesn't look", fr: "Un score qui ne regarde pas" },
  "edge.title.b": { en: "at your P&L.", fr: "ton P&L." },
  "edge.sub": {
    en: "The Edge Score rates behaviour, not results: plan followed, risk held, clean days, routine. A green week you got by luck scores badly. That's the whole point.",
    fr: "L'Edge Score note le comportement, pas le résultat : plan respecté, risque tenu, jours propres, routine. Une semaine verte obtenue par chance note mal. C'est tout l'intérêt.",
  },
  "edge.c1": { en: "Plan followed", fr: "Plan respecté" },
  "edge.c2": { en: "Risk held", fr: "Risque tenu" },
  "edge.c3": { en: "Clean days", fr: "Jours propres" },
  "edge.c4": { en: "Routine", fr: "Routine" },
  "edge.excluded": { en: "P&L — deliberately excluded", fr: "P&L — volontairement exclu" },
  "edge.note": {
    en: "Computed over your last 10 traded days. Any component it can't measure is dropped and the weights re-normalised — never guessed.",
    fr: "Calculé sur tes 10 derniers jours tradés. Toute composante non mesurable est retirée et les poids renormalisés — jamais devinés.",
  },
  "edge.why": {
    en: "Why it matters in a challenge",
    fr: "Pourquoi ça compte en challenge",
  },
  "edge.why.d": {
    en: "A challenge is lost on rules, not on setups. The score moves the day before the account does.",
    fr: "Un challenge se perd sur des règles, pas sur des setups. Le score bouge la veille du compte.",
  },

  /* ── ANCRAGE DE PRIX ───────────────────────────────────────────────────
   *
   * On ne se compare pas aux journaux à 20–30 $/mois : c'est le marché qu'on
   * refuse. On se compare au coût que la cible PAIE DÉJÀ — le challenge qu'elle
   * repasse (`docs/POSITIONNEMENT.md` §5). Le prix affiché vient du catalogue,
   * jamais d'une constante recopiée ici. */
  "anchor.title.a": { en: "Compare us to the right thing.", fr: "Compare-nous à la bonne chose." },
  "anchor.title.b": { en: "Not to a cheaper journal.", fr: "Pas à un journal moins cher." },
  "anchor.sub": {
    en: "A prop firm challenge is paid again on every reset. Most resets are not a strategy failure — they're one rule broken after a loss.",
    fr: "Un challenge prop firm se repaie à chaque reset. La plupart des resets ne sont pas un échec de stratégie — c'est une règle cassée après une perte.",
  },
  "anchor.a.l": { en: "One challenge reset", fr: "Un reset de challenge" },
  "anchor.a.v": { en: "$200–600", fr: "200–600 $" },
  "anchor.a.d": {
    en: "Paid again, every time, market price.",
    fr: "Repayé à chaque fois, prix du marché.",
  },
  "anchor.b.l": { en: "TradeVault Pro", fr: "TradeVault Pro" },
  "anchor.b.d": {
    en: "Everything unlocked. Cancel in one click.",
    fr: "Tout débloqué. Annulation en un clic.",
  },
  "anchor.b.per": { en: "/ month", fr: "/ mois" },
  "anchor.punch": {
    en: "One reset avoided pays for years.",
    fr: "Un reset évité paie des années.",
  },

  /* ai */
  "ai.tag": { en: "The solution", fr: "La solution" },
  "ai.title.a": { en: "An AI coach who knows", fr: "Un coach IA qui connaît" },
  "ai.title.b": { en: "every one of your trades.", fr: "chacun de tes trades." },
  "ai.sub": {
    en: "He reads your real history, names the habit costing you the most, and gives you one thing to fix — not a report to read.",
    fr: "Il lit ton historique réel, nomme l'habitude qui te coûte le plus, et te donne une seule chose à corriger — pas un rapport à lire.",
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
  "features.title.a": { en: "Everything that serves", fr: "Tout ce qui sert" },
  "features.title.b": { en: "discipline.", fr: "la discipline." },
  "features.title.c": { en: "Nothing else.", fr: "Rien d'autre." },
  "features.sub": {
    en: "Each tool answers one question: what am I about to do, and should I?",
    fr: "Chaque outil répond à une seule question : qu'est-ce que je m'apprête à faire, et est-ce que je devrais ?",
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
    en: "TradeVault isn't another spreadsheet. It's the tool I wanted the year I kept breaking the same rule and calling it bad luck.",
    fr: "TradeVault n'est pas un tableur de plus. C'est l'outil que je voulais l'année où je cassais la même règle en appelant ça de la malchance.",
  },
  "proof.f1.v": { en: "20+", fr: "20+" },
  "proof.f1.l": { en: "metrics per trade", fr: "métriques calculées sur chaque trade" },
  "proof.f2.v": { en: "<10s", fr: "<10s" },
  "proof.f2.l": { en: "to import your history", fr: "pour importer tout ton historique" },
  "proof.f3.v": { en: "24/7", fr: "24/7" },
  "proof.f3.l": { en: "AI coach available", fr: "coach IA disponible" },
  "proof.quote": {
    en: "I built TradeVault because no journal ever told me why I was losing. It doesn't promise gains — it shows what your data says, names the habit behind it, and leaves the decision to you.",
    fr: "J'ai construit TradeVault parce qu'aucun journal ne m'a jamais dit pourquoi je perdais. Il ne promet pas de gains — il montre ce que tes données disent, nomme l'habitude derrière, et te laisse décider.",
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
    en: "One broken rule costs more than a year of Pro",
    fr: "Une règle cassée coûte plus qu'une année de Pro",
  },
  "pricing.sub": {
    en: "Start free, with no time limit. Go Pro when the free plan stops being enough.",
    fr: "Commence gratuitement, sans limite de temps. Passe Pro quand le gratuit ne suffit plus.",
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
  // ── LA FAQ RÉPOND AUX OBJECTIONS, DANS L'ORDRE OÙ ELLES VIENNENT ────────
  //
  // Elle en couvrait quatre et laissait passer les deux qui bloquent le plus :
  // « c'est encore un journal ? » et « est-ce que ça prédit le marché ? ». La
  // seconde est la plus importante de la page : un visiteur qui croit acheter
  // des signaux sera déçu, et un visiteur qui craint d'acheter des signaux part.
  // Répondre non, franchement, qualifie dans les deux sens.
  //
  // Le balisage `FAQPage` est construit à partir du MÊME tableau que
  // l'accordéon rendu (`Landing.tsx`) : ajouter une entrée ici la publie aussi
  // en données structurées, sans recopie possible.
  "faq.title": { en: "Everything you need to know", fr: "Tout ce que tu dois savoir" },
  "faq.q1": {
    en: "Is this just another trading journal?",
    fr: "C'est encore un journal de trading ?",
  },
  "faq.a1": {
    en: "A journal records. TradeVault diagnoses: it checks your own rules on every trade, prices your recurring mistakes, scores your discipline out of 100 and gives you one thing to fix.",
    fr: "Un journal enregistre. TradeVault diagnostique : il vérifie tes propres règles à chaque trade, chiffre tes erreurs récurrentes, note ta discipline sur 100 et te donne une seule chose à corriger.",
  },
  "faq.q2": {
    en: "Does it predict the market or give signals?",
    fr: "Est-ce que ça prédit le marché ou donne des signaux ?",
  },
  "faq.a2": {
    en: "No, and it never will. Jarvis analyses your own past and nothing else: no forecast, no financial advice, no orders, and no write access to your broker. TradeVault reads a file, never your account.",
    fr: "Non, et ça n'arrivera pas. Jarvis analyse ton passé et rien d'autre : aucune prévision, aucun conseil financier, aucun ordre, aucun accès en écriture à ton courtier. TradeVault lit un fichier, jamais ton compte.",
  },
  "faq.q3": {
    en: "I'm in a prop firm challenge. What does it actually do for me?",
    fr: "Je suis en challenge prop firm. Concrètement, ça me sert à quoi ?",
  },
  "faq.a3": {
    en: "It watches the behaviours that end challenges: size drift after a loss, over-traded days, off-plan entries. You get what each one costs you, a discipline score out of 100, and one rule for the next session.",
    fr: "Il surveille les comportements qui font échouer un challenge : dérive de taille après une perte, journées sur-tradées, entrées hors plan. Tu obtiens le coût de chacun, un score de discipline sur 100, et une règle pour la séance suivante.",
  },
  "faq.q4": {
    en: "Is the free plan really free?",
    fr: "L'offre gratuite est-elle vraiment gratuite ?",
  },
  "faq.a4": {
    en: "Yes — no time limit, no credit card. Your journal, dashboard, calendar, checklist and plan stay free for good. Paid plans add the analysis tools.",
    fr: "Oui — sans limite de temps ni carte bancaire. Ton journal, ton tableau de bord, ton calendrier, ta checklist et ton plan restent gratuits pour toujours. Les offres payantes ajoutent les outils d'analyse.",
  },
  "faq.q5": {
    en: "Is my trading data secure?",
    fr: "Mes données de trading sont-elles sécurisées ?",
  },
  "faq.a5": {
    en: "Encrypted in transit and at rest. Stripe payments. We never touch your broker account, and your full history is exportable at any time.",
    fr: "Chiffrées en transit et au repos. Paiements Stripe. On ne touche jamais à ton compte de courtage, et ton historique complet est exportable à tout moment.",
  },
  "faq.q6": {
    en: "Can I import my existing history?",
    fr: "Puis-je importer mon historique existant ?",
  },
  "faq.a6": {
    en: "Yes. Import a CSV from your broker and TradeVault structures it automatically — or paste, log by hand, or start with demo trades.",
    fr: "Oui. Importe un CSV depuis ton courtier et TradeVault structure tout automatiquement — ou colle, saisis à la main, ou démarre avec des trades de démo.",
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
  "footer.f5": { en: "Edge Score", fr: "Edge Score" },
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
