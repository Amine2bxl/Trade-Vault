/**
 * CE QUE DIT JARVIS PENDANT L'ONBOARDING — module PUR.
 *
 * Une phrase fixe par écran faisait de Jarvis une légende : la même pour un
 * débutant en démo et pour un trader financé chez Apex. Ici, chaque réplique
 * est choisie selon ce que le trader a DÉJÀ répondu (terrain, firme, marchés,
 * style, expérience, angle mort, garde-fous) : deux traders ne lisent pas la
 * même séquence, et chacun entend Jarvis réagir à SES réponses.
 *
 * Trois règles d'écriture, celles du produit :
 *   • aucune statistique, aucune promesse de gain, aucune formulation causale
 *     (« la plupart des traders… ») — Jarvis dit ce qu'IL va faire ;
 *   • une phrase courte, deux au plus ;
 *   • les chiffres cités sont ceux du trader (sa taille, ses garde-fous).
 *
 * Variation : plusieurs formulations par situation, tirées par une graine
 * stable (l'identifiant du compte) — la séquence ne change pas d'un rendu à
 * l'autre, mais deux traders au même profil ne lisent pas mot pour mot la même.
 *
 * Langues : français et anglais rédigés ; les autres langues reçoivent
 * l'anglais, comme le reste des répliques de Jarvis (sa voix est anglaise).
 */
import type { Arena, Experience, Goal, Leak, Market, Style } from "./onboardingPlan";

export interface JarvisContext {
  name: string;
  arena: Arena | null;
  /** Nom affiché de la firme (« Apex »), vide si aucune ou « autre ». */
  firm: string;
  /** Taille affichée (« 50K »), vide si inconnue. */
  size: string;
  assets: Market[];
  usesIct: boolean;
  style: Style | null;
  experience: Experience | null;
  leak: Leak | null;
  goal: Goal | null;
  /** Garde-fous déjà formatés dans la langue (« 0,5 », « 4 »…), vides si off. */
  risk: string;
  trades: string;
  stop: string;
}

export interface JarvisLines {
  identity: string;
  arena: string;
  account: string;
  markets: string;
  style: string;
  experience: string;
  leak: string;
  /** La réponse de Jarvis, une fois l'angle mort choisi. */
  ack: string;
  guardrails: string;
  mission: string;
  look: string;
  start: string;
}

type Lines = readonly string[];
type Bank = Record<string, Lines>;

/** Index stable dans [0, n) pour une graine et une clé. */
function hashIndex(seed: string, key: string, n: number): number {
  let h = 2166136261;
  const s = `${seed}::${key}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % n;
}

/** Remplit `{jeton}` ; une variante dont un jeton reste vide est écartée. */
function fill(tpl: string, ctx: Record<string, string>): string | null {
  let missing = false;
  const out = tpl.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = ctx[k];
    if (!v) missing = true;
    return v ?? "";
  });
  return missing ? null : out;
}

/**
 * Choisit une variante parmi celles de la situation la plus précise qui en
 * propose une utilisable : `keys` va du plus spécifique au plus général.
 */
function choose(
  bank: Bank,
  keys: (string | null | false | undefined)[],
  ctx: Record<string, string>,
  seed: string,
): string {
  for (const key of keys) {
    if (!key) continue;
    const variants = bank[key];
    if (!variants) continue;
    const usable = variants.map((v) => fill(v, ctx)).filter((v): v is string => !!v);
    if (usable.length) return usable[hashIndex(seed, key, usable.length)];
  }
  return "";
}

/* ════════════════════════════ ANGLAIS ════════════════════════════ */
/* Le TITRE de chaque écran pose la question ; Jarvis ne la répète jamais. Il
   réagit à ce qui a déjà été dit, et dit ce que la réponse va changer. */

const EN: Record<keyof JarvisLines, Bank> = {
  identity: {
    any: [
      "I'm Jarvis, your coach in here. Your name opens every debrief I write.",
      "Jarvis here. I'll be in every debrief — first names, then.",
      "I read every trade you log. Let's start with who's trading.",
    ],
  },
  arena: {
    named: [
      "Good to meet you, {name}. This sets your account, your drawdown guard and the rules I check.",
      "{name}. This decides how strict I am — a challenge isn't a demo.",
      "Noted, {name}. Evaluation, funded or your own money — each gets different guardrails.",
    ],
    any: [
      "This sets your account, your drawdown guard and the rules I check.",
      "This decides how strict I am — a challenge isn't a demo.",
    ],
  },
  account: {
    prop_challenge: [
      "Every drawdown I show you starts from this number.",
      "I size every limit from it — before the firm does.",
      "That's the account I guard for the whole challenge.",
    ],
    funded: [
      "Funded is the hard part done. Now we keep it.",
      "Keeping this account comes before growing it.",
    ],
    personal: [
      "Your own money. Every % I show you is measured on this balance.",
      "Real capital — risk is measured from here.",
    ],
    demo: ["Treat this balance as real. I will.", "Paper money, real habits."],
    any: ["Every % I show you is measured on this balance."],
  },
  markets: {
    firm: [
      "On your {firm} {size}, your checklist and my briefings follow these markets.",
      "Your checklist follows these markets — on the {firm} account first.",
    ],
    prop: ["Your checklist follows the markets you pick."],
    demo: ["Pick what you practise on — your checklist is tuned to it."],
    any: [
      "Your checklist and my briefings follow your markets.",
      "The checklist you'll run each morning is built on these.",
    ],
  },
  style: {
    futures: [
      "In futures, your holding time sets your daily trade cap.",
      "Futures move fast — this decides how many trades a day I let pass quietly.",
    ],
    forex: [
      "London, New York or both — this shapes your session checklist.",
      "Your holding time decides when your forex day is over.",
    ],
    crypto: [
      "Crypto never closes. Your holding time decides when your day ends.",
      "No closing bell in crypto — so this sets your daily trade cap.",
    ],
    stocks: ["From the opening bell or overnight — this shapes your session."],
    options: ["With options, time costs you. This shapes your checklist."],
    any: [
      "It sets your daily trade cap and the shape of your session checklist.",
      "This decides how many trades a day I let pass quietly.",
    ],
  },
  experience: {
    funded: ["Already funded? Then I talk numbers, not basics."],
    scalping: [
      "I match how much I explain to your years of scalping.",
      "Scalping takes reps. Your answer sets my tone.",
    ],
    swing: ["Your years of swing trading set my tone."],
    any: ["More guidance early on, straight numbers later.", "This decides how much I explain."],
  },
  leak: {
    new: [
      "Saying it early makes everything after easier. I watch this first.",
      "Everyone has one. Yours is what I watch first, every trade.",
    ],
    veteran: [
      "You know your edge. This is the leak I watch first.",
      "Years in, one habit still costs you. I watch it first.",
    ],
    prop: [
      "On a prop account, one habit can end the run. I watch it first.",
      "This is what I guard the {firm} account against, first.",
    ],
    any: [
      "This is what I watch first, on every trade you log.",
      "No judgment — I just watch it first, every trade.",
    ],
  },
  ack: {
    "emotions:prop": [
      "Noted. On your {firm} account, after {stop} losses we stop — I'll hold you to it.",
      "Understood. After a red trade, I watch your next entry. {stop} losses and the day is over.",
    ],
    emotions: [
      "Understood. After a red trade, I'll be watching your next entry.",
      "Noted. {stop} losses in a day and we stop — no negotiation.",
      "Got it. When a day starts red, I'm on your next entry.",
    ],
    "overtrading:scalping": [
      "For a scalper, the line is a number: {trades} trades a day. Past it, I flag every entry.",
      "Understood. Fast is fine — {trades} trades, then every extra one gets flagged.",
    ],
    overtrading: [
      "Understood. Every trade past {trades} a day gets flagged.",
      "Noted. {trades} trades a day to start. I count, you decide.",
    ],
    "risk:prop": [
      "On a prop account, size is everything. Above {risk}% a trade, I flag it on the spot.",
      "Understood. Your cap is {risk}% — the {firm} account never takes more.",
    ],
    risk: [
      "Understood. Any trade above {risk}% of the account gets flagged the moment you log it.",
      "Noted. {risk}% per trade, maximum. I'll flag anything above.",
    ],
    consistency: [
      "Understood. Your plan becomes rules — and I count how often you keep them.",
      "Noted. No opinions: I'll show you, trade by trade, when you followed the plan.",
    ],
    journaling: [
      "Understood. Every session ends with a short review — that's where patterns show.",
      "Noted. Your checklist closes each day with two minutes of review. I read every one.",
    ],
  },
  guardrails: {
    prop_challenge: [
      "{firm} has its own limits. These sit inside them, so you never reach theirs.",
      "Your firm's rules end the challenge. These stop you well before.",
    ],
    funded: [
      "These keep the funded account alive. Growing it comes second.",
      "Built to protect the payouts. Adjust anything — I check every trade against them.",
    ],
    demo: [
      "Practise the rules too. Every demo trade is checked against them.",
      "Same rules as real money. That's the point of practice.",
    ],
    new: ["Start tight. You can loosen them once the numbers say so."],
    any: [
      "Built from your answers. Every trade you log is checked against them.",
      "Adjust anything. The moment a trade breaks one, you'll know.",
    ],
  },
  mission: {
    prop_challenge: [
      "Passing is the obvious answer. Make sure it's yours — I anchor everything to it.",
      "Whatever you pick, every piece of advice I give points at it.",
    ],
    funded: ["Ninety days from now, this is how we judge the account."],
    new: ["Pick what would make you proud in 90 days. I'll keep you pointed at it."],
    demo: ["Decide what practice should prove — then I hold you to it."],
    any: [
      "I anchor my advice to this mission.",
      "One mission for 90 days. Everything I say points at it.",
    ],
  },
  look: {
    named: [
      "Last thing, {name}. Profit stays green, loss stays red — whatever you pick.",
      "Almost done, {name}. Your colour runs through the whole app.",
    ],
    any: ["Your colour runs through the whole app. Profit stays green, loss stays red."],
  },
  start: {
    prop: [
      "Import your {firm} history and I read every trade. Or start fresh.",
      "Your first trade is where I start learning. Your {firm} statement works too.",
    ],
    demo: ["Want to see it alive first? Sample trades are clearly marked."],
    any: [
      "Your first trade is where I start learning.",
      "Bring your history and I'll read all of it — or start clean.",
    ],
  },
};

/* ════════════════════════════ FRANÇAIS ════════════════════════════ */

const FR: Record<keyof JarvisLines, Bank> = {
  identity: {
    any: [
      "Je suis Jarvis, ton coach ici. Ton prénom ouvre chaque débrief que j'écris.",
      "Ici Jarvis. Je serai dans chaque débrief — autant se tutoyer.",
      "Je lis chaque trade que tu loggues. Commençons par qui trade.",
    ],
  },
  arena: {
    named: [
      "Enchanté, {name}. Ça règle ton compte, ta protection de drawdown et les règles que je vérifie.",
      "{name}. Ta réponse décide de ma sévérité — un challenge n'est pas une démo.",
      "Noté, {name}. Évaluation, financé ou ton argent — chacun a ses garde-fous.",
    ],
    any: [
      "Ça règle ton compte, ta protection de drawdown et les règles que je vérifie.",
      "Ta réponse décide de ma sévérité — un challenge n'est pas une démo.",
    ],
  },
  account: {
    prop_challenge: [
      "Chaque drawdown que je t'affiche part de ce chiffre.",
      "Je dimensionne chaque limite dessus — avant la firme.",
      "C'est le compte que je garde pendant tout le challenge.",
    ],
    funded: [
      "Financé : le plus dur est fait. Maintenant, on le garde.",
      "Garder ce compte passe avant le faire grossir.",
    ],
    personal: [
      "Ton propre argent. Chaque % que je t'affiche se mesure sur ce solde.",
      "Du capital réel — le risque se mesure à partir d'ici.",
    ],
    demo: ["Traite ce solde comme du réel. Moi, je le ferai.", "Argent fictif, habitudes réelles."],
    any: ["Chaque % que je t'affiche se mesure sur ce solde."],
  },
  markets: {
    firm: [
      "Sur ton {firm} {size}, ta checklist et mes briefings suivent ces marchés.",
      "Ta checklist suit ces marchés — sur le compte {firm} d'abord.",
    ],
    prop: ["Ta checklist suit les marchés que tu choisis."],
    demo: ["Choisis sur quoi tu t'entraînes — ta checklist s'y règle."],
    any: [
      "Ta checklist et mes briefings suivent tes marchés.",
      "La checklist de chaque matin est construite dessus.",
    ],
  },
  style: {
    futures: [
      "Sur les futures, ta durée de détention fixe ton plafond de trades par jour.",
      "Les futures bougent vite — ça décide combien de trades par jour je laisse passer sans rien dire.",
    ],
    forex: [
      "Londres, New York ou les deux — ça façonne ta checklist de session.",
      "Ta durée de détention décide quand ta journée forex est finie.",
    ],
    crypto: [
      "La crypto ne ferme jamais. Ta durée de détention décide quand ta journée s'arrête.",
      "Pas de cloche en crypto — c'est donc ça qui fixe ton plafond du jour.",
    ],
    stocks: ["Dès l'ouverture ou en overnight — ça façonne ta session."],
    options: ["Avec les options, le temps te coûte. Ça façonne ta checklist."],
    any: [
      "Ça fixe ton plafond de trades par jour et la forme de ta checklist de session.",
      "Ça décide combien de trades par jour je laisse passer sans rien dire.",
    ],
  },
  experience: {
    funded: ["Déjà financé ? Alors je parle chiffres, pas bases."],
    scalping: [
      "J'ajuste ce que j'explique à tes années de scalping.",
      "Le scalping demande de la répétition. Ta réponse règle mon ton.",
    ],
    swing: ["Tes années de swing règlent mon ton."],
    any: [
      "Plus de guidage au début, des chiffres bruts ensuite.",
      "Ça décide de ce que j'explique.",
    ],
  },
  leak: {
    new: [
      "Le dire tôt rend tout le reste plus simple. Je surveille ça en premier.",
      "Tout le monde en a une. La tienne, je la surveille en premier, à chaque trade.",
    ],
    veteran: [
      "Tu connais ton edge. C'est cette fuite que je surveille en premier.",
      "Des années de métier, et une habitude te coûte encore. Je la surveille en premier.",
    ],
    prop: [
      "Sur un compte prop, une seule habitude peut tout arrêter. Je la surveille en premier.",
      "C'est contre ça que je protège le compte {firm}, en priorité.",
    ],
    any: [
      "C'est ce que je surveille en premier, sur chaque trade que tu loggues.",
      "Aucun jugement — je le surveille juste en premier, à chaque trade.",
    ],
  },
  ack: {
    "emotions:prop": [
      "Noté. Sur ton compte {firm}, après {stop} pertes on s'arrête — je te le rappellerai.",
      "Compris. Après un trade rouge, je surveille ta prochaine entrée. {stop} pertes et la journée est finie.",
    ],
    emotions: [
      "Compris. Après un trade rouge, je surveille ta prochaine entrée.",
      "Noté. {stop} pertes dans la journée et on s'arrête — sans négociation.",
      "Entendu. Quand une journée commence dans le rouge, je suis sur ta prochaine entrée.",
    ],
    "overtrading:scalping": [
      "Pour un scalpeur, la limite est un chiffre : {trades} trades par jour. Au-delà, je signale chaque entrée.",
      "Compris. Rapide, oui — {trades} trades, puis chaque trade en plus est signalé.",
    ],
    overtrading: [
      "Compris. Chaque trade au-delà de {trades} par jour est signalé.",
      "Noté. {trades} trades par jour pour commencer. Je compte, tu décides.",
    ],
    "risk:prop": [
      "Sur un compte prop, la taille fait tout. Au-dessus de {risk} % par trade, je signale sur-le-champ.",
      "Compris. Ton plafond est {risk} % — le compte {firm} n'en prend jamais plus.",
    ],
    risk: [
      "Compris. Tout trade au-dessus de {risk} % du compte est signalé dès que tu le loggues.",
      "Noté. {risk} % par trade, au maximum. Je signale tout ce qui dépasse.",
    ],
    consistency: [
      "Compris. Ton plan devient des règles — et je compte combien de fois tu les tiens.",
      "Noté. Pas d'avis : je te montre, trade par trade, quand tu as suivi le plan.",
    ],
    journaling: [
      "Compris. Chaque session se termine par une courte revue — c'est là que les schémas apparaissent.",
      "Noté. Ta checklist ferme chaque journée par deux minutes de revue. Je les lis toutes.",
    ],
  },
  guardrails: {
    prop_challenge: [
      "{firm} a ses propres limites. Celles-ci sont en dedans : tu n'atteins jamais les leurs.",
      "Les règles de ta firme arrêtent le challenge. Celles-ci t'arrêtent bien avant.",
    ],
    funded: [
      "Elles gardent le compte financé en vie. Le faire grossir vient ensuite.",
      "Pensées pour protéger les payouts. Ajuste ce que tu veux — je vérifie chaque trade.",
    ],
    demo: [
      "Entraîne-toi aussi aux règles. Chaque trade démo est vérifié contre elles.",
      "Les mêmes règles qu'en réel. C'est tout l'intérêt de l'entraînement.",
    ],
    new: ["Commence serré. Tu desserreras quand les chiffres le diront."],
    any: [
      "Construites à partir de tes réponses. Chaque trade loggué est vérifié contre elles.",
      "Ajuste ce que tu veux. Dès qu'un trade en casse une, tu le sais.",
    ],
  },
  mission: {
    prop_challenge: [
      "Passer, c'est la réponse évidente. Vérifie que c'est la tienne — j'ancre tout dessus.",
      "Quoi que tu choisisses, chacun de mes conseils pointera vers elle.",
    ],
    funded: ["Dans 90 jours, c'est sur ça qu'on jugera le compte."],
    new: ["Choisis ce dont tu serais fier dans 90 jours. Je te garde pointé dessus."],
    demo: ["Décide ce que l'entraînement doit prouver — ensuite, je t'y tiens."],
    any: [
      "J'ancre mes conseils sur cette mission.",
      "Une mission pour 90 jours. Tout ce que je dis pointe vers elle.",
    ],
  },
  look: {
    named: [
      "Dernière chose, {name}. Le gain reste vert, la perte rouge — quoi que tu choisisses.",
      "Presque fini, {name}. Ta couleur traverse toute l'app.",
    ],
    any: ["Ta couleur traverse toute l'app. Le gain reste vert, la perte rouge."],
  },
  start: {
    prop: [
      "Importe ton historique {firm} et je lis chaque trade. Ou repars à zéro.",
      "Ton premier trade, c'est là que j'apprends. Ton relevé {firm} marche aussi.",
    ],
    demo: ["Envie de voir l'app vivre d'abord ? Les trades d'exemple sont bien signalés."],
    any: [
      "Ton premier trade, c'est là que je commence à apprendre.",
      "Apporte ton historique, je le lis en entier — ou repars de zéro.",
    ],
  },
};

/* ════════════════════════════ LE CHOIX ════════════════════════════ */

const VETERAN: Experience[] = ["seasoned", "funded"];

/** Le marché qui donne le ton quand il est seul (sinon : générique). */
function soleMarket(assets: Market[]): Market | null {
  return assets.length === 1 ? assets[0] : null;
}

/**
 * Toutes les répliques de la séquence pour CE trader. Recalculées à chaque
 * réponse : un écran lu après un retour en arrière reflète la réponse modifiée.
 */
export function jarvisLines(lang: string, ctx: JarvisContext, seed: string): JarvisLines {
  const bank = lang === "fr" ? FR : EN;
  const name = ctx.name.trim().split(/\s+/)[0] ?? "";
  const prop = ctx.arena === "prop_challenge" || ctx.arena === "funded";
  const tokens: Record<string, string> = {
    name,
    firm: ctx.firm,
    size: ctx.size,
    risk: ctx.risk,
    trades: ctx.trades,
    stop: ctx.stop,
  };
  const pick = (scene: keyof JarvisLines, keys: (string | null | false | undefined)[]) =>
    choose(bank[scene], [...keys, "any"], tokens, seed);
  const veteran = ctx.experience ? VETERAN.includes(ctx.experience) : false;

  return {
    identity: pick("identity", []),
    arena: pick("arena", ["named"]),
    account: pick("account", [ctx.arena]),
    markets: pick("markets", [prop && "firm", prop && "prop", ctx.arena === "demo" && "demo"]),
    style: pick("style", [soleMarket(ctx.assets)]),
    experience: pick("experience", [ctx.arena === "funded" && "funded", ctx.style]),
    leak: pick("leak", [prop && "prop", veteran && "veteran", ctx.experience === "new" && "new"]),
    ack: ctx.leak
      ? pick("ack", [prop && `${ctx.leak}:prop`, ctx.style && `${ctx.leak}:${ctx.style}`, ctx.leak])
      : "",
    guardrails: pick("guardrails", [ctx.arena, ctx.experience === "new" && "new"]),
    mission: pick("mission", [ctx.arena, ctx.experience === "new" && "new"]),
    look: pick("look", ["named"]),
    start: pick("start", [prop && "prop", ctx.arena === "demo" && "demo"]),
  };
}
