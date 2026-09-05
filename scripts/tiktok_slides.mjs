// Générateur de slides TikTok TradeVault — design PR #205.
// fond #0a0b0d · accent émeraude #10b981 · texte #e6e8ea · chiffres tabulaires.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const W = 1080;
const H = 1920;
const OUT = "content/tiktok/slides";

const E = "#10b981"; // émeraude
const RED = "#ef4444";
const AMBER = "#f59e0b";
const INK = "#e6e8ea";
const MUT = "#8a8f98";
const SURF = "#141619";
const BORDER = "rgba(255,255,255,0.09)";

const esc = (s) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const logo = `<div style="display:flex;align-items:center;gap:10px">
  <span style="width:14px;height:14px;border-radius:50%;background:${E}"></span>
  <span style="font-size:30px;font-weight:800;letter-spacing:6px;color:${INK}">TRADEVAULT</span>
</div>`;

function shell(inner, { cta } = {}) {
  return `<!doctype html><html lang="fr"><meta charset="utf-8">
  <body style="margin:0;background:${"#0a0b0d"};font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased">
    <div style="width:${W}px;height:${H}px;display:flex;flex-direction:column;justify-content:space-between;padding:64px 72px;box-sizing:border-box">
      ${logo}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:40px 0" id="mid">${inner}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid ${BORDER};padding-top:28px">
        <span style="font-size:24px;color:${MUT}">${cta ?? "TradeVault — le coach IA qui montre pourquoi tu perds"}</span>
        <span style="font-size:22px;font-weight:700;color:${E}">→</span>
      </div>
    </div>
  </body></html>`;
}

function slideInner(s) {
  const { layout = "cover", eyebrow = "", head = "", headTone = "normal", sub = "", cards = [] } = s;
  const eyebrowEl = eyebrow
    ? `<div style="font-size:24px;font-weight:700;letter-spacing:3px;color:${E};text-transform:uppercase;margin-bottom:30px">${esc(eyebrow)}</div>`
    : "";
  const subEl = sub
    ? `<div style="margin-top:36px;font-size:33px;line-height:1.45;color:${MUT};max-width:900px;white-space:pre-line">${esc(sub)}</div>`
    : "";
  const toneColor = headTone === "red" ? RED : headTone === "emerald" ? E : headTone === "amber" ? AMBER : INK;
  if (layout === "compare") {
    const cardsHtml = cards
      .map(
        (c) =>
          `<div style="flex:1;background:${SURF};border:1px solid ${BORDER};border-radius:26px;padding:38px;min-height:250px">
            <div style="font-size:24px;color:${MUT}">${esc(c.label)}</div>
            <div style="margin-top:16px;font-size:82px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-0.02em;line-height:1.05;color:${c.tone ?? INK}">${esc(c.value)}</div>
            <div style="margin-top:12px;font-size:25px;color:${MUT}">${esc(c.sub ?? "")}</div>
          </div>`,
      )
      .join("");
    return `${eyebrowEl}<div style="display:flex;gap:26px">${cardsHtml}</div>${subEl}`;
  }
  if (layout === "point") {
    return `${eyebrowEl}
      <div style="background:${SURF};border:1px solid ${BORDER};border-radius:30px;padding:46px">
        <div style="font-size:68px;font-weight:800;line-height:1.1;letter-spacing:-0.01em;color:${toneColor}">${esc(head)}</div>
      </div>${subEl}`;
  }
  const headHtml = `<div style="font-size:88px;font-weight:800;line-height:1.06;letter-spacing:-0.02em;color:${toneColor};white-space:pre-line">${esc(head)}</div>`;
  return `${eyebrowEl}${headHtml}${subEl}`;
}

const POSTS = [
  {
    id: "p01_win_rate_te_ment",
    caption:
      "Ton win rate te ment. Tu peux gagner 55% de tes trades et perdre de l'argent. Tes plus grosses pertes arrivent juste après une perte. Le problème n'est pas ta stratégie. #trading #daytrading #futures #tradingpsychology",
    slides: [
      { layout: "cover", head: "TON WIN RATE\nTE MENT.", headTone: "red", sub: "Tu peux gagner 55 % de tes trades et perdre de l'argent." },
      {
        layout: "compare",
        eyebrow: "Ta semaine réelle",
        cards: [
          { label: "Win rate", value: "55%", tone: E },
          { label: "P&L net", value: "−1 240$", tone: RED },
        ],
        sub: "Tes 3 plus grosses pertes sont arrivées juste après une perte.",
      },
      { layout: "cover", head: "CE QUI SE PASSE APRÈS UN ROUGE", headTone: "red", sub: "TradeVault mesure tes trades d'après-perte. Le vrai coût du revenge." },
    ],
  },
  {
    id: "p02_pas_250",
    caption:
      "Il n'a pas perdu 250$. Il a ignoré son propre plan. Confiance 85%, plan clair… et entrée avant la confirmation. Le résultat n'est pas le problème : c'est l'écart intention → exécution. #trading #discipline #trader",
    slides: [
      { layout: "cover", head: "IL N'A PAS PERDU 250$.", headTone: "red", sub: "Il a ignoré son propre plan." },
      {
        layout: "compare",
        eyebrow: "Avant le trade",
        cards: [
          { label: "Confiance", value: "85%", tone: E },
          { label: "Plan", value: "Attendre la confirmation", tone: INK, sub: "Écrit à l'entrée" },
        ],
        sub: "En réalité : entrée avant la confirmation · −250 $.",
      },
      { layout: "cover", head: "LE RÉSULTAT N'EST PAS LE PROBLÈME.", headTone: "normal", sub: "C'est l'écart intention → exécution. TradeVault le compare sur chaque trade." },
    ],
  },
  {
    id: "p03_revenge_sizing",
    caption:
      "Pourquoi tu doubles ta taille après une perte. Risque prévu 1%… après une perte, 1,8%. Sur 20 trades d'après-perte, l'écart coûte ~620$. La solution n'est pas la volonté : une règle vérifiée à chaque log. #revengetrading #discipline #propfirm",
    slides: [
      { layout: "cover", head: "POURQUOI TU DOUBLES\nTA TAILLE APRÈS UNE PERTE.", headTone: "red", sub: "Le réflexe le plus cher du trading retail." },
      {
        layout: "compare",
        eyebrow: "Risque par trade",
        cards: [
          { label: "Risque prévu", value: "1,0%", tone: E },
          { label: "Après une perte", value: "1,8%", tone: RED, sub: "+80% de risque" },
        ],
        sub: "Sur 20 trades d'après-perte, cet écart te coûte ~620 $.",
      },
      { layout: "cover", head: "PAS DE LA VOLONTÉ. UNE RÈGLE.", headTone: "emerald", sub: "Une règle vérifiée à chaque log. TradeVault te rappelle la tienne." },
    ],
  },
  {
    id: "p04_positionnement",
    caption:
      "Ton problème n'est pas ta stratégie. C'est ton comportement. TradeVault est le coach IA qui te montre pourquoi tu perds — et te refait la discipline, semaine après semaine. #trading #journaldetrading #tradevault",
    slides: [
      { layout: "cover", head: "TON PROBLÈME N'EST PAS TA STRATÉGIE.", headTone: "normal", sub: "C'est ton comportement." },
      { layout: "cover", head: "TRADEVAULT.", headTone: "emerald", sub: "Le coach IA qui te montre pourquoi tu perds — et te refait la discipline, semaine après semaine." },
    ],
  },
  {
    id: "p05_90pct_challenge",
    caption:
      "Pourquoi 90% échouent le challenge. Pas parce qu'ils ne savent pas trader : ils ont passé le test. Ils échouent sur la règle. Daily loss, drawdown, un jour d'overtrading. #propfirm #ftmo #challenge",
    slides: [
      { layout: "cover", head: "POURQUOI 90% ÉCHOUENT LE CHALLENGE.", headTone: "red" },
      { layout: "point", head: "Ils savent trader.", headTone: "emerald", sub: "Ils ont passé le test pour entrer." },
      { layout: "point", head: "Ils échouent sur la règle.", headTone: "red", sub: "Daily loss · Drawdown · Un jour d'overtrading." },
      {
        layout: "compare",
        eyebrow: "Un mauvais jour",
        cards: [
          { label: "Daily loss", value: "−2%", tone: RED },
          { label: "3 pertes de suite", value: "STOP", tone: RED, sub: "Le challenge par terre" },
        ],
        sub: "Le dérapage n'arrive pas le jour où tu trades mal : il arrive le jour où tu continues après.",
      },
      { layout: "cover", head: "SIMULE TON CHALLENGE.", headTone: "emerald", sub: "TradeVault simule ton plan de rules sur ton historique — avant que ça ne coûte." },
    ],
  },
  {
    id: "p06_proof_process",
    caption:
      "6 semaines de vraie revue. Voilà ce que ça change. Edge Score qui monte, fuite disparue, règle tenue 11/12. La discipline n'est pas un trait de caractère : c'est un process qu'on vérifie. #progress #discipline #trading",
    slides: [
      { layout: "cover", head: "6 SEMAINES DE VRAIE REVUE.", headTone: "emerald", sub: "Voilà ce que ça change." },
      {
        layout: "compare",
        eyebrow: "Après 6 semaines",
        cards: [
          { label: "Edge Score", value: "38 → 72", tone: E },
          { label: "Revenge", value: "DISPARU", tone: E, sub: "du journal" },
        ],
        sub: "Règle « pas de trade de revenge » tenue 11 fois sur 12.",
      },
      { layout: "cover", head: "CE N'EST PAS UN TRAIT. C'EST UN PROCESS.", headTone: "normal", sub: "Un process qu'on vérifie. TradeVault le vérifie à chaque log." },
    ],
  },
  {
    id: "p07_question",
    caption:
      "Quelle est ta plus grosse fuite ? Oversize après une perte, overtrading, ou entrée trop tôt ? Réponds en commentaire, je te montre comment la repérer dans ton journal. #tradingcommunity #trading",
    slides: [
      { layout: "cover", eyebrow: "Question", head: "QUELLE EST TA\nPLUS GROSSE FUITE ?", headTone: "normal", sub: "1 · Oversize après une perte    2 · Overtrading    3 · Entrée trop tôt." },
    ],
  },
  {
    id: "p08_jarvis",
    caption:
      "Tu n'as pas besoin d'un cours. Tu as besoin de quelqu'un qui te dise, chiffres à l'appui, d'arrêter de te saborder. Moi, c'est Jarvis. #jarvis #trading #aide",
    slides: [
      { layout: "cover", eyebrow: "Jarvis — coach IA TradeVault", head: "« TU N'AS PAS BESOIN D'UN COURS.", headTone: "normal", sub: "Tu as besoin de quelqu'un qui te dise, chiffres à l'appui, d'arrêter de te saborder. »" },
    ],
  },
  {
    id: "p09_weekly",
    caption:
      "Ce que ta semaine dit de toi. Ce qui s'est amélioré, ce qui s'est dégradé, UNE priorité pour lundi. Pas 15 conseils : une carte lisible en 5 secondes. #weekly #review #trading",
    slides: [
      { layout: "cover", head: "CE QUE TA SEMAINE DIT DE TOI.", headTone: "normal", sub: "Et que tu ignores." },
      {
        layout: "compare",
        eyebrow: "Ta revue de semaine",
        cards: [
          { label: "Amélioré", value: "Risque sous contrôle", tone: E },
          { label: "Dégradé", value: "Entrée trop tôt", tone: RED, sub: "3 fois" },
        ],
        sub: "Une seule priorité pour lundi : attendre la confirmation.",
      },
    ],
  },
  {
    id: "p10_cout",
    caption:
      "Un challenge raté coûte 200–600$. Un mois de Pro coûte moins qu'un challenge que tu échoues en te sabordant. Essaie le journal gratuit — 30 trades. Jarvis te dira déjà où tu fuis. #propfirm #trader #tradevault",
    slides: [
      {
        layout: "compare",
        eyebrow: "C'est une question de coût",
        cards: [
          { label: "Challenge raté", value: "200–600$", tone: RED },
          { label: "TradeVault Pro", value: "≈ 1 moindre coût", tone: E, sub: "que tu échoues en te sabordant" },
        ],
        sub: "La discipline n'est pas une dépense : c'est ce qui te fait passer le prochain.",
      },
      { layout: "cover", head: "ESSAIE. 30 TRADES OFFERTS.", headTone: "emerald", sub: "Jarvis te dira déjà où tu fuis." },
    ],
  },
];

mkdirSync(OUT, { recursive: true });
const results = [];
const browser = await chromium.launch();
for (const post of POSTS) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  let i = 0;
  for (const s of post.slides) {
    i += 1;
    const html = shell(slideInner(s));
    await page.setContent(html);
    await page.waitForTimeout(60);
    const m = await page.evaluate(() => {
      const el = document.getElementById("mid");
      return { overflow: el.scrollHeight - el.clientHeight, scroll: el.scrollHeight, client: el.clientHeight };
    });
    const safe = m.overflow <= 2;
    console.log(`${post.id}_${i}: content=${m.scroll}px box=${m.client}px ${safe ? "OK" : "⚠ OVERFLOW " + m.overflow + "px"}`);
    await page.screenshot({ path: join(OUT, `${post.id}_${i}.png`) });
    results.push(`${post.id}_${i}.png`);
  }
  await page.close();
}
await browser.close();
console.log(results.join("\n"));
console.log("TOTAL", results.length);

