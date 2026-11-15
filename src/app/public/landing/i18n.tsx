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
import { lireLePassage, noterLePassage } from "./langSwap";

/** `useLayoutEffect` côté navigateur, `useEffect` côté serveur — où il ne
 *  s'exécute de toute façon pas, mais où React avertirait à chaque rendu. */
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type LandingLang = (typeof LANDING_LANGS)[number]["id"];
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

/**
 * LE PASSAGE D'UNE LANGUE À L'AUTRE, EN DEUX TEMPS.
 *
 * Changer de langue change d'adresse (`/` ↔ `/fr`) et recharge le document :
 * c'est ce qui garantit que le canonical, l'`hreflang` et le `<html lang>`
 * disent la vérité. Ce rechargement ne peut pas disparaître - mais il peut
 * cesser d'être un à-coup.
 *
 * On efface donc la page AVANT de naviguer (160ms, opacité seule), et on
 * pose un drapeau que la page suivante lit au montage pour se révéler en
 * fondu. Entre les deux, le navigateur peint le même fond des deux côtés :
 * l'œil ne voit pas une page partir puis une autre arriver, il voit un texte
 * se changer.
 *
 * Le délai est plafonné par un `setTimeout` plutôt que par `transitionend` :
 * si la transition ne joue pas (« moins de mouvement », onglet en arrière-
 * plan, moteur qui coupe les animations), l'événement n'arrive jamais et le
 * visiteur resterait bloqué sur une page qui ne change pas de langue.
 */
function partirVers(url: string) {
  /* La position part avec le drapeau : le document suivant reprend la
     lecture là où celui-ci la laisse, au lieu de rouvrir en haut. Voir
     `langSwap.ts` — c'était la plus grosse des trois ruptures, et le fondu
     la masquait au lieu de la corriger. */
  noterLePassage();
  const racine = document.querySelector(".landing-root");
  const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!racine || reduit) {
    window.location.href = url;
    return;
  }
  racine.classList.add("lang-sortie");
  /* 120ms au lieu de 160 : l'effacement n'a pas besoin d'être vu, il a
     besoin d'exister. Chaque milliseconde ici s'ajoute au noir entre les
     deux documents, qui est la seule partie du passage que personne ne peut
     trouver agréable. */
  window.setTimeout(() => {
    window.location.href = url;
  }, 120);
}

/**
 * Le fondu d'ARRIVÉE, joué une seule fois, et seulement après un changement
 * de langue. Le drapeau est effacé dès sa lecture : un rechargement manuel
 * (F5) ne doit pas rejouer une transition que personne n'a demandée.
 */
function useEntreeDeLangue() {
  useIsomorphicLayoutEffect(() => {
    if (!lireLePassage()) return;
    const racine = document.querySelector(".landing-root");
    if (!racine) return;
    racine.classList.add("lang-entree");
    const fin = () => racine.classList.remove("lang-entree");
    racine.addEventListener("animationend", fin, { once: true });
    return () => racine.removeEventListener("animationend", fin);
  }, []);
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

  // Le fondu d'arrivée vit ICI plutôt que dans chaque page : toute surface
  // qui monte ce provider (la vitrine, `/fr`, `/pricing`) hérite du même
  // passage, et aucune ne peut l'oublier.
  useEntreeDeLangue();

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
        partirVers(l === "fr" ? FR_PREFIX : "/");
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

/**
 * LES LANGUES DE LA VITRINE — une table, pas une paire de boutons.
 *
 * Le sélecteur rendait `EN` et `FR` en dur, dans le balisage. Ajouter
 * l'espagnol demandait donc de toucher le composant, le type, le sélecteur et
 * le repli : quatre endroits, dont trois qu'on oublie.
 *
 * Ici, une langue est UNE ENTRÉE. Le sélecteur se dessine depuis cette table,
 * `tr()` retombe déjà sur l'anglais pour toute clé non traduite (`m[lang] ??
 * m.en`), et `dir` est là dès maintenant pour que l'arabe n'oblige pas à
 * reprendre la mise en page le jour venu.
 *
 * Ce qu'il reste à faire pour ajouter une langue : une ligne ici, la route
 * correspondante dans `shared/lang.ts`, et les clés au fil de l'eau — une clé
 * manquante n'est pas une panne, c'est de l'anglais.
 */
/* `drapeau` est l'émoji du pavillon, pas une image : une seule source de
   vérité par langue, aucun fichier à déposer, et le rendu suit la police
   système. Ajouter l'espagnol ou l'arabe reste une ligne — `dir` est déjà là
   pour l'arabe, qui se lira de droite à gauche sans toucher aux composants.

   Un drapeau ne désigne pas une langue mais un pays : `short` reste affiché à
   côté, et c'est lui que lisent les lecteurs d'écran via `label`. Le drapeau
   accélère la reconnaissance, il ne la remplace pas. */
export const LANDING_LANGS = [
  { id: "en", short: "EN", label: "English", drapeau: "🇬🇧", dir: "ltr" },
  { id: "fr", short: "FR", label: "Français", drapeau: "🇫🇷", dir: "ltr" },
] as const;

/**
 * `en` et `fr` sont EXIGÉS — ce sont les deux langues servies, et une vitrine
 * à moitié traduite dans une langue annoncée est pire que pas de traduction.
 * Les suivantes entrent en facultatif : elles se remplissent progressivement
 * sans jamais casser la compilation.
 */
export type Msg = {
  en: string;
  fr: string;
} & Partial<Record<LandingLang, string>>;

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
  /* Deux promesses de plus, pour quatre. Deux lignes laissaient la colonne
     aux trois quarts vide et le regard filait vers le formulaire sans les
     lire. Les deux ajoutées ne répètent PAS le sous-titre du formulaire
     (« sans carte », « annulation ») : elles disent ce que le produit fait
     de la donnée une fois qu'elle est là. */
  "auth.promise3": {
    en: "Every mistake costed in euros, not in vibes",
    fr: "Chaque erreur chiffrée en euros, pas en ressenti",
  },
  "auth.promise4": {
    en: "One rule to hold, recomputed every week",
    fr: "Une règle à tenir, recalculée chaque semaine",
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
  "auth.info.confirmEmail": {
    en: "Almost there — confirm your email from the link we just sent, then sign in.",
    fr: "Presque fini — confirme ton e-mail via le lien qu'on vient d'envoyer, puis connecte-toi.",
  },
  "auth.info.entering": { en: "Opening your vault…", fr: "Ouverture de ton espace…" },
  "auth.err.missing_fields": {
    en: "Fill in every field to continue.",
    fr: "Remplis tous les champs pour continuer.",
  },
  "auth.err.invalid_email": {
    en: "That email address doesn't look right.",
    fr: "Cette adresse e-mail ne semble pas valide.",
  },
  "auth.err.weak_password": {
    en: "Use at least 6 characters for your password.",
    fr: "Ton mot de passe doit faire au moins 6 caractères.",
  },
  "auth.err.invalid_credentials": {
    en: "Wrong email or password. Try again, or reset your password.",
    fr: "E-mail ou mot de passe incorrect. Réessaie, ou réinitialise ton mot de passe.",
  },
  "auth.err.email_not_confirmed": {
    en: "Confirm your email first — the link is in your inbox.",
    fr: "Confirme d'abord ton e-mail — le lien est dans ta boîte mail.",
  },
  "auth.err.user_exists": {
    en: "An account already uses this email. Sign in instead.",
    fr: "Un compte utilise déjà cet e-mail. Connecte-toi plutôt.",
  },
  "auth.err.rate_limited": {
    en: "Too many attempts. Wait a minute, then try again.",
    fr: "Trop de tentatives. Attends une minute, puis réessaie.",
  },
  "auth.err.network": {
    en: "Can't reach TradeVault. Check your connection and try again.",
    fr: "Impossible de joindre TradeVault. Vérifie ta connexion et réessaie.",
  },
  "auth.err.oauth_failed": {
    en: "Google sign-in didn't go through. Try again, or use your email.",
    fr: "La connexion Google n'a pas abouti. Réessaie, ou passe par ton e-mail.",
  },
  "auth.err.link_expired": {
    en: "This link has expired or was already used. Request a new one.",
    fr: "Ce lien a expiré ou a déjà servi. Demandes-en un nouveau.",
  },
  "auth.err.same_password": {
    en: "Pick a password different from your current one.",
    fr: "Choisis un mot de passe différent de l'actuel.",
  },
  "auth.err.generic": {
    en: "Something went wrong. Try again in a moment.",
    fr: "Un souci est survenu. Réessaie dans un instant.",
  },
  "reset.title": { en: "Choose a new password", fr: "Choisis un nouveau mot de passe" },
  "reset.sub": {
    en: "One step and you're back in your journal.",
    fr: "Une étape et tu retrouves ton journal.",
  },
  "reset.verifying": { en: "Checking your reset link…", fr: "Vérification du lien…" },
  "reset.new": { en: "New password", fr: "Nouveau mot de passe" },
  "reset.confirm": { en: "Confirm new password", fr: "Confirme le mot de passe" },
  "reset.mismatch": {
    en: "The two passwords don't match.",
    fr: "Les deux mots de passe ne correspondent pas.",
  },
  "reset.submit": { en: "Update password", fr: "Mettre à jour" },
  "reset.done": {
    en: "Password updated. Opening your journal…",
    fr: "Mot de passe mis à jour. Ouverture de ton journal…",
  },
  "reset.back": { en: "Back to TradeVault", fr: "Retour à TradeVault" },
  "nav.product": { en: "Product", fr: "Produit" },

  "nav.problem": { en: "Problem", fr: "Problème" },

  "nav.analytics": { en: "Analytics", fr: "Analytics" },

  /* « Log in » et « Get Started » disent ce qu'ils FONT, pas ce qu'ils
     coûtent. « Sign in » / « Start free » se ressemblaient assez pour qu'on
     hésite entre les deux ; là, le premier ouvre une session existante, le
     second en crée une. La modale laisse basculer de l'un à l'autre, donc se
     tromper ne coûte rien. */
  "nav.signin": { en: "Log in", fr: "Se connecter" },
  "nav.cta": { en: "Get Started", fr: "Commencer" },
  "nav.cta.plan": { en: "Get Started", fr: "Commencer" },
  "nav.language": { en: "Language", fr: "Langue" },

  // ── LE HÉROS ────────────────────────────────────────────────────────────
  //
  // L'accroche nommait un journal (« tes trades contiennent la réponse ») sur
  // un marché — journal + analytics — déjà saturé et indifférencié. Elle vend
  // maintenant ce que le produit fait RÉELLEMENT de différent, et ce que
  // `docs/PRODUCT.md` désigne comme la douleur centrale de la cible :
  // « je sais trader, je n'arrive pas à être discipliné quand ça compte ».
  //
  // Le contre-temps du titre est la promesse entière : on ne dit pas au trader
  // qu'il est mauvais, on lui dit qu'il se saborde — ce qu'il sait déjà, et
  // que personne ne lui chiffre.
  "hero.h1a": { en: "You know how to trade.", fr: "Tu sais trader." },

  "hero.sub": {
    en: "TradeVault reads your history and puts a number on what indiscipline costs you - size drift after a loss, overtrading, off-plan entries - then hands you one rule to hold tomorrow.",
    fr: "TradeVault lit ton historique et chiffre ce que l'indiscipline te coûte - dérive de taille après une perte, overtrading, entrées hors plan - puis te donne une seule règle à tenir demain.",
  },
  /* LE TITRE SE LIT EN TROIS TEMPS, ET LE TROISIÈME EST ACCENTUÉ.
     Le second membre restait gris : il énonce le problème, et peindre un
     problème de la couleur du succès est un contresens. L'argument tenait
     pour la PHRASE entière - il ne tient pas pour ses trois derniers mots.
     « quand ça compte » n'est pas le problème, c'est le MOMENT : c'est là
     que tout se joue, et c'est le seul endroit de l'accroche où l'accent
     ajoute du sens au lieu d'en repeindre. */
  /* ── LE SECOND TEMPS PORTE LA VALEUR, PLUS LA DOULEUR ──
     « Tu sais trader. Tu casses tes propres règles quand ça compte. » est
     un bon titre : il nomme une douleur que la cible reconnaît en une
     seconde. Mais les DEUX temps y disaient la même chose — un constat,
     puis le même constat en plus dur. On sortait du héros en sachant qu'on
     a un problème, sans savoir ce que TradeVault en fait.
     Le second temps devient donc la promesse, et c'est le
     différenciateur que personne d'autre ne peut écrire : mettre un
     MONTANT sur une règle cassée. La douleur reste au premier temps, où
     elle suffit. */
  "hero.h1b1": { en: "Here's what every broken rule ", fr: "Voici ce que te coûte " },
  "hero.h1b2": { en: "costs you.", fr: "chaque règle cassée." },
  /* LE libellé de l'inscription, pour tout le site. Court, parce qu'il doit
     aussi tenir dans la barre de navigation ; la gratuité est portée juste
     en dessous par la ligne de réassurance, à chaque endroit où le bouton
     apparaît. */
  "hero.cta": { en: "Get Started", fr: "Commencer" },

  /* La démo revient, mais sous la forme d'une vidéo de 20 s jouée sur place :
     elle répond à « montre-moi » sans faire quitter l'accroche, et elle reste
     en troisième rang, en simple lien, derrière l'inscription et les tarifs. */
  "hero.demo": { en: "Watch the demo", fr: "Voir la démo" },
  "hero.demo.len": { en: "20 s", fr: "20 s" },
  "demo.title": { en: "TradeVault in 20 seconds", fr: "TradeVault en 20 secondes" },
  "hero.t1": { en: "No credit card", fr: "Sans carte bancaire" },
  "hero.t2": { en: "Set up in 2 minutes", fr: "Prêt en 2 minutes" },
  /* « Sans abonnement » est devenu faux le jour où le mensuel est revenu.
     Ce qui reste vrai pour tout le monde : on peut partir quand on veut. */
  "hero.t3": {
    en: "Cancel anytime",
    fr: "Résiliable à tout moment",
  },

  /* cta final */
  // Le CTA final joue le seul moment que le produit existe pour tenir : celui
  // d'APRÈS la perte. C'est la promesse du héros, refermée.
  "cta.title.a": { en: "Your next loss is coming.", fr: "Ta prochaine perte arrive." },
  "cta.title.b": {
    en: "Decide now what you'll do after it.",
    fr: "Décide maintenant ce que tu feras après.",
  },

  /* ═══════════════════════════════════════════════════════════════════════
     LA VITRINE COURTE — une section, une fonction, jamais deux fois la même.
     ═══════════════════════════════════════════════════════════════════════

     L'audit de la version précédente : 12 517 px, 1 619 mots, 17 sections,
     et quatre libellés différents pour un seul bouton. Surtout, la moitié de
     la hauteur répétait quelque chose de déjà dit — l'argument Jarvis tenait
     1 508 px sur deux sections, la comparaison 1 411 px sur deux autres, le
     cadrage du problème 1 028 px sur deux encore.

     La règle appliquée ici est celle du skill : « si deux sections répondent
     à la même objection, l'une des deux part ». Rien n'est dit deux fois.
     ═══════════════════════════════════════════════════════════════════════ */

  /* ── Héros ── */
  "v2.hero.eyebrow": {
    en: "For prop-firm challenges and serious retail",
    fr: "Pour les challenges prop-firm et le retail exigeant",
  },
  /* LE SOUS-TITRE EST DÉCOUPÉ EN TROIS, POUR LE SURLIGNEUR.
     Découper plutôt que chercher une sous-chaîne à l'exécution : une
     recherche de texte casse à la première traduction qui tourne la phrase
     autrement, et elle casse EN SILENCE - le surlignage disparaît sans que
     rien ne le signale. Trois clés, trois traductions, aucun découpage
     deviné.
     La partie surlignée est la PROMESSE CONCRÈTE, pas le nom du produit :
     c'est elle qu'on doit retenir si on ne lit que trois mots. */
  /* « Il lit ton journal » — « il » ne désignait rien : le titre ne nomme
     plus le produit. Le sous-titre le nomme donc une fois, ce qui est la
     seule mention autorisée dans le héros. */
  "v2.hero.sub.a": {
    en: "TradeVault reads your journal, turns your mistakes into euros, and hands you ",
    fr: "TradeVault lit ton journal, convertit tes erreurs en euros, et te donne ",
  },
  "v2.hero.sub.b": {
    en: "one thing to fix tomorrow",
    fr: "une seule chose à corriger demain",
  },
  "v2.hero.sub.c": { en: ".", fr: "." },

  /* ── Le prix du problème — la bascule entre la douleur et sa preuve ──
     Nommer trois symptômes sans les CHIFFRER laisse le visiteur acquiescer
     et passer. La section « problème » annonce donc un montant, et l'écran
     juste dessous le donne. */
  "cout.tag": { en: "What it costs", fr: "Ce que ça coûte" },
  "cout.title.a": { en: "Every one of them has", fr: "Chacun d'eux a" },
  "cout.title.b": { en: "a price.", fr: "un prix." },
  "cout.sub": {
    en: "Not a feeling, a figure. TradeVault counts each mistake you tick, prices it against your own risk, and tracks whether it recedes.",
    fr: "Pas une impression, un chiffre. TradeVault compte chaque erreur que tu coches, la chiffre sur ton propre risque, et suit si elle recule.",
  },

  "v2.s2.t": {
    en: "Ask anything. It answers from your trades.",
    fr: "Demande n'importe quoi. Il répond depuis tes trades.",
  },
  "v2.s2.d": {
    en: "Every claim carries its number, its period and its sample size. It analyses your past - it never predicts the market.",
    fr: "Chaque affirmation porte son chiffre, sa période et son échantillon. Il analyse ton passé - jamais le marché à venir.",
  },
  "v2.s3.t": {
    en: "Which setup pays you. Which one bleeds you.",
    fr: "Quel setup te paie. Lequel te saigne.",
  },
  "v2.s3.d": {
    en: "Expectancy, profit factor and R multiple per setup, per session, per weekday.",
    fr: "Espérance, profit factor et multiple de R par setup, par session, par jour de semaine.",
  },

  "v2.s5.t": {
    en: "Getting your trades in takes minutes.",
    fr: "Entrer tes trades prend des minutes.",
  },
  "v2.s5.d": {
    en: "Universal CSV import, copy-paste, or 45 seconds by hand. Every trade lands in one table you can filter, edit and export.",
    fr: "Import CSV universel, copier-coller, ou 45 secondes à la main. Chaque trade arrive dans un tableau que tu filtres, corriges et exportes.",
  },
  /* Deux écrans de plus dans la visite : la préparation d'avant-séance et la
     ruine simulée. Ils portent des arguments que rien d'autre ne porte -
     l'un est le SEUL moment du produit qui agit AVANT le trade, l'autre est
     la seule chose qui parle de ce qui ne s'est pas encore produit. */
  /* « La checklist passe avant le trade » décrit l'écran. Ce que montre la
     capture est bien plus fort : le produit DEMANDE pourquoi tu entres, et
     propose « je veux récupérer ma perte » parmi les réponses. Le titre dit
     donc ça. */
  "v2.s6.t": {
    en: "It asks why you're entering.",
    fr: "Il te demande pourquoi tu entres.",
  },
  "v2.s6.d": {
    en: "The only moment the product acts before the click, not after it.",
    fr: "Le seul moment où le produit agit avant le clic, pas après.",
  },

  "shot.checklist.alt": {
    en: "The pre-market checklist: preparation, mental state and lock-in.",
    fr: "La checklist d'avant-séance : préparation, état mental et verrouillage.",
  },

  /* ── Confiance ── */
  "v2.trust.title": { en: "What we will never do", fr: "Ce qu'on ne fera jamais" },
  "v2.trust.sub": {
    en: "Three commitments you can check today.",
    fr: "Trois engagements vérifiables aujourd'hui.",
  },
  "v2.trust.reviews": { en: "Verified reviews on", fr: "Avis vérifiés sur" },

  /* Captures d'écran du produit — voir `src/assets/product/README.md`.
     Le texte alternatif décrit L'ÉCRAN, jamais le résultat qu'on y voit :
     une capture montre le compte d'un trader, pas une promesse. */
  "shot.dashboard.alt": {
    en: "The TradeVault dashboard: equity curve, key stats and the day's trades.",
    fr: "Le tableau de bord TradeVault : courbe de capital, statistiques et trades du jour.",
  },

  "shot.jarvis.alt": {
    en: "A Jarvis conversation: the question, the numbers it answers with, and the plan it proposes.",
    fr: "Une conversation avec Jarvis : la question, les chiffres qu'il cite, et le plan qu'il propose.",
  },

  "shot.mistakes.alt": {
    en: "The mistakes page: the correction plan, and the week-by-week series for each mistake.",
    fr: "La page Erreurs : le plan de correction, et la série semaine par semaine de chaque erreur.",
  },

  "shot.journal.alt": {
    en: "The trade journal: every trade with its P&L, R multiple, setup and risk.",
    fr: "Le journal de trades : chaque trade avec son P&L, son multiple de R, son setup et son risque.",
  },

  "shot.calendar.alt": {
    en: "The trading calendar: each day tinted by its P&L.",
    fr: "Le calendrier de trading : chaque journée teintée par son P&L.",
  },

  "shot.analytics.alt": {
    en: "The analytics page: profit factor, ratios, equity curve and monthly performance.",
    fr: "La page Analyses : profit factor, ratios, courbe de capital et performance mensuelle.",
  },

  /* platforms — les VRAIES portes d'entrée des trades (aucune prétention de
     synchro broker, il n'y a pas d'API : import CSV, copier-coller, saisie,
     démo). */
  "platforms.label": {
    en: "Your trades get in - instantly",
    fr: "Tes trades entrent - en un instant",
  },
  "platforms.i1": { en: "Universal CSV import", fr: "Import CSV universel" },
  "platforms.i2": { en: "Copy & paste", fr: "Copier-coller" },
  "platforms.i3": { en: "Quick logging", fr: "Saisie rapide" },
  "platforms.i4": { en: "Demo trades", fr: "Trades de démo" },

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
    en: "FOMO, boredom, the need to win it back. The setup was on no list - and there was nothing to stop you.",
    fr: "FOMO, ennui, besoin de se refaire. Le setup n'était sur aucune liste - et rien ne t'a arrêté.",
  },
  "problem.p3.t": { en: "You have no idea what it costs", fr: "Tu ignores ce que ça te coûte" },
  "problem.p3.d": {
    en: "The account bleeds, but no number ever names the habit responsible. So you change strategy instead.",
    fr: "Le compte saigne, mais aucun chiffre ne nomme l'habitude responsable. Alors tu changes de stratégie.",
  },

  /* Raccourci de moitié : la comparaison chiffrée juste en dessous dit
     maintenant ce que la première phrase expliquait. Ne reste que ce
     qu'aucun chiffre ne peut dire — la CAUSE du reset. */
  "anchor.sub": {
    en: "Most resets are not a strategy failure. They're one rule broken after a loss.",
    fr: "La plupart des resets ne sont pas un échec de stratégie. C'est une règle cassée après une perte.",
  },
  "anchor.a.l": { en: "One challenge reset", fr: "Un reset de challenge" },
  "anchor.a.v": { en: "€200-600", fr: "200-600 €" },
  "anchor.a.d": {
    en: "Paid again, every time, market price.",
    fr: "Repayé à chaque fois, prix du marché.",
  },

  /* ── L'AVIS COOKIES ──
     Il était écrit en français, en dur, sur une vitrine dont la langue par
     défaut est l'anglais. Le contenu suit MOT POUR MOT ce que dit la page
     `/cookies` : pas de balise de mesure d'audience, pas de pixel
     publicitaire, pas de widget social, et les cookies de Stripe, Coinbase
     et Google déposés sur LEURS pages, pas sur la nôtre. */
  "cookie.pill": { en: "Cookies", fr: "Cookies" },
  "cookie.aria": { en: "Cookie preferences", fr: "Préférences de cookies" },
  "cookie.done.aria": {
    en: "Cookies accepted - review preferences",
    fr: "Cookies acceptés - revoir les préférences",
  },
  "cookie.title": { en: "Cookies and local storage", fr: "Cookies et stockage local" },
  "cookie.body": {
    en: "TradeVault stores what it needs to keep you signed in and remember your settings. No analytics tag, no advertising pixel, no social widget.",
    fr: "TradeVault stocke ce qu'il faut pour te garder connecté et retenir tes réglages. Aucune balise de mesure d'audience, aucun pixel publicitaire, aucun widget social.",
  },
  "cookie.note": {
    en: "Stripe, Coinbase Commerce and Google set their own cookies on their own pages when you go there to pay or sign in. Never on TradeVault itself.",
    fr: "Stripe, Coinbase Commerce et Google déposent leurs propres cookies sur leurs propres pages, quand tu y vas pour payer ou te connecter. Jamais sur TradeVault même.",
  },
  "cookie.more": { en: "Read the details", fr: "Lire le détail" },
  "cookie.accept": { en: "Accept", fr: "J'accepte" },
  "cookie.done": { en: "Preferences saved", fr: "Préférences enregistrées" },
  "anchor.punch": {
    en: "One reset avoided pays for the license several times over.",
    fr: "Un reset évité rembourse la licence plusieurs fois.",
  },

  /* proof */
  "proof.title.a": { en: "Built by a trader,", fr: "Conçu par un trader," },
  "proof.title.b": { en: "for traders.", fr: "pour les traders." },
  "proof.body": {
    en: "TradeVault isn't another spreadsheet. It's the tool I wanted the year I kept breaking the same rule and calling it bad luck.",
    fr: "TradeVault n'est pas un tableur de plus. C'est l'outil que je voulais l'année où je cassais la même règle en appelant ça de la malchance.",
  },

  "proof.f1.l": { en: "metrics per trade", fr: "métriques calculées sur chaque trade" },

  "proof.f2.l": { en: "to import your history", fr: "pour importer tout ton historique" },

  "proof.f3.l": { en: "AI coach available", fr: "coach IA disponible" },
  "proof.quote": {
    en: "I built TradeVault because no journal ever told me why I was losing. It doesn't promise gains - it shows what your data says, names the habit behind it, and leaves the decision to you.",
    fr: "J'ai construit TradeVault parce qu'aucun journal ne m'a jamais dit pourquoi je perdais. Il ne promet pas de gains - il montre ce que tes données disent, nomme l'habitude derrière, et te laisse décider.",
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
  "trust.t2": { en: "No orders, ever", fr: "Aucun ordre, jamais" },
  /* « Aucun accès à ton courtier » est devenu inexact avec la synchro
     Tradovate (lecture seule, sur l'offre payante). Ce qui reste vrai, et
     vérifiable : TradeVault ne passe jamais d'ordre, n'écrit jamais chez le
     courtier. */
  "trust.d2": {
    en: "Read-only, always. TradeVault never places a trade.",
    fr: "Lecture seule, toujours. TradeVault ne passe jamais un trade.",
  },
  "trust.t3": { en: "Your data is yours", fr: "Tes données t'appartiennent" },
  "trust.d3": { en: "Full export, anytime.", fr: "Export complet, à tout moment." },

  /* ── /pricing — la page dédiée ─────────────────────────────────────────
   *
   * Sa copy est DISTINCTE de la section tarifaire de la vitrine, et c'est
   * délibéré : là-bas on arrive au bout d'un parcours, ici on arrive avec la
   * question. Reprendre le même titre ferait lire deux fois la même page à
   * deux moments qui n'ont rien à voir.
   *
   * Le titre passe le test de l'inversion : « l'offre gratuite EST un essai »
   * est une vraie alternative, que pratiquement tous les concurrents
   * choisissent. Dire l'inverse dit donc quelque chose. */
  "price.h1": {
    en: "The free plan is not a trial.",
    fr: "L'offre gratuite n'est pas un essai.",
  },
  /* Deux lignes de moins. Au-dessus d'une grille tarifaire, personne ne lit
     un paragraphe : on cherche un chiffre. Ce qui restait à dire tient en
     six mots, et le reste est dans la grille juste en dessous. */
  "price.sub": {
    en: "No deadline, no card. Pay when you want the numbers.",
    fr: "Sans échéance, sans carte. Paie quand tu veux les chiffres.",
  },
  "price.state.on": { en: "You are currently on", fr: "Tu es actuellement sur" },
  "price.state.free": { en: "the free plan", fr: "l'offre gratuite" },
  "price.state.manage": { en: "Manage", fr: "Gérer" },
  "price.foot.home": { en: "Home", fr: "Accueil" },

  /* Ce qui change, en trois phrases. Une matrice de vingt lignes se PARCOURT
     et ne se lit pas ; trois phrases se lisent en entier. La troisième est
     celle qu'aucune grille n'affiche jamais - ce qui reste gratuit pour
     toujours -, et sans elle « offre gratuite » se lit « version mutilée ». */
  /* ── CE QUI RESTE GRATUIT, POUR TOUJOURS ──
     La section « ce qui change » disait en trois paragraphes ce que la
     grille montre maintenant ligne par ligne : les pages qui s'ouvrent, les
     limites qui sautent. Elle ne gardait qu'une information à elle, et
     c'est la plus importante de la page : sans elle, « offre gratuite » se
     lit comme « version mutilée », et le gratuit ne convertit personne
     parce que personne ne s'en sert.

     Six outils nommés valent mieux qu'une phrase qui les énumère : on les
     reconnaît, on n'a pas à les lire. */
  "price.free.title": {
    en: "Free forever, and not a teaser",
    fr: "Gratuit pour toujours, et pas un avant-goût",
  },
  "price.free.sub": {
    en: "Seven tools no plan ever locks. Use them for years without paying.",
    fr: "Sept outils qu'aucune offre ne ferme. Utilise-les des années sans payer.",
  },
  "price.free.1": { en: "Journal", fr: "Journal" },
  "price.free.2": { en: "Dashboard", fr: "Tableau de bord" },
  "price.free.3": { en: "Calendar", fr: "Calendrier" },
  "price.free.4": { en: "Pre-market checklist", fr: "Checklist pré-market" },
  "price.free.5": { en: "Trading plan", fr: "Plan de trading" },
  "price.free.6": { en: "Position calculator", fr: "Calculateur de position" },
  "price.free.7": { en: "Analytics", fr: "Analyses" },

  /* Quatre objections de FACTURATION. Aucune ne répète la FAQ de la vitrine :
     ici on ne demande plus « à quoi ça sert », on demande « qu'est-ce que je
     signe ». */
  "price.faq.title": { en: "Before you pay", fr: "Avant de payer" },
  "price.faq1.q": {
    en: "Is the free plan really free?",
    fr: "Le gratuit est-il vraiment gratuit ?",
  },
  "price.faq1.a": {
    en: "Yes. No deadline, no card, nothing that expires. Ten new trades a month is the only limit.",
    fr: "Oui. Sans échéance, sans carte, rien qui expire. Dix nouveaux trades par mois, c'est la seule limite.",
  },
  "price.faq2.q": {
    en: "What if I stay on the free plan?",
    fr: "Et si je reste sur l'offre gratuite ?",
  },
  "price.faq2.a": {
    en: "Nothing is deleted or locked away. Your journal stays readable and the CSV export stays open.",
    fr: "Rien n'est supprimé ni verrouillé. Ton journal reste lisible et l'export CSV reste ouvert.",
  },
  "price.faq3.q": {
    en: "Is it a subscription?",
    fr: "Est-ce un abonnement ?",
  },
  "price.faq3.a": {
    en: "Your choice. The monthly plan renews each month and cancels in one click from your account. The lifetime license is paid once and never renews. Both unlock exactly the same product.",
    fr: "À toi de choisir. Le mensuel se renouvelle chaque mois et se résilie en un clic depuis ton compte. La licence à vie se paie une fois et ne se renouvelle jamais. Les deux ouvrent exactement le même produit.",
  },
  "price.faq4.q": { en: "How do I pay?", fr: "Comment payer ?" },
  "price.faq4.a": {
    en: "By card through Stripe, or in cryptocurrency through Coinbase Commerce. Your card number never reaches TradeVault.",
    fr: "Par carte via Stripe, ou en cryptomonnaie via Coinbase Commerce. Ton numéro de carte n'atteint jamais TradeVault.",
  },

  /* pricing */
  "pricing.tag": { en: "Pricing", fr: "Tarifs" },
  "pricing.title": {
    en: "A failed challenge costs more than TradeVault for life",
    fr: "Un challenge raté coûte plus que TradeVault à vie",
  },

  "pricing.trust1": { en: "Free plan forever", fr: "Offre gratuite à vie" },
  "pricing.trust2": { en: "Secure Stripe payment", fr: "Paiement Stripe sécurisé" },
  "pricing.trust3": {
    en: "Monthly cancels in one click",
    fr: "Mensuel résiliable en un clic",
  },

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
  "faq.aside": {
    en: "Straight answers. If yours isn't here, it takes one message.",
    fr: "Des réponses directes. Si la tienne n'y est pas, un message suffit.",
  },
  "faq.aside.cta": { en: "Ask us", fr: "Nous écrire" },
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
    en: "No, and it never will. Jarvis analyses your own past and nothing else: no forecast, no financial advice, no orders, and never write access to your broker account.",
    fr: "Non, et ça n'arrivera pas. Jarvis analyse ton passé et rien d'autre : aucune prévision, aucun conseil financier, aucun ordre, et jamais d'accès en écriture à ton compte de courtage.",
  },
  "faq.q3": {
    en: "I'm in a prop firm challenge. What does it actually do for me?",
    fr: "Je suis en challenge prop firm. Concrètement, ça me sert à quoi ?",
  },
  "faq.a3": {
    en: "It watches the behaviours that end challenges: size drift after a loss, over-traded days, off-plan entries. You get what each one costs you, a discipline score out of 100, and one rule for the next session.",
    fr: "Il surveille les comportements qui font échouer un challenge : dérive de taille après une perte, journées sur-tradées, entrées hors plan. Tu obtiens le coût de chacun, un score de discipline sur 100, et une règle pour la séance suivante.",
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
    en: "Yes. Import a CSV from your broker and TradeVault structures it automatically - or paste, log by hand, or start with demo trades.",
    fr: "Oui. Importe un CSV depuis ton courtier et TradeVault structure tout automatiquement - ou colle, saisis à la main, ou démarre avec des trades de démo.",
  },

  "cta.note": {
    en: "Free plan forever · No credit card · Cancel in 1 click",
    fr: "Offre gratuite à vie · Sans carte bancaire · Annulation en 1 clic",
  },

  /* ══ LANDING LIQUID (novembre 2026) ══════════════════════════════════════
     Les clés des sections refaites à la DA de l'app : héros centré façon
     Revolut, la boucle en quatre gestes, la visite en bento, Jarvis, et les
     deux offres. Aucun prix ici : les montants sortent du catalogue
     (`domain/plans`) et sont formatés par `eur()`. */
  "lq.hero.from": { en: "From", fr: "Dès" },
  "lq.perMonth": { en: "/ month", fr: "/ mois" },

  "lq.shot.demo": {
    en: "Demo account · example trades",
    fr: "Compte de démonstration · trades d'exemple",
  },

  "lq.how.tag": { en: "How it works", fr: "Comment ça marche" },
  "lq.how.title.a": { en: "Four gestures.", fr: "Quatre gestes." },
  "lq.how.title.b": { en: "One habit that sticks.", fr: "Une habitude qui tient." },
  "lq.how.sub": {
    en: "The loop TradeVault runs with you, session after session.",
    fr: "La boucle que TradeVault tient avec toi, séance après séance.",
  },
  "lq.how.1.t": { en: "Log", fr: "Note" },
  "lq.how.1.d": {
    en: "CSV import, copy-paste or 45 seconds by hand.",
    fr: "Import CSV, copier-coller ou 45 secondes à la main.",
  },
  "lq.how.2.t": { en: "Measure", fr: "Mesure" },
  "lq.how.2.d": {
    en: "Every setup, session and weekday, each with its sample size.",
    fr: "Chaque setup, session et jour, chacun avec son échantillon.",
  },
  "lq.how.3.t": { en: "Understand", fr: "Comprends" },
  "lq.how.3.d": {
    en: "Jarvis names the leak and shows the trades behind it.",
    fr: "Jarvis nomme la fuite et montre les trades derrière.",
  },
  "lq.how.4.t": { en: "Fix one thing", fr: "Corrige une chose" },
  "lq.how.4.d": {
    en: "One rule for tomorrow, asked before every entry.",
    fr: "Une règle pour demain, posée avant chaque entrée.",
  },

  "lq.tour.title.a": { en: "Your whole session.", fr: "Toute ta séance." },
  "lq.tour.title.b": { en: "One app.", fr: "Une seule app." },
  "lq.tour.sub": {
    en: "Before the open, during the session, after the close. The same screens you'll use tomorrow morning.",
    fr: "Avant l'ouverture, pendant la séance, après la clôture. Les écrans que tu ouvriras demain matin.",
  },
  "lq.cal.t": { en: "Your month at a glance.", fr: "Ton mois d'un coup d'œil." },
  "lq.cal.d": {
    en: "Every day tinted by its result, every week totalled.",
    fr: "Chaque jour teinté par son résultat, chaque semaine totalisée.",
  },

  "lq.jarvis.tag": { en: "Jarvis · AI coach", fr: "Jarvis · coach IA" },
  "lq.jarvis.p1": {
    en: "Every claim shows its numbers, its period and its sample.",
    fr: "Chaque affirmation montre ses chiffres, sa période et son échantillon.",
  },
  "lq.jarvis.p2": {
    en: "Reads your journal only. Never predicts the market.",
    fr: "Ne lit que ton journal. Ne prédit jamais le marché.",
  },
  "lq.jarvis.p3": {
    en: "Changes nothing without your OK.",
    fr: "Ne change rien sans ton accord.",
  },

  "lq.price.monthly": { en: "Monthly", fr: "Mensuel" },
  "lq.price.monthly.d": {
    en: "No commitment. Cancel in one click.",
    fr: "Sans engagement. Résiliable en un clic.",
  },
  "lq.price.lifetime": { en: "Lifetime license", fr: "Licence à vie" },
  "lq.price.lifetime.d": {
    en: "Paid once. Yours for good.",
    fr: "Payée une fois. À toi pour de bon.",
  },
  "lq.price.once": { en: "once", fr: "une fois" },
  "lq.price.same": {
    en: "Both unlock exactly the same product.",
    fr: "Les deux ouvrent exactement le même produit.",
  },
  "lq.price.compare": { en: "Compare plans", fr: "Comparer les offres" },

  /* footer */
  "footer.tagline": {
    en: "The trader's intelligent cockpit. Journal, analytics, AI coach.",
    fr: "Le cockpit intelligent du trader. Journal, analytics, Coach IA.",
  },
  "footer.product": { en: "Product", fr: "Produit" },

  "footer.f3": { en: "The product", fr: "Le produit" },
  "footer.f4": { en: "Pricing", fr: "Tarifs" },

  "footer.r1": { en: "Guided demo", fr: "Démo guidée" },

  "footer.r3": { en: "FAQ", fr: "FAQ" },
  "footer.r4": { en: "Contact", fr: "Contact" },
  "footer.rights": {
    en: "© 2026 TradeVault. All rights reserved.",
    fr: "© 2026 TradeVault. Tous droits réservés.",
  },
  "footer.legal": { en: "Legal", fr: "Légal" },
  "footer.privacy": { en: "Privacy", fr: "Confidentialité" },
  /* « Terms » disait « CGU » en français pendant qu'un lien voisin, lui
     aussi intitulé « CGU », menait à une AUTRE page. Deux libellés
     identiques pour deux documents différents : le visiteur ne pouvait pas
     savoir lequel il ouvrait. Chacun porte maintenant son propre nom. */
  "footer.terms": { en: "Terms of Service", fr: "Conditions d'utilisation" },
  "footer.cgu": { en: "General Terms (CGU)", fr: "CGU" },
  "footer.cookies": { en: "Cookies", fr: "Cookies" },
};

export function tr(lang: LandingLang, key: LandingKey): string {
  const m = M[key];
  if (!m) return key;
  return m[lang] ?? m.en;
}
