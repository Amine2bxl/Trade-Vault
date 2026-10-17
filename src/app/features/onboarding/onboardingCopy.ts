// La copie de l'onboarding, regroupée pour rester relisable d'un bloc.
//
// L'anglais est la source et définit TOUTES les clés ; le français est
// complet. Les dix autres langues gardent leurs traductions pour les clés dont
// le sens n'a pas changé (marchés, styles, niveaux, missions, angles morts…)
// et retombent sur l'anglais pour le reste, via la fusion de `oc()`.
//
// Chaque écran porte une ligne « pourquoi » (`why*`) : ce que la réponse
// CHANGE dans l'application. C'est elle qui fait d'une question un réglage —
// et chacune décrit une fonctionnalité qui existe (`docs/FEATURES.md`), sans
// chiffre ni promesse de résultat (`docs/PRODUCT.md`).
import type { Lang } from "@/app/i18n/translations";

export interface OnboardingCopy {
  // ── Cadre ──
  personalWelcome: string;
  systemModules: string;
  systemCalibrating: string;
  systemComplete: string;
  cont: string;
  skip: string;
  back: string;
  soundOn: string;
  soundOff: string;
  skipSetup: string;
  stepWord: string;
  // ── Allumage ──
  bootKicker: string;
  bootTitleA: string;
  bootTitleB: string;
  bootSub: string;
  bootCta: string;
  bootHint: string;
  bootP1: string;
  bootP2: string;
  bootP3: string;
  // ── Dossier trader (le panneau qui se remplit) ──
  fileTitle: string;
  fileLive: string;
  fileEmpty: string;
  fTrader: string;
  fArena: string;
  fAccount: string;
  fMarkets: string;
  fStyle: string;
  fExp: string;
  fLeak: string;
  fRules: string;
  fMission: string;
  rulesCount: string;
  // ── 1 · Identité ──
  idTitle: string;
  whyId: string;
  idPlaceholder: string;
  langTitle: string;
  // ── 2 · Arène ──
  arenaTitle: string;
  whyArena: string;
  arProp: string;
  arPropD: string;
  arFunded: string;
  arFundedD: string;
  arPersonal: string;
  arPersonalD: string;
  arDemo: string;
  arDemoD: string;
  // ── 3 · Compte ──
  firmTitle: string;
  capTitle: string;
  capTitleDemo: string;
  whyAccount: string;
  firmLabel: string;
  firmOther: string;
  sizeLabel: string;
  capitalLabel: string;
  capOther: string;
  currencyLabel: string;
  acctPersonal: string;
  acctDemo: string;
  acctFunded: string;
  acctProp: string;
  // ── 4 · Marchés ──
  assetsTitle: string;
  whyMarkets: string;
  aFutures: string;
  aFuturesD: string;
  aForex: string;
  aForexD: string;
  aStocks: string;
  aStocksD: string;
  aCrypto: string;
  aCryptoD: string;
  aOptions: string;
  aOptionsD: string;
  ictTitle: string;
  ictSub: string;
  ictYes: string;
  ictNo: string;
  // ── 5 · Style ──
  styleTitle: string;
  whyStyle: string;
  sScalper: string;
  sScalperD: string;
  sDay: string;
  sDayD: string;
  sSwing: string;
  sSwingD: string;
  // ── 6 · Expérience ──
  expTitle: string;
  whyExp: string;
  eNew: string;
  eNewD: string;
  eInt: string;
  eIntD: string;
  eSea: string;
  eSeaD: string;
  eFund: string;
  eFundD: string;
  // ── 7 · Angle mort ──
  painTitle: string;
  whyPain: string;
  pEmo: string;
  pEmoD: string;
  pOver: string;
  pOverD: string;
  pRisk: string;
  pRiskD: string;
  pCons: string;
  pConsD: string;
  pJour: string;
  pJourD: string;
  ackEmo: string;
  ackOver: string;
  ackRisk: string;
  ackCons: string;
  ackJour: string;
  // ── 8 · Garde-fous ──
  grTitle: string;
  whyGuard: string;
  grRisk: string;
  grRiskUnit: string;
  grTrades: string;
  grTradesUnit: string;
  grStop: string;
  grStopUnit: string;
  grDaily: string;
  grForYou: string;
  grArmed: string;
  grOff: string;
  grNotify: string;
  grNotifyOn: string;
  grNotifyBlocked: string;
  ruleRisk: string;
  ruleTrades: string;
  ruleStop: string;
  ruleDaily: string;
  // ── 9 · Mission ──
  goalTitle: string;
  whyGoal: string;
  gProp: string;
  gPropD: string;
  gFull: string;
  gFullD: string;
  gCons: string;
  gConsD: string;
  gDisc: string;
  gDiscD: string;
  gSide: string;
  gSideD: string;
  targetLabel: string;
  targetNone: string;
  // ── 10 · Apparence ──
  lookTitle: string;
  whyLook: string;
  // ── Calibration ──
  calTitle: string;
  calAccount: string;
  calMarkets: string;
  calRules: string;
  calChecklist: string;
  calJarvis: string;
  calLook: string;
  calHonest: string;
  calError: string;
  calRetry: string;
  revealTitle: string;
  // ── Lancement ──
  startTitle: string;
  startSub: string;
  startImport: string;
  startImportD: string;
  startBroker: string;
  startBrokerD: string;
  startDemo: string;
  startDemoD: string;
  startFresh: string;
  startWorking: string;
  launchSub: string;
}

const en: OnboardingCopy = {
  personalWelcome: "Welcome, {name}.",
  systemModules: "Calibration",
  systemCalibrating: "Calibrating",
  systemComplete: "Calibration complete",
  cont: "Continue",
  skip: "Skip",
  back: "Back",
  soundOn: "Sound on",
  soundOff: "Sound off",
  skipSetup: "Skip — I'll set it up later",
  stepWord: "Step",

  bootKicker: "TradeVault · calibration terminal",
  bootTitleA: "Your trading,",
  bootTitleB: "decoded.",
  bootSub:
    "Sixty seconds. A few honest answers. TradeVault rebuilds itself around the way you trade — your account, your rules, your blind spot.",
  bootCta: "Start calibration",
  bootHint: "Best with sound on",
  bootP1: "Your account and risk limits, pre-wired",
  bootP2: "Your rules checked on every trade you log",
  bootP3: "Jarvis briefed on your biggest leak",

  fileTitle: "Trader file",
  fileLive: "Live",
  fileEmpty: "Your answers write themselves here.",
  fTrader: "Trader",
  fArena: "Arena",
  fAccount: "Account",
  fMarkets: "Markets",
  fStyle: "Style",
  fExp: "Experience",
  fLeak: "Watching",
  fRules: "Guardrails",
  fMission: "Mission",
  rulesCount: "{n} armed",

  idTitle: "First — what should Jarvis call you?",
  whyId: "Jarvis is your coach inside TradeVault. He uses your name in every debrief.",
  idPlaceholder: "Your first name",
  langTitle: "Language",

  arenaTitle: "Where are you trading right now?",
  whyArena:
    "Sets up your account, your drawdown guard and the rules your trades are checked against.",
  arProp: "Prop firm challenge",
  arPropD: "Passing an evaluation",
  arFunded: "Funded account",
  arFundedD: "Keeping a funded account alive",
  arPersonal: "My own capital",
  arPersonalD: "A personal broker account",
  arDemo: "Demo / paper",
  arDemoD: "Practising before going live",

  firmTitle: "Which firm, and what size?",
  capTitle: "How much capital is in this account?",
  capTitleDemo: "What balance are you practising with?",
  whyAccount:
    "Your account opens at this size, in this currency — every % and every drawdown is right from your first trade.",
  firmLabel: "Firm",
  firmOther: "Other",
  sizeLabel: "Account size",
  capitalLabel: "Starting balance",
  capOther: "Other amount",
  currencyLabel: "Currency",
  acctPersonal: "Personal",
  acctDemo: "Demo",
  acctFunded: "Funded",
  acctProp: "Prop",

  assetsTitle: "What do you trade?",
  whyMarkets: "Your pre-market checklist and Jarvis are tuned to your markets.",
  aFutures: "Futures",
  aFuturesD: "NQ · ES · CL",
  aForex: "Forex",
  aForexD: "EUR/USD · GBP/USD",
  aStocks: "Stocks",
  aStocksD: "Equities · ETFs",
  aCrypto: "Crypto",
  aCryptoD: "BTC · ETH",
  aOptions: "Options",
  aOptionsD: "Calls · Puts",
  ictTitle: "Do you trade ICT / SMC concepts?",
  ictSub: "Adds liquidity and FVG checks to your checklist.",
  ictYes: "Yes",
  ictNo: "No",

  styleTitle: "How long do you usually hold a trade?",
  whyStyle: "Sets your trades-per-day guardrail and the shape of your session checklist.",
  sScalper: "Scalping",
  sScalperD: "Seconds to minutes",
  sDay: "Day trading",
  sDayD: "Flat by the close",
  sSwing: "Swing",
  sSwingD: "Days to weeks",

  expTitle: "How long have you been trading?",
  whyExp: "Jarvis adapts how he talks to you — more guidance early on, straight numbers later.",
  eNew: "Just starting",
  eNewD: "Under a year",
  eInt: "Finding my rhythm",
  eIntD: "1 to 3 years",
  eSea: "Experienced",
  eSeaD: "3+ years",
  eFund: "Funded",
  eFundD: "Payouts already",

  painTitle: "Be honest. What costs you the most money?",
  whyPain: "This is the blind spot Jarvis watches first, on every trade you log.",
  pEmo: "Revenge trading",
  pEmoD: "One red trade turns into three",
  pOver: "Overtrading",
  pOverD: "Taking setups that aren't setups",
  pRisk: "Oversizing",
  pRiskD: "One trade wipes out a week",
  pCons: "Breaking my plan",
  pConsD: "I know my rules. I don't follow them",
  pJour: "Never reviewing",
  pJourD: "Same mistakes, every week",
  ackEmo: "Understood. After a losing day starts, I'll be watching your next entry.",
  ackOver: "Understood. Every trade past your daily limit gets flagged.",
  ackRisk: "Understood. Any trade above your risk cap gets flagged the moment you log it.",
  ackCons: "Understood. Your plan becomes rules — and I'll measure how often you keep them.",
  ackJour: "Understood. Your checklist will close every session with a review.",

  grTitle: "Your guardrails.",
  whyGuard:
    "Built from your answers. Every trade you log is checked against them — you know the moment you break one.",
  grRisk: "Max risk per trade",
  grRiskUnit: "% of account",
  grTrades: "Max trades per day",
  grTradesUnit: "trades",
  grStop: "Stop for the day after",
  grStopUnit: "losses",
  grDaily: "Daily loss limit",
  grForYou: "For your blind spot",
  grArmed: "Armed",
  grOff: "Off",
  grNotify: "Alert me when I break one",
  grNotifyOn: "Alerts on",
  grNotifyBlocked: "Blocked by your browser — you can allow it later in Settings.",
  ruleRisk: "Never risk more than {v}% of my account on one trade.",
  ruleTrades: "No more than {v} trades per day.",
  ruleStop: "Stop trading for the day after {v} losses.",
  ruleDaily: "Daily loss limit: {v}. When I hit it, I stop.",

  goalTitle: "What does winning look like in 90 days?",
  whyGoal: "Jarvis anchors his advice to this mission.",
  gProp: "Pass my challenge",
  gPropD: "Hit the target, keep every rule",
  gFull: "Get paid every month",
  gFullD: "Consistent payouts",
  gCons: "One consistent month",
  gConsD: "Stop giving gains back",
  gDisc: "Zero broken rules",
  gDiscD: "Process first, P&L second",
  gSide: "A steady side income",
  gSideD: "Without the stress",
  targetLabel: "Monthly target — optional",
  targetNone: "None",

  lookTitle: "Last touch — make it yours.",
  whyLook: "Your colour runs through the whole app. Profit stays green, loss stays red — always.",

  calTitle: "Calibrating your vault",
  calAccount: "Opening {account}",
  calMarkets: "Tuning to {markets}",
  calRules: "Arming {n} guardrails",
  calChecklist: "Building your pre-market checklist",
  calJarvis: "Briefing Jarvis: {leak}",
  calLook: "Applying your colour",
  calHonest:
    "No statistics yet — Jarvis starts measuring from your first logged trades, and never shows a number without enough data.",
  calError: "We couldn't save your setup. Your answers are kept — try again.",
  calRetry: "Try again",
  revealTitle: "Your vault is ready.",

  startTitle: "How do you want to start?",
  startSub: "Your first trade is where Jarvis starts learning.",
  startImport: "Import my history",
  startImportD: "A CSV from your broker or prop firm — Jarvis reads all of it.",
  startBroker: "Connect Tradovate",
  startBrokerD: "Your trades sync on their own, read-only (Pro).",
  startDemo: "Explore with sample trades",
  startDemoD: "Three clearly-marked examples, to see the app come alive.",
  startFresh: "Start with an empty journal",
  startWorking: "Opening…",
  launchSub: "Your vault is calibrated.",
};

const fr: OnboardingCopy = {
  personalWelcome: "Bienvenue, {name}.",
  systemModules: "Calibration",
  systemCalibrating: "Calibration",
  systemComplete: "Calibration terminée",
  cont: "Continuer",
  skip: "Passer",
  back: "Retour",
  soundOn: "Son activé",
  soundOff: "Son coupé",
  skipSetup: "Passer — je configurerai plus tard",
  stepWord: "Étape",

  bootKicker: "TradeVault · terminal de calibration",
  bootTitleA: "Ton trading,",
  bootTitleB: "décodé.",
  bootSub:
    "Soixante secondes. Quelques réponses honnêtes. TradeVault se reconstruit autour de ta façon de trader — ton compte, tes règles, ton angle mort.",
  bootCta: "Lancer la calibration",
  bootHint: "Meilleur avec le son",
  bootP1: "Ton compte et tes limites de risque, déjà câblés",
  bootP2: "Tes règles vérifiées sur chaque trade loggé",
  bootP3: "Jarvis briefé sur ta plus grosse fuite",

  fileTitle: "Dossier trader",
  fileLive: "En direct",
  fileEmpty: "Tes réponses s'inscrivent ici.",
  fTrader: "Trader",
  fArena: "Terrain",
  fAccount: "Compte",
  fMarkets: "Marchés",
  fStyle: "Style",
  fExp: "Expérience",
  fLeak: "Sous surveillance",
  fRules: "Garde-fous",
  fMission: "Mission",
  rulesCount: "{n} activés",

  idTitle: "D'abord — comment Jarvis doit-il t'appeler ?",
  whyId: "Jarvis est ton coach dans TradeVault. Il utilise ton prénom dans chaque débrief.",
  idPlaceholder: "Ton prénom",
  langTitle: "Langue",

  arenaTitle: "Sur quoi trades-tu en ce moment ?",
  whyArena:
    "Ça configure ton compte, ta garde de drawdown et les règles contre lesquelles tes trades sont vérifiés.",
  arProp: "Challenge prop firm",
  arPropD: "Je passe une évaluation",
  arFunded: "Compte financé",
  arFundedD: "Je dois garder mon compte en vie",
  arPersonal: "Mon propre capital",
  arPersonalD: "Un compte chez mon broker",
  arDemo: "Démo / papier",
  arDemoD: "Je m'entraîne avant le réel",

  firmTitle: "Quelle prop firm, et quelle taille ?",
  capTitle: "Combien de capital sur ce compte ?",
  capTitleDemo: "Avec quel solde t'entraînes-tu ?",
  whyAccount:
    "Ton compte s'ouvre à cette taille, dans cette devise — chaque % et chaque drawdown est juste dès ton premier trade.",
  firmLabel: "Prop firm",
  firmOther: "Autre",
  sizeLabel: "Taille du compte",
  capitalLabel: "Solde de départ",
  capOther: "Autre montant",
  currencyLabel: "Devise",
  acctPersonal: "Personnel",
  acctDemo: "Démo",
  acctFunded: "Financé",
  acctProp: "Prop",

  assetsTitle: "Que trades-tu ?",
  whyMarkets: "Ta checklist pré-market et Jarvis sont réglés sur tes marchés.",
  aFutures: "Futures",
  aFuturesD: "NQ · ES · CL",
  aForex: "Forex",
  aForexD: "EUR/USD · GBP/USD",
  aStocks: "Actions",
  aStocksD: "Titres · ETF",
  aCrypto: "Crypto",
  aCryptoD: "BTC · ETH",
  aOptions: "Options",
  aOptionsD: "Calls · Puts",
  ictTitle: "Tu trades les concepts ICT / SMC ?",
  ictSub: "Ajoute les vérifications liquidité et FVG à ta checklist.",
  ictYes: "Oui",
  ictNo: "Non",

  styleTitle: "Combien de temps tiens-tu un trade, en général ?",
  whyStyle: "Règle ta limite de trades par jour et la forme de ta checklist de session.",
  sScalper: "Scalping",
  sScalperD: "Secondes à minutes",
  sDay: "Day trading",
  sDayD: "À plat à la clôture",
  sSwing: "Swing",
  sSwingD: "Jours à semaines",

  expTitle: "Depuis combien de temps trades-tu ?",
  whyExp:
    "Jarvis adapte sa façon de te parler — plus de guidage au début, des chiffres bruts ensuite.",
  eNew: "Je débute",
  eNewD: "Moins d'un an",
  eInt: "Je trouve mon rythme",
  eIntD: "1 à 3 ans",
  eSea: "Expérimenté",
  eSeaD: "3 ans et plus",
  eFund: "Financé",
  eFundD: "Déjà des payouts",

  painTitle: "Sois honnête. Qu'est-ce qui te coûte le plus d'argent ?",
  whyPain: "C'est l'angle mort que Jarvis surveille en premier, sur chaque trade que tu logges.",
  pEmo: "Le revenge trading",
  pEmoD: "Un trade perdant en appelle trois",
  pOver: "L'overtrading",
  pOverD: "Je prends des setups qui n'en sont pas",
  pRisk: "Le sur-risque",
  pRiskD: "Un trade efface une semaine",
  pCons: "Je casse mon plan",
  pConsD: "Je connais mes règles. Je ne les suis pas",
  pJour: "Je ne relis jamais",
  pJourD: "Les mêmes erreurs, chaque semaine",
  ackEmo: "Compris. Dès qu'une journée part dans le rouge, je surveille ta prochaine entrée.",
  ackOver: "Compris. Chaque trade au-delà de ta limite du jour sera signalé.",
  ackRisk: "Compris. Tout trade au-dessus de ton risque max sera signalé dès que tu le logges.",
  ackCons: "Compris. Ton plan devient des règles — et je mesure combien de fois tu les tiens.",
  ackJour: "Compris. Ta checklist terminera chaque session par une revue.",

  grTitle: "Tes garde-fous.",
  whyGuard:
    "Construits à partir de tes réponses. Chaque trade loggé est vérifié contre eux — tu sais à l'instant où tu en casses un.",
  grRisk: "Risque max. par trade",
  grRiskUnit: "% du compte",
  grTrades: "Trades max. par jour",
  grTradesUnit: "trades",
  grStop: "Stop pour la journée après",
  grStopUnit: "pertes",
  grDaily: "Perte max. du jour",
  grForYou: "Pour ton angle mort",
  grArmed: "Activé",
  grOff: "Désactivé",
  grNotify: "M'alerter quand j'en casse un",
  grNotifyOn: "Alertes activées",
  grNotifyBlocked: "Bloquées par ton navigateur — tu pourras les autoriser dans les Réglages.",
  ruleRisk: "Jamais plus de {v} % du compte risqués sur un trade.",
  ruleTrades: "Pas plus de {v} trades par jour.",
  ruleStop: "J'arrête pour la journée après {v} pertes.",
  ruleDaily: "Perte max. du jour : {v}. Quand je l'atteins, j'arrête.",

  goalTitle: "À quoi ressemble la victoire dans 90 jours ?",
  whyGoal: "Jarvis ancre ses conseils sur cette mission.",
  gProp: "Passer mon challenge",
  gPropD: "Atteindre l'objectif, tenir chaque règle",
  gFull: "Être payé chaque mois",
  gFullD: "Des payouts réguliers",
  gCons: "Un mois régulier",
  gConsD: "Arrêter de rendre mes gains",
  gDisc: "Zéro règle cassée",
  gDiscD: "Le process d'abord, le P&L ensuite",
  gSide: "Un revenu d'appoint stable",
  gSideD: "Sans le stress",
  targetLabel: "Objectif mensuel — facultatif",
  targetNone: "Aucun",

  lookTitle: "Dernière touche — fais-le tien.",
  whyLook: "Ta couleur traverse toute l'app. Le gain reste vert, la perte rouge — toujours.",

  calTitle: "Calibration de ton espace",
  calAccount: "Ouverture de {account}",
  calMarkets: "Réglage sur {markets}",
  calRules: "Activation de {n} garde-fous",
  calChecklist: "Construction de ta checklist pré-market",
  calJarvis: "Briefing de Jarvis : {leak}",
  calLook: "Application de ta couleur",
  calHonest:
    "Aucune statistique pour l'instant — Jarvis commence à mesurer dès tes premiers trades loggés, et n'affiche jamais un chiffre sans assez de données.",
  calError: "Impossible d'enregistrer ta configuration. Tes réponses sont gardées — réessaie.",
  calRetry: "Réessayer",
  revealTitle: "Ton espace est prêt.",

  startTitle: "Comment veux-tu commencer ?",
  startSub: "Ton premier trade, c'est là que Jarvis commence à apprendre.",
  startImport: "Importer mon historique",
  startImportD: "Un CSV de ton broker ou de ta prop firm — Jarvis lit tout.",
  startBroker: "Connecter Tradovate",
  startBrokerD: "Tes trades se synchronisent seuls, en lecture seule (Pro).",
  startDemo: "Explorer avec des trades d'exemple",
  startDemoD: "Trois exemples bien signalés, pour voir l'app prendre vie.",
  startFresh: "Commencer avec un journal vide",
  startWorking: "Ouverture…",
  launchSub: "Ton espace est calibré.",
};

// ── Les dix autres langues ──
// Seules les clés dont le SENS n'a pas changé sont conservées ; le reste
// retombe sur l'anglais (voir `oc()`). L'ancien parcours les traduisait
// toutes, mais ses écrans n'existent plus.

const es: Partial<OnboardingCopy> = {
  personalWelcome: "Bienvenido, {name}.",
  systemModules: "Módulos de calibración",
  systemCalibrating: "Calibrando",
  systemComplete: "Calibración completa",
  cont: "Continuar",
  skip: "Omitir",
  langTitle: "Elige tu idioma",
  aFutures: "Futuros",
  aForex: "Forex",
  aStocks: "Acciones",
  aOptions: "Opciones",
  aCrypto: "Cripto",
  assetsTitle: "¿Qué operas?",
  styleTitle: "¿Cómo lo operas?",
  sScalper: "Scalper",
  sScalperD: "Dentro y fuera. Segundos a minutos.",
  sDay: "Day Trader",
  sDayD: "Plano al cierre. Sin riesgo overnight.",
  sSwing: "Swing",
  sSwingD: "Días a semanas. Al movimiento mayor.",
  ictTitle: "¿Operas conceptos ICT / SMC?",
  ictSub: "Order blocks, liquidez, FVG, killzones.",
  ictYes: "Sí, soy yo",
  ictNo: "La verdad no",
  expTitle: "¿Cuánto llevas en esto?",
  eNew: "Recién empiezo",
  eNewD: "Menos de un año",
  eInt: "Agarrando ritmo",
  eIntD: "1 a 3 años",
  eSea: "Con experiencia",
  eSeaD: "3 años o más",
  eFund: "Fondeado / Prop",
  eFundD: "Opero capital asignado",
  goalTitle: "¿Cuál es la misión ahora?",
  gCons: "Ser consistente",
  gConsD: "Dejar de devolver las ganancias.",
  gProp: "Pasar un challenge prop",
  gPropD: "Llegar al objetivo, respetar las reglas.",
  gFull: "Vivir de esto",
  gFullD: "Reemplazar el sueldo.",
  gSide: "Ingreso extra",
  gSideD: "Sumar algo, sin estrés.",
  gDisc: "Construir disciplina",
  gDiscD: "Dominar la mente, no solo los charts.",
  painTitle: "¿Qué es lo que más te cuesta?",
  pCons: "Consistencia",
  pConsD: "Semana verde, semana roja, repetir.",
  pEmo: "Control emocional",
  pEmoD: "Revenge trades, FOMO, tilt.",
  pRisk: "Gestión del riesgo",
  pRiskD: "Una operación arruina el mes.",
  pJour: "Llevar el diario",
  pJourD: "No registro, así que no aprendo.",
  pOver: "Sobreoperar",
  pOverD: "No puedo quedarme quieto.",
  revealTitle: "Tu vault está listo.",
};

const pt: Partial<OnboardingCopy> = {
  personalWelcome: "Bem-vindo, {name}.",
  systemModules: "Módulos de calibração",
  systemCalibrating: "Calibrando",
  systemComplete: "Calibração concluída",
  cont: "Continuar",
  skip: "Pular",
  langTitle: "Escolha seu idioma",
  aFutures: "Futuros",
  aForex: "Forex",
  aStocks: "Ações",
  aOptions: "Opções",
  aCrypto: "Cripto",
  assetsTitle: "O que você opera?",
  styleTitle: "Como você opera?",
  sScalper: "Scalper",
  sScalperD: "Entra e sai. Segundos a minutos.",
  sDay: "Day Trader",
  sDayD: "Zerado no fechamento. Sem risco overnight.",
  sSwing: "Swing",
  sSwingD: "Dias a semanas. No movimento maior.",
  ictTitle: "Você opera conceitos ICT / SMC?",
  ictSub: "Order blocks, liquidez, FVG, killzones.",
  ictYes: "Sim, sou eu",
  ictNo: "Nem tanto",
  expTitle: "Há quanto tempo nisso?",
  eNew: "Comecei agora",
  eNewD: "Menos de um ano",
  eInt: "Pegando o ritmo",
  eIntD: "1 a 3 anos",
  eSea: "Experiente",
  eSeaD: "3 anos ou mais",
  eFund: "Financiado / Prop",
  eFundD: "Opero capital alocado",
  goalTitle: "Qual é a missão agora?",
  gCons: "Ficar consistente",
  gConsD: "Parar de devolver os ganhos.",
  gProp: "Passar num challenge prop",
  gPropD: "Bater a meta, respeitar as regras.",
  gFull: "Viver disso",
  gFullD: "Substituir o salário.",
  gSide: "Renda extra",
  gSideD: "Somar algo, sem estresse.",
  gDisc: "Construir disciplina",
  gDiscD: "Dominar a mente, não só os gráficos.",
  painTitle: "O que mais te custa?",
  pCons: "Consistência",
  pConsD: "Semana verde, semana vermelha, repete.",
  pEmo: "Controle emocional",
  pEmoD: "Revenge trade, FOMO, tilt.",
  pRisk: "Gestão de risco",
  pRiskD: "Um trade destrói o mês.",
  pJour: "Manter o diário",
  pJourD: "Não registro, então não aprendo.",
  pOver: "Overtrading",
  pOverD: "Não consigo ficar parado.",
  revealTitle: "Seu vault está pronto.",
};

const de: Partial<OnboardingCopy> = {
  personalWelcome: "Willkommen, {name}.",
  systemModules: "Kalibrierungsmodule",
  systemCalibrating: "Kalibrierung",
  systemComplete: "Kalibrierung abgeschlossen",
  cont: "Weiter",
  skip: "Überspringen",
  langTitle: "Wähle deine Sprache",
  aFutures: "Futures",
  aForex: "Forex",
  aStocks: "Aktien",
  aOptions: "Optionen",
  aCrypto: "Krypto",
  assetsTitle: "Was tradest du?",
  styleTitle: "Wie tradest du?",
  sScalper: "Scalper",
  sScalperD: "Rein und raus. Sekunden bis Minuten.",
  sDay: "Day Trader",
  sDayD: "Glatt zum Close. Kein Overnight-Risiko.",
  sSwing: "Swing",
  sSwingD: "Tage bis Wochen. Auf der größeren Bewegung.",
  ictTitle: "Tradest du ICT / SMC Konzepte?",
  ictSub: "Order Blocks, Liquidität, FVGs, Killzones.",
  ictYes: "Ja, das bin ich",
  ictNo: "Eher nicht",
  expTitle: "Wie lange machst du das schon?",
  eNew: "Grade angefangen",
  eNewD: "Unter einem Jahr",
  eInt: "Sammle Reps",
  eIntD: "1–3 Jahre",
  eSea: "Erfahren",
  eSeaD: "3 Jahre+",
  eFund: "Funded / Prop",
  eFundD: "Ich trade zugewiesenes Kapital",
  goalTitle: "Was ist gerade die Mission?",
  gCons: "Konstant werden",
  gConsD: "Aufhören, Gewinne zurückzugeben.",
  gProp: "Prop-Challenge bestehen",
  gPropD: "Ziel treffen, Regeln einhalten.",
  gFull: "Vollzeit gehen",
  gFullD: "Das Gehalt ersetzen.",
  gSide: "Nebeneinkommen",
  gSideD: "Extra sammeln, wenig Stress.",
  gDisc: "Disziplin aufbauen",
  gDiscD: "Den Kopf meistern, nicht nur die Charts.",
  painTitle: "Was kostet dich am meisten?",
  pCons: "Konstanz",
  pConsD: "Grüne Woche, rote Woche, Wiederholung.",
  pEmo: "Emotionskontrolle",
  pEmoD: "Revenge Trades, FOMO, Tilt.",
  pRisk: "Risikomanagement",
  pRiskD: "Ein Trade ruiniert den Monat.",
  pJour: "Journal führen",
  pJourD: "Ich logge nicht, also lerne ich nicht.",
  pOver: "Overtrading",
  pOverD: "Kann nicht stillhalten.",
  revealTitle: "Dein Vault ist bereit.",
};

const it: Partial<OnboardingCopy> = {
  personalWelcome: "Benvenuto, {name}.",
  systemModules: "Moduli di calibrazione",
  systemCalibrating: "Calibrazione",
  systemComplete: "Calibrazione completata",
  cont: "Continua",
  skip: "Salta",
  langTitle: "Scegli la lingua",
  aFutures: "Futures",
  aForex: "Forex",
  aStocks: "Azioni",
  aOptions: "Opzioni",
  aCrypto: "Cripto",
  assetsTitle: "Cosa tradi?",
  styleTitle: "Come lo tradi?",
  sScalper: "Scalper",
  sScalperD: "Dentro e fuori. Secondi o minuti.",
  sDay: "Day Trader",
  sDayD: "Flat alla chiusura. Nessun rischio overnight.",
  sSwing: "Swing",
  sSwingD: "Giorni o settimane. Sul movimento maggiore.",
  ictTitle: "Tradi i concetti ICT / SMC?",
  ictSub: "Order block, liquidità, FVG, killzone.",
  ictYes: "Sì, sono io",
  ictNo: "Non proprio",
  expTitle: "Da quanto lo fai?",
  eNew: "Appena iniziato",
  eNewD: "Meno di un anno",
  eInt: "Prendo ritmo",
  eIntD: "1–3 anni",
  eSea: "Esperto",
  eSeaD: "3 anni e oltre",
  eFund: "Funded / Prop",
  eFundD: "Trado capitale allocato",
  goalTitle: "Qual è la missione ora?",
  gCons: "Diventare costante",
  gConsD: "Smettere di restituire i profitti.",
  gProp: "Passare una challenge prop",
  gPropD: "Colpire il target, rispettare le regole.",
  gFull: "Fare full-time",
  gFullD: "Sostituire lo stipendio.",
  gSide: "Entrata extra",
  gSideD: "Accumulare extra, poco stress.",
  gDisc: "Costruire disciplina",
  gDiscD: "Dominare la mente, non solo i grafici.",
  painTitle: "Cosa ti costa di più?",
  pCons: "Costanza",
  pConsD: "Settimana verde, settimana rossa, ripeti.",
  pEmo: "Controllo emotivo",
  pEmoD: "Revenge trade, FOMO, tilt.",
  pRisk: "Gestione del rischio",
  pRiskD: "Un trade rovina il mese.",
  pJour: "Tenere il diario",
  pJourD: "Non registro, quindi non imparo.",
  pOver: "Overtrading",
  pOverD: "Non riesco a stare fermo.",
  revealTitle: "Il tuo vault è pronto.",
};

const nl: Partial<OnboardingCopy> = {
  personalWelcome: "Welkom, {name}.",
  systemModules: "Kalibratiemodules",
  systemCalibrating: "Kalibreren",
  systemComplete: "Kalibratie voltooid",
  cont: "Doorgaan",
  skip: "Overslaan",
  langTitle: "Kies je taal",
  aFutures: "Futures",
  aForex: "Forex",
  aStocks: "Aandelen",
  aOptions: "Opties",
  aCrypto: "Crypto",
  assetsTitle: "Wat trade je?",
  styleTitle: "Hoe trade je het?",
  sScalper: "Scalper",
  sScalperD: "Erin en eruit. Seconden tot minuten.",
  sDay: "Day Trader",
  sDayD: "Vlak bij de close. Geen overnight-risico.",
  sSwing: "Swing",
  sSwingD: "Dagen tot weken. Op de grotere beweging.",
  ictTitle: "Trade je ICT / SMC concepten?",
  ictSub: "Order blocks, liquiditeit, FVG's, killzones.",
  ictYes: "Ja, dat ben ik",
  ictNo: "Niet echt",
  expTitle: "Hoe lang doe je dit al?",
  eNew: "Net begonnen",
  eNewD: "Minder dan een jaar",
  eInt: "Reps aan het maken",
  eIntD: "1–3 jaar",
  eSea: "Ervaren",
  eSeaD: "3 jaar+",
  eFund: "Funded / Prop",
  eFundD: "Ik trade toegewezen kapitaal",
  goalTitle: "Wat is nu de missie?",
  gCons: "Consistent worden",
  gConsD: "Stop met winst teruggeven.",
  gProp: "Een prop-challenge halen",
  gPropD: "Haal het doel, respecteer de regels.",
  gFull: "Fulltime gaan",
  gFullD: "Het salaris vervangen.",
  gSide: "Bijverdienste",
  gSideD: "Extra sparen, weinig stress.",
  gDisc: "Discipline opbouwen",
  gDiscD: "Beheers de geest, niet alleen de charts.",
  painTitle: "Wat kost je het meest?",
  pCons: "Consistentie",
  pConsD: "Groene week, rode week, herhaal.",
  pEmo: "Emotiecontrole",
  pEmoD: "Revenge trades, FOMO, tilt.",
  pRisk: "Risicobeheer",
  pRiskD: "Eén trade verpest de maand.",
  pJour: "Journal bijhouden",
  pJourD: "Ik log niet, dus ik leer niet.",
  pOver: "Overtrading",
  pOverD: "Kan niet stilzitten.",
  revealTitle: "Je vault is klaar.",
};

const ru: Partial<OnboardingCopy> = {
  personalWelcome: "Добро пожаловать, {name}.",
  systemModules: "Модули калибровки",
  systemCalibrating: "Калибровка",
  systemComplete: "Калибровка завершена",
  cont: "Продолжить",
  skip: "Пропустить",
  langTitle: "Выбери язык",
  aFutures: "Фьючерсы",
  aForex: "Форекс",
  aStocks: "Акции",
  aOptions: "Опционы",
  aCrypto: "Крипта",
  assetsTitle: "Чем ты торгуешь?",
  styleTitle: "Как ты торгуешь?",
  sScalper: "Скальпер",
  sScalperD: "Вошёл-вышел. Секунды-минуты.",
  sDay: "Дейтрейдер",
  sDayD: "К закрытию без позиций. Без риска овернайт.",
  sSwing: "Свинг",
  sSwingD: "Дни-недели. На крупном движении.",
  ictTitle: "Торгуешь по ICT / SMC?",
  ictSub: "Order blocks, ликвидность, FVG, killzones.",
  ictYes: "Да, это про меня",
  ictNo: "Не особо",
  expTitle: "Сколько ты в этом?",
  eNew: "Только начал",
  eNewD: "Меньше года",
  eInt: "Набираю опыт",
  eIntD: "1–3 года",
  eSea: "Опытный",
  eSeaD: "3 года и больше",
  eFund: "Funded / Prop",
  eFundD: "Торгую выделенный капитал",
  goalTitle: "Какая сейчас цель?",
  gCons: "Стать стабильным",
  gConsD: "Перестать отдавать прибыль.",
  gProp: "Пройти prop-челлендж",
  gPropD: "Достичь цели, соблюсти правила.",
  gFull: "Уйти в фултайм",
  gFullD: "Заменить зарплату.",
  gSide: "Доп. доход",
  gSideD: "Добавить сверху, без стресса.",
  gDisc: "Построить дисциплину",
  gDiscD: "Освоить ум, а не только графики.",
  painTitle: "Что стоит тебе дороже всего?",
  pCons: "Стабильность",
  pConsD: "Зелёная неделя, красная неделя, по кругу.",
  pEmo: "Контроль эмоций",
  pEmoD: "Отыгрыш, FOMO, тильт.",
  pRisk: "Риск-менеджмент",
  pRiskD: "Одна сделка убивает месяц.",
  pJour: "Ведение журнала",
  pJourD: "Не записываю — значит не учусь.",
  pOver: "Овертрейдинг",
  pOverD: "Не могу сидеть на руках.",
  revealTitle: "Твой vault готов.",
};

const zh: Partial<OnboardingCopy> = {
  personalWelcome: "欢迎，{name}。",
  systemModules: "校准模块",
  systemCalibrating: "正在校准",
  systemComplete: "校准完成",
  cont: "继续",
  skip: "跳过",
  langTitle: "选择你的语言",
  aFutures: "期货",
  aForex: "外汇",
  aStocks: "股票",
  aOptions: "期权",
  aCrypto: "加密货币",
  assetsTitle: "你交易什么？",
  styleTitle: "你怎么交易？",
  sScalper: "剥头皮",
  sScalperD: "快进快出。几秒到几分钟。",
  sDay: "日内交易者",
  sDayD: "收盘前平仓。无隔夜风险。",
  sSwing: "波段",
  sSwingD: "几天到几周。抓更大的行情。",
  ictTitle: "你交易 ICT / SMC 概念吗？",
  ictSub: "订单块、流动性、FVG、killzone。",
  ictYes: "是的，就是我",
  ictNo: "不太算",
  expTitle: "你做多久了？",
  eNew: "刚起步",
  eNewD: "不到一年",
  eInt: "正在积累",
  eIntD: "1–3 年",
  eSea: "老手",
  eSeaD: "3 年以上",
  eFund: "受资 / Prop",
  eFundD: "交易分配的资金",
  goalTitle: "现在的目标是什么？",
  gCons: "变得稳定",
  gConsD: "别再把利润还回去。",
  gProp: "通过 prop 挑战",
  gPropD: "达成目标，遵守规则。",
  gFull: "转为全职",
  gFullD: "取代工资。",
  gSide: "副业收入",
  gSideD: "多赚一点，压力小。",
  gDisc: "建立纪律",
  gDiscD: "掌控心态，而不只是图表。",
  painTitle: "什么让你损失最大？",
  pCons: "稳定性",
  pConsD: "绿一周，红一周，反复循环。",
  pEmo: "情绪控制",
  pEmoD: "报复性交易、FOMO、上头。",
  pRisk: "风险管理",
  pRiskD: "一笔交易毁掉一个月。",
  pJour: "记录日志",
  pJourD: "不记录，所以学不到东西。",
  pOver: "过度交易",
  pOverD: "闲不住手。",
  revealTitle: "你的 vault 已就绪。",
};

const ja: Partial<OnboardingCopy> = {
  personalWelcome: "ようこそ、{name}。",
  systemModules: "キャリブレーション",
  systemCalibrating: "調整中",
  systemComplete: "調整完了",
  cont: "続ける",
  skip: "スキップ",
  langTitle: "言語を選ぶ",
  aFutures: "先物",
  aForex: "FX",
  aStocks: "株式",
  aOptions: "オプション",
  aCrypto: "暗号資産",
  assetsTitle: "何をトレードする？",
  styleTitle: "どうトレードする？",
  sScalper: "スキャルパー",
  sScalperD: "入って出る。数秒〜数分。",
  sDay: "デイトレーダー",
  sDayD: "引けまでにフラット。オーバーナイトなし。",
  sSwing: "スイング",
  sSwingD: "数日〜数週間。大きな動きに乗る。",
  ictTitle: "ICT / SMC を使う？",
  ictSub: "オーダーブロック、流動性、FVG、キルゾーン。",
  ictYes: "はい、まさに",
  ictNo: "あまり",
  expTitle: "どれくらいやってる？",
  eNew: "始めたばかり",
  eNewD: "1年未満",
  eInt: "経験を積み中",
  eIntD: "1〜3年",
  eSea: "熟練",
  eSeaD: "3年以上",
  eFund: "ファンデッド / Prop",
  eFundD: "割り当て資金でトレード",
  goalTitle: "今のミッションは？",
  gCons: "安定する",
  gConsD: "勝ち分を返すのをやめる。",
  gProp: "propチャレンジ突破",
  gPropD: "目標達成、ルール順守。",
  gFull: "専業になる",
  gFullD: "給料を置き換える。",
  gSide: "副収入",
  gSideD: "少し上乗せ、低ストレス。",
  gDisc: "規律を築く",
  gDiscD: "チャートだけでなくメンタルを制す。",
  painTitle: "一番コストになっているのは？",
  pCons: "一貫性",
  pConsD: "勝ち週、負け週、繰り返し。",
  pEmo: "感情のコントロール",
  pEmoD: "リベンジトレード、FOMO、ティルト。",
  pRisk: "リスク管理",
  pRiskD: "1トレードで月をぶち壊す。",
  pJour: "日誌をつける",
  pJourD: "記録しないから学べない。",
  pOver: "オーバートレード",
  pOverD: "手を止められない。",
  revealTitle: "あなたの vault が準備完了。",
};

const ar: Partial<OnboardingCopy> = {
  personalWelcome: "مرحبًا، {name}.",
  systemModules: "وحدات المعايرة",
  systemCalibrating: "جارٍ الضبط",
  systemComplete: "اكتملت المعايرة",
  cont: "متابعة",
  skip: "تخطٍّ",
  langTitle: "اختر لغتك",
  aFutures: "العقود الآجلة",
  aForex: "الفوركس",
  aStocks: "الأسهم",
  aOptions: "الخيارات",
  aCrypto: "الكريبتو",
  assetsTitle: "ماذا تتداول؟",
  styleTitle: "كيف تتداولها؟",
  sScalper: "مضارب سريع",
  sScalperD: "دخول وخروج. ثوانٍ إلى دقائق.",
  sDay: "متداول يومي",
  sDayD: "بلا مراكز عند الإغلاق. لا مخاطر ليلية.",
  sSwing: "سوينغ",
  sSwingD: "أيام إلى أسابيع. على الحركة الأكبر.",
  ictTitle: "هل تتداول مفاهيم ICT / SMC؟",
  ictSub: "أوردر بلوك، السيولة، FVG، الكيل زون.",
  ictYes: "نعم، هذا أنا",
  ictNo: "ليس تمامًا",
  expTitle: "منذ متى وأنت في هذا؟",
  eNew: "بدأت للتو",
  eNewD: "أقل من سنة",
  eInt: "أكتسب خبرة",
  eIntD: "1–3 سنوات",
  eSea: "محترف",
  eSeaD: "3 سنوات فأكثر",
  eFund: "ممول / Prop",
  eFundD: "أتداول رأس مال مخصّص",
  goalTitle: "ما المهمة الآن؟",
  gCons: "أصبح ثابتًا",
  gConsD: "توقف عن إعادة الأرباح.",
  gProp: "اجتياز تحدي prop",
  gPropD: "حقّق الهدف، احترم القواعد.",
  gFull: "التفرّغ الكامل",
  gFullD: "استبدال الراتب.",
  gSide: "دخل إضافي",
  gSideD: "أضف قليلًا، بضغط أقل.",
  gDisc: "بناء الانضباط",
  gDiscD: "أتقن العقل، لا الرسوم فقط.",
  painTitle: "ما الذي يكلّفك أكثر؟",
  pCons: "الثبات",
  pConsD: "أسبوع أخضر، أسبوع أحمر، وتكرار.",
  pEmo: "التحكم العاطفي",
  pEmoD: "صفقات انتقامية، FOMO، تيلت.",
  pRisk: "إدارة المخاطر",
  pRiskD: "صفقة واحدة تدمّر الشهر.",
  pJour: "تدوين المذكرة",
  pJourD: "لا أسجّل، فلا أتعلّم.",
  pOver: "الإفراط في التداول",
  pOverD: "لا أستطيع الجلوس مكتوف اليدين.",
  revealTitle: "خزنتك جاهزة.",
};

const hi: Partial<OnboardingCopy> = {
  personalWelcome: "स्वागत है, {name}।",
  systemModules: "कैलिब्रेशन मॉड्यूल",
  systemCalibrating: "कैलिब्रेशन जारी",
  systemComplete: "कैलिब्रेशन पूरा",
  cont: "जारी रखें",
  skip: "छोड़ें",
  langTitle: "अपनी भाषा चुनें",
  aFutures: "फ्यूचर्स",
  aForex: "फॉरेक्स",
  aStocks: "स्टॉक्स",
  aOptions: "ऑप्शन्स",
  aCrypto: "क्रिप्टो",
  assetsTitle: "आप क्या ट्रेड करते हैं?",
  styleTitle: "आप इसे कैसे ट्रेड करते हैं?",
  sScalper: "स्कैल्पर",
  sScalperD: "अंदर और बाहर। सेकंड से मिनट।",
  sDay: "डे ट्रेडर",
  sDayD: "क्लोज़ तक फ्लैट। कोई ओवरनाइट रिस्क नहीं।",
  sSwing: "स्विंग",
  sSwingD: "दिन से हफ्ते। बड़े मूव पर।",
  ictTitle: "क्या आप ICT / SMC कॉन्सेप्ट ट्रेड करते हैं?",
  ictSub: "ऑर्डर ब्लॉक, लिक्विडिटी, FVG, किलज़ोन।",
  ictYes: "हाँ, बिल्कुल मैं",
  ictNo: "ज़्यादा नहीं",
  expTitle: "आप कब से यह कर रहे हैं?",
  eNew: "अभी शुरू किया",
  eNewD: "एक साल से कम",
  eInt: "अनुभव बढ़ा रहा हूँ",
  eIntD: "1–3 साल",
  eSea: "अनुभवी",
  eSeaD: "3 साल+",
  eFund: "फंडेड / Prop",
  eFundD: "आवंटित पूँजी ट्रेड करता हूँ",
  goalTitle: "अभी मिशन क्या है?",
  gCons: "निरंतर बनना",
  gConsD: "मुनाफ़ा वापस देना बंद करें।",
  gProp: "prop चैलेंज पास करना",
  gPropD: "टारगेट हिट करें, नियम मानें।",
  gFull: "फुल-टाइम जाना",
  gFullD: "तनख्वाह की जगह लेना।",
  gSide: "साइड इनकम",
  gSideD: "थोड़ा अतिरिक्त, कम तनाव।",
  gDisc: "अनुशासन बनाना",
  gDiscD: "सिर्फ़ चार्ट नहीं, दिमाग पर काबू।",
  painTitle: "सबसे ज़्यादा किस चीज़ की कीमत चुका रहे हैं?",
  pCons: "निरंतरता",
  pConsD: "हरा हफ्ता, लाल हफ्ता, दोहराव।",
  pEmo: "भावनाओं पर नियंत्रण",
  pEmoD: "रिवेंज ट्रेड, FOMO, टिल्ट।",
  pRisk: "रिस्क मैनेजमेंट",
  pRiskD: "एक ट्रेड पूरा महीना बिगाड़ देता है।",
  pJour: "जर्नल रखना",
  pJourD: "लॉग नहीं करता, तो सीखता नहीं।",
  pOver: "ओवरट्रेडिंग",
  pOverD: "हाथ पर हाथ धरे नहीं बैठ सकता।",
  revealTitle: "आपका vault तैयार है।",
};

const ALL: Record<Lang, Partial<OnboardingCopy>> = {
  en,
  fr,
  es,
  pt,
  de,
  it,
  nl,
  ru,
  zh,
  ja,
  ar,
  hi,
};

export function oc(lang: Lang): OnboardingCopy {
  // `en` définit chaque clé : la fusion est toujours complète, chaque langue
  // ne remplace que ce qu'elle a.
  return { ...en, ...ALL[lang] };
}

/** Remplit les jetons `{nom}`. */
export function fmt(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}
