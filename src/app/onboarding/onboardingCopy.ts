// Self-contained onboarding copy in every supported language. Kept out of the
// main i18n dictionary so the flow's strings stay together and reviewable.
// English is the source; each locale supplies a full set. Missing keys fall
// back to English via the spread in `oc()`.
import type { Lang } from "../i18n/translations";

export interface OnboardingCopy {
  cont: string;
  skip: string;
  styleTitle: string;
  styleSub: string;
  sScalper: string;
  sScalperD: string;
  sDay: string;
  sDayD: string;
  sSwing: string;
  sSwingD: string;
  painTitle: string;
  painSub: string;
  pCons: string;
  pConsD: string;
  pEmo: string;
  pEmoD: string;
  pRisk: string;
  pRiskD: string;
  pJour: string;
  pJourD: string;
  pOver: string;
  pOverD: string;
  revealTitle: string;
  revealPain: string;
  revealCta: string;
  revealSaving: string;
  // Quick-start step (optional per locale — falls back to English via oc()).
  // Onboarding V2 — situation + mirror ("your plan") steps.
  sitTitle?: string;
  sitSub?: string;
  sitProp?: string;
  sitPropD?: string;
  sitReal?: string;
  sitRealD?: string;
  sitLearn?: string;
  sitLearnD?: string;
  mirrorTitle?: string;
  mirrorPlanChecklist?: string;
  mirrorPlanCoach?: string;
  mirrorPlanReview?: string;
  mirrorPropExtra?: string;
  startTitle?: string;
  startSub?: string;
  startImport?: string;
  startImportD?: string;
  startDemo?: string;
  startDemoD?: string;
  startFresh?: string;
  startWorking?: string;
}

const en: OnboardingCopy = {
  cont: "Continue",
  skip: "Skip",
  styleTitle: "How do you trade it?",
  styleSub: "Your bread and butter.",
  sScalper: "Scalper",
  sScalperD: "In and out. Seconds to minutes.",
  sDay: "Day Trader",
  sDayD: "Flat by the close. No overnight risk.",
  sSwing: "Swing",
  sSwingD: "Days to weeks. Riding the bigger move.",
  painTitle: "What's costing you the most?",
  painSub: "Be honest — this is where we start.",
  pCons: "Consistency",
  pConsD: "Green week, red week, repeat.",
  pEmo: "Emotional control",
  pEmoD: "Revenge trades, FOMO, tilt.",
  pRisk: "Risk management",
  pRiskD: "One trade wrecks the month.",
  pJour: "Journaling",
  pJourD: "I don't log, so I don't learn.",
  pOver: "Overtrading",
  pOverD: "Can't sit on my hands.",
  revealTitle: "Your vault's ready.",
  revealPain: "We'll start with your biggest leak: {pain}",
  revealCta: "Enter TradeVault →",
  revealSaving: "Setting up…",
  sitTitle: "Where are you right now?",
  sitSub: "This shapes your whole TradeVault.",
  sitProp: "Prop-firm challenge",
  sitPropD: "FTMO, Apex, Topstep… rules to respect, a payout to reach.",
  sitReal: "Trading my own account",
  sitRealD: "Real money, building consistency.",
  sitLearn: "Learning / demo",
  sitLearnD: "Getting the reps in before sizing up.",
  mirrorTitle: "Your plan, built from your answers",
  mirrorPlanChecklist: "A pre-market checklist tuned to your style",
  mirrorPlanCoach: "Your AI coach will watch your #1 leak: {pain}",
  mirrorPlanReview: "A discipline score and streak, tracked every day",
  mirrorPropExtra: "Challenge mode: discipline first — one broken rule can end it",
  startTitle: "Fill your vault in seconds",
  startSub: "Your dashboard and analytics come alive with your first trades.",
  startImport: "Import my trades (CSV)",
  startImportD:
    "Bring your history from your broker or another journal — the fastest way to see your real edge.",
  startDemo: "Show me a demo",
  startDemoD:
    "We drop in 3 realistic sample trades (marked “Example”) so you can explore everything instantly.",
  startFresh: "Start from zero — I'll log my first trade myself",
  startWorking: "Preparing your vault…",
};

const fr: OnboardingCopy = {
  cont: "Continuer",
  skip: "Passer",
  styleTitle: "Comment tu les trades ?",
  styleSub: "Ton pain quotidien.",
  sScalper: "Scalpeur",
  sScalperD: "Dedans, dehors. Secondes à minutes.",
  sDay: "Day Trader",
  sDayD: "À plat à la clôture. Pas de risque overnight.",
  sSwing: "Swing",
  sSwingD: "Jours à semaines. Sur le mouvement de fond.",
  painTitle: "Qu'est-ce qui te coûte le plus ?",
  painSub: "Sois honnête — c'est notre point de départ.",
  pCons: "Régularité",
  pConsD: "Semaine verte, semaine rouge, en boucle.",
  pEmo: "Contrôle émotionnel",
  pEmoD: "Revenge trades, FOMO, tilt.",
  pRisk: "Gestion du risque",
  pRiskD: "Un trade flingue le mois.",
  pJour: "Tenue du journal",
  pJourD: "Je ne note pas, donc je n'apprends pas.",
  pOver: "Surtrading",
  pOverD: "Impossible de rester les mains dans les poches.",
  revealTitle: "Ton vault est prêt.",
  revealPain: "On commence par ta plus grosse fuite : {pain}",
  revealCta: "Entrer dans TradeVault →",
  revealSaving: "Configuration…",
  sitTitle: "Tu en es où, là ?",
  sitSub: "Ça façonne tout ton TradeVault.",
  sitProp: "Challenge prop-firm",
  sitPropD: "FTMO, Apex, Topstep… des règles à respecter, un payout à aller chercher.",
  sitReal: "Je trade mon propre compte",
  sitRealD: "Argent réel, cap sur la régularité.",
  sitLearn: "En apprentissage / démo",
  sitLearnD: "Je prends du volume avant de monter en taille.",
  mirrorTitle: "Ton plan, construit sur tes réponses",
  mirrorPlanChecklist: "Une checklist pré-market adaptée à ton style",
  mirrorPlanCoach: "Ton coach IA surveillera ta fuite n°1 : {pain}",
  mirrorPlanReview: "Un score de discipline et une série, suivis chaque jour",
  mirrorPropExtra: "Mode challenge : discipline d'abord — une règle brisée peut tout arrêter",
  startTitle: "Remplis ton vault en quelques secondes",
  startSub: "Ton dashboard et tes analytics prennent vie avec tes premiers trades.",
  startImport: "Importer mes trades (CSV)",
  startImportD:
    "Récupère ton historique depuis ton broker ou un autre journal — le moyen le plus rapide de voir ton vrai edge.",
  startDemo: "Voir une démo",
  startDemoD:
    "On insère 3 trades d'exemple réalistes (marqués « Exemple ») pour tout explorer instantanément.",
  startFresh: "Partir de zéro — je note mon premier trade moi-même",
  startWorking: "Préparation de ton vault…",
};

const es: OnboardingCopy = {
  cont: "Continuar",
  skip: "Omitir",
  styleTitle: "¿Cómo lo operas?",
  styleSub: "Tu pan de cada día.",
  sScalper: "Scalper",
  sScalperD: "Dentro y fuera. Segundos a minutos.",
  sDay: "Day Trader",
  sDayD: "Plano al cierre. Sin riesgo overnight.",
  sSwing: "Swing",
  sSwingD: "Días a semanas. Al movimiento mayor.",
  painTitle: "¿Qué es lo que más te cuesta?",
  painSub: "Sé honesto — aquí es donde empezamos.",
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
  revealPain: "Empezamos por tu mayor fuga: {pain}",
  revealCta: "Entrar a TradeVault →",
  revealSaving: "Configurando…",
};

const pt: OnboardingCopy = {
  cont: "Continuar",
  skip: "Pular",
  styleTitle: "Como você opera?",
  styleSub: "Seu feijão com arroz.",
  sScalper: "Scalper",
  sScalperD: "Entra e sai. Segundos a minutos.",
  sDay: "Day Trader",
  sDayD: "Zerado no fechamento. Sem risco overnight.",
  sSwing: "Swing",
  sSwingD: "Dias a semanas. No movimento maior.",
  painTitle: "O que mais te custa?",
  painSub: "Seja honesto — é aqui que começamos.",
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
  revealPain: "Vamos começar pelo seu maior vazamento: {pain}",
  revealCta: "Entrar no TradeVault →",
  revealSaving: "Configurando…",
};

const de: OnboardingCopy = {
  cont: "Weiter",
  skip: "Überspringen",
  styleTitle: "Wie tradest du?",
  styleSub: "Dein Brot-und-Butter-Stil.",
  sScalper: "Scalper",
  sScalperD: "Rein und raus. Sekunden bis Minuten.",
  sDay: "Day Trader",
  sDayD: "Glatt zum Close. Kein Overnight-Risiko.",
  sSwing: "Swing",
  sSwingD: "Tage bis Wochen. Auf der größeren Bewegung.",
  painTitle: "Was kostet dich am meisten?",
  painSub: "Sei ehrlich — hier fangen wir an.",
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
  revealPain: "Wir starten mit deinem größten Leck: {pain}",
  revealCta: "TradeVault betreten →",
  revealSaving: "Wird eingerichtet…",
};

const it: OnboardingCopy = {
  cont: "Continua",
  skip: "Salta",
  styleTitle: "Come lo tradi?",
  styleSub: "Il tuo pane quotidiano.",
  sScalper: "Scalper",
  sScalperD: "Dentro e fuori. Secondi o minuti.",
  sDay: "Day Trader",
  sDayD: "Flat alla chiusura. Nessun rischio overnight.",
  sSwing: "Swing",
  sSwingD: "Giorni o settimane. Sul movimento maggiore.",
  painTitle: "Cosa ti costa di più?",
  painSub: "Sii onesto — è da qui che partiamo.",
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
  revealPain: "Partiamo dalla tua falla più grande: {pain}",
  revealCta: "Entra in TradeVault →",
  revealSaving: "Configurazione…",
};

const nl: OnboardingCopy = {
  cont: "Doorgaan",
  skip: "Overslaan",
  styleTitle: "Hoe trade je het?",
  styleSub: "Je dagelijkse brood.",
  sScalper: "Scalper",
  sScalperD: "Erin en eruit. Seconden tot minuten.",
  sDay: "Day Trader",
  sDayD: "Vlak bij de close. Geen overnight-risico.",
  sSwing: "Swing",
  sSwingD: "Dagen tot weken. Op de grotere beweging.",
  painTitle: "Wat kost je het meest?",
  painSub: "Wees eerlijk — hier beginnen we.",
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
  revealPain: "We beginnen bij je grootste lek: {pain}",
  revealCta: "TradeVault binnengaan →",
  revealSaving: "Instellen…",
};

const ru: OnboardingCopy = {
  cont: "Продолжить",
  skip: "Пропустить",
  styleTitle: "Как ты торгуешь?",
  styleSub: "Твой основной стиль.",
  sScalper: "Скальпер",
  sScalperD: "Вошёл-вышел. Секунды-минуты.",
  sDay: "Дейтрейдер",
  sDayD: "К закрытию без позиций. Без риска овернайт.",
  sSwing: "Свинг",
  sSwingD: "Дни-недели. На крупном движении.",
  painTitle: "Что стоит тебе дороже всего?",
  painSub: "Честно — отсюда и начнём.",
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
  revealPain: "Начнём с твоей главной утечки: {pain}",
  revealCta: "Войти в TradeVault →",
  revealSaving: "Настройка…",
};

const zh: OnboardingCopy = {
  cont: "继续",
  skip: "跳过",
  styleTitle: "你怎么交易？",
  styleSub: "你的看家本领。",
  sScalper: "剥头皮",
  sScalperD: "快进快出。几秒到几分钟。",
  sDay: "日内交易者",
  sDayD: "收盘前平仓。无隔夜风险。",
  sSwing: "波段",
  sSwingD: "几天到几周。抓更大的行情。",
  painTitle: "什么让你损失最大？",
  painSub: "说实话——我们从这里开始。",
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
  revealPain: "我们先从你最大的漏洞开始：{pain}",
  revealCta: "进入 TradeVault →",
  revealSaving: "正在设置…",
};

const ja: OnboardingCopy = {
  cont: "続ける",
  skip: "スキップ",
  styleTitle: "どうトレードする？",
  styleSub: "あなたの得意技。",
  sScalper: "スキャルパー",
  sScalperD: "入って出る。数秒〜数分。",
  sDay: "デイトレーダー",
  sDayD: "引けまでにフラット。オーバーナイトなし。",
  sSwing: "スイング",
  sSwingD: "数日〜数週間。大きな動きに乗る。",
  painTitle: "一番コストになっているのは？",
  painSub: "正直に——ここから始めます。",
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
  revealPain: "まずは一番の穴から：{pain}",
  revealCta: "TradeVault に入る →",
  revealSaving: "設定中…",
};

const ar: OnboardingCopy = {
  cont: "متابعة",
  skip: "تخطٍّ",
  styleTitle: "كيف تتداولها؟",
  styleSub: "أسلوبك الأساسي.",
  sScalper: "مضارب سريع",
  sScalperD: "دخول وخروج. ثوانٍ إلى دقائق.",
  sDay: "متداول يومي",
  sDayD: "بلا مراكز عند الإغلاق. لا مخاطر ليلية.",
  sSwing: "سوينغ",
  sSwingD: "أيام إلى أسابيع. على الحركة الأكبر.",
  painTitle: "ما الذي يكلّفك أكثر؟",
  painSub: "كن صادقًا — من هنا نبدأ.",
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
  revealPain: "سنبدأ بأكبر ثغرة لديك: {pain}",
  revealCta: "ادخل TradeVault →",
  revealSaving: "جارٍ الإعداد…",
};

const hi: OnboardingCopy = {
  cont: "जारी रखें",
  skip: "छोड़ें",
  styleTitle: "आप इसे कैसे ट्रेड करते हैं?",
  styleSub: "आपका मुख्य तरीका।",
  sScalper: "स्कैल्पर",
  sScalperD: "अंदर और बाहर। सेकंड से मिनट।",
  sDay: "डे ट्रेडर",
  sDayD: "क्लोज़ तक फ्लैट। कोई ओवरनाइट रिस्क नहीं।",
  sSwing: "स्विंग",
  sSwingD: "दिन से हफ्ते। बड़े मूव पर।",
  painTitle: "सबसे ज़्यादा किस चीज़ की कीमत चुका रहे हैं?",
  painSub: "ईमानदार रहें — यहीं से शुरू करते हैं।",
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
  revealPain: "हम आपकी सबसे बड़ी लीक से शुरू करेंगे: {pain}",
  revealCta: "TradeVault में जाएँ →",
  revealSaving: "सेट हो रहा है…",
};

const ALL: Record<Lang, OnboardingCopy> = { en, fr, es, pt, de, it, nl, ru, zh, ja, ar, hi };

export function oc(lang: Lang): Required<OnboardingCopy> {
  // `en` defines every key (including the optional quick-start ones), so the
  // merged object is always complete — locales only override what they have.
  return { ...en, ...ALL[lang] } as Required<OnboardingCopy>;
}

/** Fills {placeholder} tokens. */
export function fmt(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}
