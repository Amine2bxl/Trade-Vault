// LES AFFICHES — réseaux sociaux et kit partenaire (influenceurs).
//
//   cd video && bun install && cd ..      (une fois : Inter vient de @fontsource)
//   node scripts/affiches.mjs             → content/affiches/{fr,en}/…
//
// Six concepts × trois formats × deux langues, plus le kit partenaire (trois
// planches + un PDF). Tout est dessiné ici en HTML, avec les VRAIES captures de
// `src/assets/product/` (les variantes téléphone `-m`), puis photographié par
// Chromium en 2x et réduit dans le navigateur : le texte reste net au format
// natif de chaque réseau.
//
// Règles tenues (AGENTS.md, skill landing-copy) :
//   - aucune promesse de gain, aucun chiffre ni avis inventé ;
//   - les captures portent « Vraie app · données d'exemple », un chiffre
//     d'illustration porte « Exemple illustratif » ;
//   - vitrine Liquid : fond #050607, UN accent (#22e08a, la vitrine), Inter,
//     cartes opaques à grand rayon, bouton plein texte blanc, rien ne rayonne
//     (lueur d'ambiance ≤ 0,08, ombres noires sous ce qui flotte).
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Playwright n'est pas une dépendance du dépôt : on prend celui de la machine
// (un `require` suit NODE_PATH, un `import` non).
const { chromium } = createRequire(import.meta.url)("playwright");

const ROOT = resolve(import.meta.dirname, "..");
const OUT = join(ROOT, "content/affiches");
const FONTS = join(ROOT, "video/node_modules/@fontsource/inter/files");
if (!existsSync(FONTS)) {
  console.error("Inter introuvable : lancer d'abord `cd video && bun install`.");
  process.exit(1);
}
const url = (p) => pathToFileURL(join(ROOT, p)).href;
const shot = (id) => url(`src/assets/product/${id}-m.webp`);
const LOGO = url("src/assets/tradevault-logo.webp");

/* ── LES FORMATS — largeur de mise en page 1080, sortie au format natif. ── */
const FORMATS = {
  feed: { w: 1080, h: 1350, out: [1080, 1350], note: "Instagram / Facebook / TikTok photo (4:5)" },
  story: { w: 1080, h: 1920, out: [1080, 1920], note: "Story, Reel, TikTok (9:16)" },
  pin: { w: 1080, h: 1620, out: [1000, 1500], note: "Pinterest (2:3)" },
};

/* ── LES TEXTES COMMUNS ── */
const UI = {
  fr: {
    cta: "Commencer gratuitement",
    risk: "Gratuit pour toujours · sans carte bancaire",
    demo: "Vraie app · données d'exemple",
    illus: "Exemple illustratif",
  },
  en: {
    cta: "Get started free",
    risk: "Free forever · No credit card",
    demo: "Real app · example data",
    illus: "Illustrative example",
  },
};

/* ── LES CONCEPTS — une douleur, une preuve, une action. `*mot*` = accent. ── */
const CONCEPTS = [
  {
    id: "01-strategie",
    visual: {
      type: "phone",
      shot: "mistakes",
      focus: 0.36,
      zoom: [0.045, 0.398, 0.91, 0.1],
      tone: "red",
    },
    fr: {
      eyebrow: "Discipline",
      h1: ["Ce n'est pas ta stratégie", "*qui te fait perdre.*"],
      sub: "TradeVault repère les règles que tu casses, et ce qu'elles te coûtent.",
    },
    en: {
      eyebrow: "Discipline",
      h1: ["It's not your strategy", "*that's costing you.*"],
      sub: "TradeVault spots the rules you break, and what they cost you.",
    },
  },
  {
    id: "02-revenge",
    visual: { type: "drift" },
    fr: {
      eyebrow: "Après une perte",
      h1: ["Tu avais prévu 1 %.", "*Tu as risqué 1,8 %.*"],
      sub: "Grossir après une perte : le réflexe que tu ne vois pas en direct. TradeVault le mesure, trade par trade.",
      planned: "Risque prévu",
      after: "Après une perte",
      a: "1,0 %",
      b: "1,8 %",
    },
    en: {
      eyebrow: "After a loss",
      h1: ["You planned 1% risk.", "*You took 1.8%.*"],
      sub: "Sizing up after a loss is the reflex you can't see live. TradeVault measures it, trade by trade.",
      planned: "Planned risk",
      after: "After a loss",
      a: "1.0%",
      b: "1.8%",
    },
  },
  {
    id: "03-challenge",
    visual: { type: "price" },
    fr: {
      eyebrow: "Prop firms",
      h1: ["Un challenge raté coûte plus", "*que TradeVault à vie.*"],
      sub: "Un seul trade indiscipliné évité rembourse la licence.",
      left: "Un challenge raté",
      leftFig: "200–600 $",
      leftNote: "à chaque tentative",
      right: "TradeVault à vie",
      rightFig: "49 €",
      rightNote: "une fois · ou 9 €/mois sans engagement",
    },
    en: {
      eyebrow: "Prop firms",
      h1: ["A failed challenge costs more", "*than TradeVault for life.*"],
      sub: "One undisciplined trade avoided pays for the license.",
      left: "A failed challenge",
      leftFig: "$200–600",
      leftNote: "every single attempt",
      right: "TradeVault for life",
      rightFig: "€49",
      rightNote: "once · or €9/month, no commitment",
    },
  },
  {
    id: "04-jarvis",
    visual: { type: "phone", shot: "jarvis", focus: 0.3, zoom: [0.035, 0.31, 0.93, 0.2] },
    fr: {
      eyebrow: "Jarvis · coach IA",
      h1: ["Ton journal enregistre.", "*Jarvis diagnostique.*"],
      sub: "Chaque conseil porte ses chiffres et ses trades. Il ne prédit jamais le marché.",
    },
    en: {
      eyebrow: "Jarvis · AI coach",
      h1: ["Your journal records.", "*Jarvis diagnoses.*"],
      sub: "Every insight comes with its numbers and its trades. It never predicts the market.",
    },
  },
  {
    id: "05-checklist",
    visual: { type: "phone", shot: "checklist", focus: 0.32, zoom: [0.04, 0.46, 0.92, 0.175] },
    fr: {
      eyebrow: "Checklist pré-market",
      h1: ["Tes règles avant l'entrée.", "*Pas après la perte.*"],
      sub: "Un plan verrouillé avant l'ouverture, des questions d'entrée à chaque trade.",
    },
    en: {
      eyebrow: "Pre-market checklist",
      h1: ["Your rules before the entry.", "*Not after the loss.*"],
      sub: "A plan locked before the open, entry questions on every trade.",
    },
  },
  {
    id: "06-gratuit",
    visual: { type: "free" },
    fr: {
      eyebrow: "Offre gratuite",
      h1: ["Gratuit pour toujours.", "*Pas un essai.*"],
      sub: "Sept outils qu'aucune offre ne ferme. Dix nouveaux trades par mois, c'est la seule limite.",
      tools: [
        "Journal",
        "Tableau de bord",
        "Calendrier",
        "Checklist pré-market",
        "Plan de trading",
        "Calculateur de position",
        "Analyses",
      ],
    },
    en: {
      eyebrow: "Free plan",
      h1: ["Free forever.", "*Not a trial.*"],
      sub: "Seven tools no plan ever locks. Ten new trades a month is the only limit.",
      tools: [
        "Journal",
        "Dashboard",
        "Calendar",
        "Pre-market checklist",
        "Trading plan",
        "Position calculator",
        "Analytics",
      ],
    },
  },
];

/* ── LE KIT PARTENAIRE — trois planches 4:5, assemblées en PDF. ── */
const KIT = {
  fr: {
    tag: "Kit partenaire",
    cover: {
      h1: ["Le coach IA qui te montre", "*pourquoi tu perds.*"],
      sub: "Et qui te refait la discipline, semaine après semaine. Pour les traders en challenge prop firm, les comptes financés et le retail actif.",
    },
    why: {
      h1: ["Ce que ta communauté", "*y gagne.*"],
      items: [
        [
          "Chaque affirmation a sa preuve",
          "Jarvis cite ses chiffres, sa période, son échantillon, et renvoie aux trades. Aucune conclusion sur un échantillon trop faible.",
        ],
        [
          "Un score de comportement",
          "L'Edge Score, de 0 à 100, ignore volontairement le P&L : il note la discipline, pas la chance.",
        ],
        [
          "Les fuites chiffrées",
          "Taille qui grossit après une perte, overtrading, entrées hors plan : repérés, avec ce qu'ils coûtent.",
        ],
      ],
    },
    offer: {
      h1: ["Une offre", "*simple à recommander.*"],
      plans: [
        ["Gratuit", "0 €", "Pour toujours. Sept outils, dix nouveaux trades par mois."],
        ["Pro mensuel", "9 €", "Par mois, sans engagement, résiliable en un clic."],
        ["Pro à vie", "49 €", "Une seule fois. Le même produit, sans renouvellement."],
      ],
      never:
        "Ce que TradeVault ne fait jamais : promettre un gain, donner des signaux, prédire le marché.",
      contact: "tradevault.be · @tradevault.be",
    },
  },
  en: {
    tag: "Partner kit",
    cover: {
      h1: ["The AI coach that shows you", "*why you lose.*"],
      sub: "And rebuilds your discipline, week after week. Built for prop-firm challenges, funded accounts and serious retail traders.",
    },
    why: {
      h1: ["What your audience", "*actually gets.*"],
      items: [
        [
          "Every claim has its evidence",
          "Jarvis cites its numbers, period and sample size, and links back to the trades. No conclusion on a sample that's too small.",
        ],
        [
          "A behavior score",
          "The Edge Score, 0 to 100, leaves P&L out on purpose: it rates discipline, not luck.",
        ],
        [
          "Leaks, priced",
          "Sizing up after a loss, overtrading, off-plan entries: spotted, with what they cost.",
        ],
      ],
    },
    offer: {
      h1: ["An offer that's", "*easy to recommend.*"],
      plans: [
        ["Free", "€0", "Forever. Seven tools, ten new trades a month."],
        ["Pro monthly", "€9", "Per month, no commitment, cancel in one click."],
        ["Pro lifetime", "€49", "Paid once. Same product, never renews."],
      ],
      never: "What TradeVault never does: promise profits, sell signals, predict the market.",
      contact: "tradevault.be · @tradevault.be",
    },
  },
};

/* ════════════════════════════════════════════════════════════════════ */

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** « *mot* » → mot en accent. */
const md = (s) => esc(s).replace(/\*(.+?)\*/g, '<em class="a">$1</em>');

const CSS = `
@font-face { font-family: Inter; font-weight: 500; src: url(${pathToFileURL(join(FONTS, "inter-latin-500-normal.woff2")).href}); }
@font-face { font-family: Inter; font-weight: 600; src: url(${pathToFileURL(join(FONTS, "inter-latin-600-normal.woff2")).href}); }
@font-face { font-family: Inter; font-weight: 700; src: url(${pathToFileURL(join(FONTS, "inter-latin-700-normal.woff2")).href}); }
@font-face { font-family: Inter; font-weight: 800; src: url(${pathToFileURL(join(FONTS, "inter-latin-800-normal.woff2")).href}); }
@font-face { font-family: "TV Num"; font-weight: 800; src: url(${url("public/fonts/tradevault-numerals-800.v1.woff")}); unicode-range: U+0030-0039; }
:root {
  --bg: #050607; --plate: #101113; --plate-2: #16181b; --line: rgb(255 255 255 / 0.09);
  --text: #f4f5f6; --muted: #a3acb6; --dim: #6b7480;
  --accent: #22e08a; --accent-rgb: 34 224 138; --loss: #f87171; --loss-rgb: 248 113 113;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: var(--bg); }
body { font-family: Inter, system-ui, sans-serif; color: var(--text); -webkit-font-smoothing: antialiased; }
.a { font-style: normal; color: var(--accent); }
.num { font-family: "TV Num", Inter, sans-serif; font-variant-numeric: tabular-nums; font-weight: 800; }

.poster { position: relative; overflow: hidden; display: flex; flex-direction: column; padding: 68px 72px 64px; background: var(--bg); }
/* Le fond : une lueur menthe à 0,07, la trame qui s'efface — rien d'autre ne rayonne. */
.poster::before { content: ""; position: absolute; inset: 0; pointer-events: none;
  background:
    radial-gradient(760px 560px at 86% -6%, rgb(var(--accent-rgb) / 0.07), rgb(var(--accent-rgb) / 0.025) 45%, transparent 70%),
    radial-gradient(820px 820px at -10% 55%, rgb(86 96 210 / 0.05), transparent 65%); }
.poster::after { content: ""; position: absolute; inset: 0; pointer-events: none;
  background-image: linear-gradient(rgb(255 255 255 / 0.026) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.026) 1px, transparent 1px);
  background-size: 60px 60px; mask-image: linear-gradient(to bottom, #000, transparent 55%); }
.poster > * { position: relative; z-index: 1; }

.brand { display: flex; align-items: center; justify-content: space-between; }
.brand .id { display: flex; align-items: center; gap: 16px; font-size: 38px; letter-spacing: -0.035em; }
.brand img { width: 56px; height: 56px; }
.brand .id b { font-weight: 800; } .brand .id span { font-weight: 500; opacity: 0.65; }
.brand .handle { font-size: 24px; font-weight: 600; color: var(--muted); letter-spacing: 0.01em; }

.eyebrow { display: inline-flex; align-items: center; gap: 12px; margin-top: 64px; padding: 11px 20px 11px 16px;
  border-radius: 999px; background: var(--plate); box-shadow: inset 0 0 0 1px var(--line);
  font-size: 22px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #c9d1d9; align-self: flex-start; }
.eyebrow i { width: 10px; height: 10px; border-radius: 99px; background: var(--accent); }
h1 { margin-top: 30px; font-weight: 800; letter-spacing: -0.045em; line-height: 1.0; text-wrap: balance; }
h1 span { display: block; }
.sub { margin-top: 28px; font-size: 32px; line-height: 1.38; font-weight: 500; color: var(--muted); max-width: 900px; text-wrap: pretty; }

.poster.feed .eyebrow { margin-top: 44px; }
.poster.feed h1 { margin-top: 24px; }
.poster.feed .sub { margin-top: 20px; font-size: 28px; }
.visual { flex: 1; position: relative; margin-top: 40px; min-height: 0; overflow: hidden; margin-left: -72px; margin-right: -72px; padding: 0 72px; }

/* Le téléphone : la vraie capture, coupée par le bas et fondue dans le fond. */
.phone { position: absolute; left: 50%; top: 0; transform: translateX(-50%); padding: 12px; border-radius: 64px;
  background: #0c0d0f; box-shadow: inset 0 0 0 1.5px rgb(255 255 255 / 0.14), 0 40px 100px rgb(0 0 0 / 0.7); }
.phone .screen { border-radius: 52px; overflow: hidden; background-repeat: no-repeat; background-size: 100% auto; }
.fade { position: absolute; left: 0; right: 0; bottom: -1px; height: 220px; background: linear-gradient(to bottom, rgb(5 6 7 / 0), var(--bg) 85%); z-index: 2; }
/* La loupe : la MÊME capture, recadrée et agrandie — une carte qui flotte. */
.loupe { position: absolute; z-index: 3; border-radius: 30px; background-repeat: no-repeat; background-color: var(--plate);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.1), 0 30px 70px rgb(0 0 0 / 0.75), 0 6px 18px rgb(0 0 0 / 0.6); }
.loupe::after { content: ""; position: absolute; inset: 0; border-radius: 30px; box-shadow: inset 0 0 0 3px var(--ring); }
.tag { position: absolute; z-index: 4; font-size: 19px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
  color: rgb(201 209 217 / 0.85); padding: 10px 16px; border-radius: 12px; background: #0b0c0e; box-shadow: inset 0 0 0 1px var(--line); }

/* Les cartes de contenu : opaques, grand rayon, aucun verre. */
.card { background: var(--plate); border-radius: 36px; box-shadow: inset 0 0 0 1px var(--line); }

.foot { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-top: 36px; }
.risk-line { margin-top: 18px; font-size: 22px; font-weight: 500; color: var(--muted); }
.btn { display: inline-flex; align-items: center; gap: 14px; padding: 28px 42px; border-radius: 22px; background: var(--accent); color: #fff;
  font-size: 34px; font-weight: 700; letter-spacing: -0.01em; text-shadow: 0 1px 2px rgb(0 0 0 / 0.35);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.22), 0 2px 6px rgb(0 0 0 / 0.5); white-space: nowrap; }
.foot .site { font-size: 34px; font-weight: 700; letter-spacing: -0.01em; white-space: nowrap; }
`;

/* ── LES VISUELS ── */

/** Téléphone + loupe. `focus` = hauteur (0..1) de la capture placée en haut du
    cadre. La loupe est dimensionnée APRÈS mise en page (script `FIT`) : elle
    occupe ~60 % de la zone visuelle, quelle que soit la longueur du titre. */
function phoneVisual(v, f, lang) {
  const screenW = f === "story" ? 600 : f === "pin" ? 540 : 470;
  const screenH = Math.round((screenW * 1800) / 780);
  const offset = Math.round(v.focus * screenH * 0.55);
  const ring = v.tone === "red" ? "rgb(248 113 113 / 0.85)" : "rgb(34 224 138 / 0.8)";
  return `
    <div class="phone" style="top:0">
      <div class="screen" style="width:${screenW}px;height:${screenH - offset}px;background-image:url(${shot(v.shot)});background-position:0 -${offset}px"></div>
    </div>
    <div class="fade"></div>
    <div class="loupe-wrap" style="position:absolute;left:72px;right:72px;z-index:3;display:flex;flex-direction:column;align-items:center">
      <div class="loupe" data-crop="${v.zoom.join(",")}" style="--ring:${ring};position:relative;background-image:url(${shot(v.shot)})"></div>
      <div class="tag" style="position:static;align-self:flex-start;margin-top:22px">${esc(UI[lang].demo)}</div>
    </div>`;
}

const FIT = `<script>
for (const el of document.querySelectorAll(".loupe[data-crop]")) {
  const [x, y, w, h] = el.dataset.crop.split(",").map(Number);
  const vis = el.closest(".visual");
  const wrap = el.parentElement;
  const H = vis.clientHeight;
  const ratio = (h * 1800) / (w * 780);
  const W = Math.min(vis.clientWidth - 144, (H * 0.6) / ratio);
  const s = W / (w * 780);
  el.style.width = W + "px";
  el.style.height = W * ratio + "px";
  el.style.backgroundSize = 780 * s + "px auto";
  el.style.backgroundPosition = "-" + x * 780 * s + "px -" + y * 1800 * s + "px";
  wrap.style.top = Math.max(0, (H - wrap.offsetHeight) * 0.6) + "px";
}
</script>`;

function driftVisual(c, lang, f) {
  const k = f === "story" ? 1.25 : f === "feed" ? 0.85 : 1;
  return `
    <div style="position:absolute;inset:0 72px;display:flex;flex-direction:column;justify-content:center;gap:${22 * k}px">
      <div class="card" style="padding:${40 * k}px 48px;display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:28px;font-weight:600;color:var(--muted)">${esc(c.planned)}</div>
        <div class="num" style="font-size:${120 * k}px;letter-spacing:-0.04em;line-height:1">${esc(c.a)}</div>
      </div>
      <div style="display:flex;justify-content:center;color:var(--dim)">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v15M6 13l6 6 6-6"/></svg>
      </div>
      <div class="card" style="padding:${40 * k}px 48px;display:flex;align-items:center;justify-content:space-between;box-shadow:inset 0 0 0 2px rgb(var(--loss-rgb) / 0.55)">
        <div style="font-size:28px;font-weight:600;color:var(--loss)">${esc(c.after)}</div>
        <div class="num" style="font-size:${150 * k}px;letter-spacing:-0.04em;line-height:1;color:var(--loss)">${esc(c.b)}</div>
      </div>
      <div style="margin-top:6px;font-size:20px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--dim)">${esc(UI[lang].illus)}</div>
    </div>`;
}

function priceVisual(c, f) {
  const k = f === "story" ? 1.2 : f === "feed" ? 0.9 : 1;
  const col = (label, fig, note, hero) => `
    <div class="card" style="flex:1;padding:44px 40px;display:flex;flex-direction:column;justify-content:space-between;min-height:${360 * k}px;${hero ? "box-shadow:inset 0 0 0 2px rgb(var(--accent-rgb) / 0.6)" : ""}">
      <div style="font-size:28px;font-weight:600;color:${hero ? "var(--text)" : "var(--muted)"}">${esc(label)}</div>
      <div>
        <div class="num" style="font-size:${hero ? 132 : 92 * Math.min(1, k)}px;letter-spacing:-0.045em;line-height:1;color:${hero ? "var(--accent)" : "var(--text)"};white-space:nowrap">${esc(fig)}</div>
        <div style="margin-top:16px;font-size:23px;line-height:1.35;color:var(--muted)">${esc(note)}</div>
      </div>
    </div>`;
  return `<div style="position:absolute;inset:0 72px;display:flex;align-items:center;gap:22px">
    ${col(c.left, c.leftFig, c.leftNote, false)}${col(c.right, c.rightFig, c.rightNote, true)}</div>`;
}

function freeVisual(c, f) {
  const check = (n) =>
    `<span style="flex:none;width:${n}px;height:${n}px;border-radius:${n / 3.5}px;background:var(--accent);display:flex;align-items:center;justify-content:center"><svg width="${n * 0.6}" height="${n * 0.6}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>`;
  if (f === "story")
    return `<div style="position:absolute;inset:0 72px;display:flex;flex-direction:column;justify-content:center">
      <div class="card" style="padding:18px 44px">
        ${c.tools
          .map(
            (
              t,
              i,
            ) => `<div style="display:flex;align-items:center;gap:26px;padding:28px 0;${i ? "border-top:1px solid var(--line)" : ""}">
              ${check(48)}<span style="font-size:38px;font-weight:700;letter-spacing:-0.02em">${esc(t)}</span></div>`,
          )
          .join("")}
      </div></div>`;
  // 4:5 et 2:3 : deux colonnes de petites cartes.
  return `<div style="position:absolute;inset:0 72px;display:flex;flex-direction:column;justify-content:center">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      ${c.tools
        .map(
          (
            t,
            i,
          ) => `<div class="card" style="border-radius:26px;padding:${f === "pin" ? 30 : 24}px 26px;display:flex;align-items:center;gap:18px;${i === c.tools.length - 1 ? "grid-column:span 2" : ""}">
            ${check(38)}<span style="font-size:${f === "pin" ? 30 : 28}px;font-weight:700;letter-spacing:-0.02em;line-height:1.15">${esc(t)}</span></div>`,
        )
        .join("")}
    </div></div>`;
}

/* ── UNE AFFICHE ── */
function poster(concept, lang, fmt) {
  const F = FORMATS[fmt];
  const c = concept[lang];
  const size = fmt === "story" ? 104 : fmt === "pin" ? 92 : 76;
  const head = `
    <div class="brand"><div class="id"><img src="${LOGO}"><div><span>Trade</span><b>Vault</b></div></div><div class="handle">@tradevault.be</div></div>
    <div class="eyebrow"><i></i>${esc(c.eyebrow)}</div>
    <h1 style="font-size:${size}px">${c.h1.map((l) => `<span>${md(l)}</span>`).join("")}</h1>
    <div class="sub">${esc(c.sub)}</div>`;
  const v = concept.visual;
  const visual =
    v.type === "phone"
      ? phoneVisual(v, fmt, lang)
      : v.type === "drift"
        ? driftVisual(c, lang, fmt)
        : v.type === "price"
          ? priceVisual(c, fmt)
          : freeVisual(c, fmt);
  const foot = `
    <div class="foot"><div class="btn">${esc(UI[lang].cta)}</div><div class="site">tradevault.be</div></div>
    <div class="risk-line">${esc(UI[lang].risk)}</div>`;
  return page(
    F,
    `<div class="poster ${fmt}" style="width:${F.w}px;height:${F.h}px">${head}<div class="visual">${visual}</div>${foot}</div>`,
    lang,
  );
}

/* ── LES PLANCHES DU KIT ── */
function kitPages(lang) {
  const k = KIT[lang];
  const F = FORMATS.feed;
  const brand = `<div class="brand"><div class="id"><img src="${LOGO}"><div><span>Trade</span><b>Vault</b></div></div><div class="handle">${esc(k.tag)}</div></div>`;
  const h1 = (lines, size = 84) =>
    `<h1 style="font-size:${size}px">${lines.map((l) => `<span>${md(l)}</span>`).join("")}</h1>`;
  const cover = `<div class="poster" style="width:${F.w}px;height:${F.h}px">${brand}
    ${h1(k.cover.h1, 88)}<div class="sub">${esc(k.cover.sub)}</div>
    <div class="visual">
      <div class="phone" style="top:0;left:30%"><div class="screen" style="width:400px;height:${Math.round((400 * 1800) / 780)}px;background-image:url(${shot("dashboard")})"></div></div>
      <div class="phone" style="top:70px;left:70%"><div class="screen" style="width:400px;height:${Math.round((400 * 1800) / 780)}px;background-image:url(${shot("jarvis")})"></div></div>
      <div class="fade"></div>
      <div class="tag" style="left:72px;bottom:30px;z-index:4">${esc(UI[lang].demo)}</div>
    </div></div>`;
  const why = `<div class="poster" style="width:${F.w}px;height:${F.h}px">${brand}
    ${h1(k.why.h1)}
    <div style="margin-top:48px;display:flex;flex-direction:column;gap:22px">
      ${k.why.items
        .map(
          ([t, d], i) => `<div class="card" style="padding:40px 44px;display:flex;gap:32px">
            <div class="num" style="font-size:60px;line-height:1;color:var(--accent);width:56px">${i + 1}</div>
            <div><div style="font-size:36px;font-weight:800;letter-spacing:-0.025em">${esc(t)}</div>
            <div style="margin-top:12px;font-size:25px;line-height:1.42;color:var(--muted)">${esc(d)}</div></div></div>`,
        )
        .join("")}
    </div></div>`;
  const offer = `<div class="poster" style="width:${F.w}px;height:${F.h}px">${brand}
    ${h1(k.offer.h1)}
    <div style="margin-top:48px;display:flex;flex-direction:column;gap:18px">
      ${k.offer.plans
        .map(
          (
            [n, p, d],
            i,
          ) => `<div class="card" style="padding:34px 44px;display:flex;align-items:center;gap:36px;${i === 2 ? "box-shadow:inset 0 0 0 2px rgb(var(--accent-rgb) / 0.6)" : ""}">
            <div class="num" style="font-size:84px;letter-spacing:-0.045em;line-height:1;width:250px;color:${i === 2 ? "var(--accent)" : "var(--text)"}">${esc(p)}</div>
            <div><div style="font-size:32px;font-weight:800;letter-spacing:-0.02em">${esc(n)}</div>
            <div style="margin-top:8px;font-size:24px;line-height:1.4;color:var(--muted)">${esc(d)}</div></div></div>`,
        )
        .join("")}
    </div>
    <div style="margin-top:34px;font-size:26px;line-height:1.45;font-weight:600;color:var(--text)">${esc(k.offer.never)}</div>
    <div style="flex:1"></div>
    <div class="foot"><div class="btn">${esc(UI[lang].cta)}</div><div class="site" style="font-size:28px">${esc(k.offer.contact)}</div></div>
    <div class="risk-line">${esc(UI[lang].risk)}</div>
    </div>`;
  return [cover, why, offer].map((html) => page(F, html, lang));
}

const page = (F, body, lang) =>
  `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>${CSS}</style></head><body style="width:${F.w}px;height:${F.h}px">${body}${FIT}</body></html>`;

/* ── LE RENDU : 2x, puis réduit au format natif par le navigateur. ── */
const TMP = join(OUT, ".tmp");
async function render(browser, html, F, file, attempt = 1) {
  mkdirSync(TMP, { recursive: true });
  const src = join(TMP, "page.html");
  writeFileSync(src, html);
  const ctx = await browser.newContext({
    viewport: { width: F.w, height: F.h },
    deviceScaleFactor: 2,
  });
  const p = await ctx.newPage();
  await p.goto(pathToFileURL(src).href, { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  let png;
  try {
    png = await p.screenshot({ type: "png" });
  } catch (e) {
    // Chromium refuse parfois une grande capture sous charge : on réessaie.
    await ctx.close();
    if (attempt >= 4) throw e;
    await new Promise((r) => setTimeout(r, 1500 * attempt));
    return render(browser, html, F, file, attempt + 1);
  }
  const [ow, oh] = F.out;
  const jpg = await p.evaluate(
    async ({ b64, ow, oh }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = ow;
      c.height = oh;
      const g = c.getContext("2d");
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.drawImage(img, 0, 0, ow, oh);
      return c.toDataURL("image/jpeg", 0.93).split(",")[1];
    },
    { b64: png.toString("base64"), ow, oh },
  );
  writeFileSync(file, Buffer.from(jpg, "base64"));
  await ctx.close();
}

const browser = await chromium.launch({ args: ["--disable-gpu"] });
for (const lang of ["fr", "en"]) {
  const dir = join(OUT, lang);
  mkdirSync(dir, { recursive: true });
  for (const c of CONCEPTS) {
    for (const fmt of Object.keys(FORMATS)) {
      const file = join(dir, `${c.id}-${fmt}.jpg`);
      await render(browser, poster(c, lang, fmt), FORMATS[fmt], file);
      console.log("✓", file.replace(ROOT + "/", ""));
    }
  }
  // Le kit : trois planches, puis un PDF qui les enchaîne.
  const kitFiles = [];
  const pages = kitPages(lang);
  for (const [i, html] of pages.entries()) {
    const file = join(dir, `kit-partenaire-${i + 1}.jpg`);
    await render(browser, html, FORMATS.feed, file);
    kitFiles.push(file);
    console.log("✓", file.replace(ROOT + "/", ""));
  }
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const imgs = kitFiles
    .map(
      (f) =>
        `<img src="data:image/jpeg;base64,${readFileSync(f).toString("base64")}" style="display:block;width:1080px;height:1350px;page-break-after:always">`,
    )
    .join("");
  await p.setContent(`<!doctype html><html><body style="margin:0">${imgs}</body></html>`);
  const pdf = join(
    dir,
    lang === "fr" ? "kit-partenaire-tradevault.pdf" : "tradevault-partner-kit.pdf",
  );
  await p.pdf({
    path: pdf,
    width: "1080px",
    height: "1350px",
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  await ctx.close();
  console.log("✓", pdf.replace(ROOT + "/", ""));
}
await browser.close();
rmSync(TMP, { recursive: true, force: true });
