/**
 * HARNAIS DE CAPTURE DES ECRANS PRODUIT — pour la vitrine.
 *
 * USAGE
 *   bun run build && bun run preview        # dans un autre terminal
 *   SHOWCASE_PASSWORD=... node scripts/capture-product.mjs src/assets/product
 *
 * Les fichiers produits sont indexes automatiquement par
 * `src/app/pages/landing/shots.ts` : deposer l'image suffit, aucun code a
 * changer. Voir `src/assets/product/README.md` pour les noms attendus.
 *
 * ── POURQUOI LES REPONSES SUPABASE SONT SERVIES LOCALEMENT ─────────────────
 *
 * Le conteneur d'agent qui a produit ces captures ne peut joindre ni Supabase
 * ni Vercel : la politique reseau de l'environnement refuse le CONNECT. Plutot
 * que de renoncer aux captures, on fait tourner l'app en local et on SERT les
 * reponses Supabase depuis les donnees du compte vitrine (`tvshowcase`),
 * reconstruites a l'identique : le generateur SQL qui a peuple ce compte est
 * deterministe (hash md5 de l'index du jour), il se rejoue donc en JS au
 * centime pres. Le script VERIFIE l'egalite au demarrage et le dit.
 *
 * Les pixels obtenus sont donc ceux du produit — memes composants, memes
 * moteurs de calcul, memes chiffres qu'en base. Ce n'est pas une maquette.
 *
 * Depuis une machine qui atteint Supabase, l'interception est inutile :
 * supprimer le bloc `ctx.route` suffit, tout le reste fonctionne tel quel.
 */
import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2] ?? "/tmp/shots";
mkdirSync(OUT, { recursive: true });

const USER_ID = "a5100000-0000-4000-8000-000000000001";
const ACCOUNT_ID = "a5100000-0000-4000-8000-0000000000a1";
/* Jamais d'identifiant en dur dans le depot, meme pour un compte jetable :
   un mot de passe commite est un mot de passe publie. */
const EMAIL = process.env.SHOWCASE_EMAIL ?? "tvshowcase@test.dev";
const MOTDEPASSE = process.env.SHOWCASE_PASSWORD;
if (!MOTDEPASSE) {
  console.error("SHOWCASE_PASSWORD manquant — voir l'en-tete de ce fichier.");
  process.exit(1);
}
const BASE = process.env.SHOWCASE_BASE ?? "http://localhost:4173";

const u = (s) => parseInt(createHash("md5").update(s).digest("hex").slice(0, 8), 16) / 4294967295;
const iso = (d) => d.toISOString().slice(0, 10);
const pad = (n) => String(n).padStart(2, "0");

function genererTrades() {
  const jours = [];
  const fin = new Date();
  fin.setUTCHours(12, 0, 0, 0);
  for (let k = 272; k >= 1; k--) {
    const d = new Date(fin);
    d.setUTCDate(d.getUTCDate() - k);
    const dow = d.getUTCDay();
    if (dow >= 1 && dow <= 5) jours.push(d);
  }
  const total = jours.length;
  const SYM = ["NQ", "NQ", "NQ", "ES", "EURUSD", "EURUSD", "GBPUSD", "XAUUSD"];
  const STR = [
    "Liquidity Sweep",
    "Order Block",
    "FVG Entry",
    "Breakout",
    "VWAP Play",
    "Silver Bullet",
    "Momentum",
    "Power of 3",
  ];
  const ERR = [
    "Revenge trade",
    "FOMO entry",
    "Size too large",
    "Chased entry",
    "Ignored plan",
    "Premature exit",
    "Overtrading",
    "Holding too long",
  ];
  const out = [];
  jours.forEach((d, idx) => {
    const i = idx + 1;
    if (u(`${i}day`) >= 0.6) return;
    const n = 1 + Math.floor(u(`${i}cnt`) * 2.4);
    const prog = i / total;
    for (let k = 1; k <= n; k++) {
      const uRes = u(`${i}${k}res`),
        uAmp = u(`${i}${k}amp`),
        uSz = u(`${i}${k}sz`);
      const uSym = u(`${i}${k}sym`),
        uErr = u(`${i}${k}err`),
        uEm = u(`${i}${k}em`);
      const uHr = u(`${i}${k}hr`),
        uSt = u(`${i}${k}st`),
        uDir = u(`${i}${k}dir`);
      const uTl = u(`${i}${k}tail`),
        uMg = u(`${i}${k}mag`);
      const pWin = 0.45 + 0.1 * prog;
      const pErr = 0.1 + 0.32 * (1 - prog);
      // Les QUEUES EPAISSES : sans elles la variance quotidienne etait si
      // faible que le Sharpe montait a 5,3 — juste au sens du calcul, et
      // ressemblant a aucun journal reel.
      let r;
      if (uRes < pWin)
        r =
          uTl < 0.08
            ? Math.round((2.5 + uMg * 1.5) * 100) / 100
            : Math.round((0.7 + uAmp * 1.1) * 100) / 100;
      else if (uRes < pWin + 0.06) r = 0;
      else
        r =
          uTl < 0.1
            ? Math.round(-(1.8 + uMg * 0.8) * 100) / 100
            : Math.round(-(0.8 + uAmp * 0.4) * 100) / 100;
      const brut = Math.round((400 + uSz * 180) * (prog < 0.35 && uEm < 0.18 ? 1.9 : 1));
      const risque = Math.round(brut * 0.55);
      out.push({
        id: `sc-${i}-${k}`,
        user_id: USER_ID,
        account_id: ACCOUNT_ID,
        trade_date: iso(d),
        symbol: SYM[Math.floor(uSym * 8)],
        direction: r === 0 ? "be" : uDir < 0.58 ? "long" : "short",
        pnl: Math.round(r * risque * 100) / 100,
        risk_amount: risque,
        r_multiple: r,
        strategy: STR[Math.floor(uSt * 8)],
        mistakes: uErr < pErr ? [ERR[Math.floor(uEm * 8)]] : [],
        setup_quality: r > 1.4 ? 5 : r > 0 ? 4 : r === 0 ? 3 : 2,
        notes: "",
        screenshots: [],
        entry_time: `${pad(8 + Math.floor(uHr * 8))}:${pad(Math.floor(uAmp * 59))}`,
        exit_time: `${pad(9 + Math.floor(uHr * 8))}:${pad(Math.floor(uSz * 59))}`,
        confluences: r > 0 ? ["Market structure", "Liquidity sweep", "VWAP"] : ["Market structure"],
        confidence: r > 0 ? 70 + Math.floor(uAmp * 25) : 45 + Math.floor(uAmp * 30),
        mae: null,
        mfe: null,
        slippage: null,
        is_example: false,
        calibration_factor: 1,
        replay_session_id: null,
        session_id: null,
        created_at: `${iso(d)}T20:00:00+00:00`,
        updated_at: `${iso(d)}T20:00:00+00:00`,
      });
    }
  });
  return out;
}

const TRADES = genererTrades();
const somme = Math.round(TRADES.reduce((s, t) => s + t.pnl, 0) * 100) / 100;
const fautes = TRADES.filter((t) => t.mistakes.length).length;
console.log(`Trades : ${TRADES.length} · P&L ${somme} · fautes ${fautes}`);
console.log(
  `Attendu en base : 193 · 18495.97 · 49  →  ${TRADES.length === 193 && somme === 18495.97 && fautes === 49 ? "IDENTIQUE" : "!! ECART !!"}`,
);

const PROFILE = {
  id: USER_ID,
  name: "Alex Mercer",
  email: EMAIL,
  account_balance: 50000,
  starting_balance: 50000,
  language: "en",
  confluences: [],
  active_account_id: ACCOUNT_ID,
  onboarding_goal: "consistency",
  onboarding_assets: ["indices", "forex"],
  onboarding_style: "intraday",
  onboarding_experience: "intermediate",
  onboarding_pain: "discipline",
  onboarding_monthly_target: 6,
  onboarding_uses_ict: true,
  onboarding_brokers: [],
  onboarding_skipped: false,
  onboarded_at: "2026-01-01T00:00:00+00:00",
  jarvis_first_name: "Alex",
  jarvis_style: "Intraday NQ and EURUSD, London open into New York",
  jarvis_weakness: "Revenge trading after a red morning",
  jarvis_strength: "Patient on A+ setups",
  jarvis_goal: "Pass the Apex 50K evaluation without breaking my own rules",
  jarvis_completed_at: "2026-01-01T00:00:00+00:00",
  trading_rules: null,
  trading_plan: null,
  checklist_config: null,
  onboarding_situation: null,
  trustpilot_prompted_at: new Date().toISOString(),
  trustpilot_status: "dismissed",
  created_at: "2026-01-01T00:00:00+00:00",
  updated_at: new Date().toISOString(),
};
const ACCOUNT = {
  id: ACCOUNT_ID,
  user_id: USER_ID,
  name: "Apex 50K",
  type: "prop",
  starting_balance: 50000,
  currency: "USD",
  color: "#22e08a",
  is_default: true,
  calibration_scale: 1,
  original_balance: null,
  calibrated_at: null,
  created_at: "2026-01-01T00:00:00+00:00",
  updated_at: new Date().toISOString(),
};
const SUB = {
  user_id: USER_ID,
  plan: "elite_yearly",
  status: "active",
  source: "comp",
  current_period_end: "2027-09-01T00:00:00+00:00",
  cancel_at_period_end: false,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  trial_ends_at: null,
  created_at: "2026-01-01T00:00:00+00:00",
  updated_at: new Date().toISOString(),
};
const USER = {
  id: USER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: EMAIL,
  email_confirmed_at: "2026-01-01T00:00:00Z",
  phone: "",
  confirmed_at: "2026-01-01T00:00:00Z",
  last_sign_in_at: new Date().toISOString(),
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { name: "Alex Mercer" },
  identities: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: new Date().toISOString(),
};
const TABLES = { profiles: [PROFILE], accounts: [ACCOUNT], trades: TRADES, subscriptions: [SUB] };

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"],
});

async function contexte(viewport, scale) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, colorScheme: "dark" });
  await ctx.route(
    (url) => url.hostname.endsWith("supabase.co"),
    async (route) => {
      const req = route.request();
      const p = new URL(req.url()).pathname;
      const json = (body, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*", "content-range": "0-0/*" },
          body: JSON.stringify(body),
        });
      if (req.method() === "OPTIONS")
        return route.fulfill({
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-headers": "*",
            "access-control-allow-methods": "*",
          },
        });
      if (p.startsWith("/auth/v1/token"))
        return json({
          access_token: "showcase.token",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: "r",
          user: USER,
        });
      if (p.startsWith("/auth/v1/user")) return json(USER);
      if (p.startsWith("/rest/v1/")) {
        const table = p.replace("/rest/v1/", "").split("?")[0];
        const rows = TABLES[table] ?? [];
        const single = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
        return json(single ? (rows[0] ?? null) : rows);
      }
      return json({});
    },
  );

  // La serie de checklist : elle vit en localStorage (`tv-chk-{user}-{ISO}`),
  // pas en base. Sans elle la carte affiche « 0 jour » — un etat vide au
  // milieu d'une capture censee montrer un compte tenu depuis neuf mois.
  await ctx.addInitScript(
    ([userId]) => {
      const d = new Date();
      for (let k = 0; k < 60; k++) {
        const j = new Date(d);
        j.setDate(j.getDate() - k);
        const dow = j.getDay();
        if (dow === 0 || dow === 6) continue;
        const key = `tv-chk-${userId}-${j.getFullYear()}-${String(j.getMonth() + 1).padStart(2, "0")}-${String(j.getDate()).padStart(2, "0")}`;
        localStorage.setItem(key, JSON.stringify({ locked: true, items: {}, fomo: false }));
      }
      localStorage.setItem("tv.cookies.choice", "accepted");
      localStorage.setItem("tv.trustpilot.dismissed", "1");
    },
    [USER_ID],
  );
  return ctx;
}

async function connecter(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Sign in", exact: true }).first().click();
  await page.waitForTimeout(1200);
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(MOTDEPASSE);
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await page.waitForTimeout(9000);
  // Les sollicitations qui n'ont rien a faire sur une capture produit.
  for (const label of ["No thanks", "Non merci", "Accept", "Got it"]) {
    const b = page.getByRole("button", { name: label, exact: true });
    if (await b.count()) {
      await b
        .first()
        .click()
        .catch(() => {});
      await page.waitForTimeout(400);
    }
  }
  await page
    .locator('button:has-text("Cookies")')
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(600);
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(600);
}

async function capturer(page, nom, lien) {
  if (lien) {
    const l = page.getByRole("button", { name: lien, exact: true }).first();
    if (!(await l.count())) {
      console.log(`  ⊘ ${nom} : entrée « ${lien} » introuvable`);
      return;
    }
    await l.click();
    await page.waitForTimeout(4500);
  }
  await page.screenshot({ path: `${OUT}/${nom}.png` });
  console.log(`  ✓ ${nom}.png`);
}

// ── Desktop ──────────────────────────────────────────────────────────────────
console.log("→ desktop 1600×1000 @2x");
const ctxD = await contexte({ width: 1600, height: 1000 }, 2);
const pageD = await ctxD.newPage();
pageD.on("pageerror", (e) => console.log("  [pageerror]", String(e).slice(0, 140)));
await connecter(pageD);
await capturer(pageD, "desk-01-dashboard");
await capturer(pageD, "desk-02-journal", "Journal");

/** Clique un SOUS-ONGLET et verifie qu'il est devenu actif — un clic qui rate
 *  en silence produit une capture de la page precedente sous un nouveau nom,
 *  ce qui est pire qu'une capture manquante. */
async function sousOnglet(page, nom) {
  // `SubNav` rend des <button role="tab"> : le role EXPLICITE l'emporte, donc
  // `getByRole("button")` ne les voit pas.
  const t = page.getByRole("tab", { name: nom, exact: true }).first();
  if (!(await t.count())) {
    console.log(`  ⊘ sous-onglet « ${nom} » introuvable`);
    return false;
  }
  await t.click({ timeout: 8000 });
  await page.waitForTimeout(4500);
  return true;
}

// La page Erreurs vit dans la section Journal (sous-onglet) — c'est elle qui
// porte la PENTE semaine par semaine, la piece la plus singuliere du produit.
await sousOnglet(pageD, "Mistakes");
await capturer(pageD, "desk-03-erreurs");
await sousOnglet(pageD, "Calendar");
await capturer(pageD, "desk-04-calendrier");

await capturer(pageD, "desk-05-analytics", "Analysis");

// Jarvis avec une VRAIE reponse. Sans cle de provider, c'est le moteur
// deterministe qui repond — un chemin reel du produit, pas une mise en scene.
await capturer(pageD, "desk-06-jarvis-vide", "Jarvis");
const suggestion = pageD
  .getByRole("button", { name: /Chased entry|overtrading|Thursday/i })
  .first();
if (await suggestion.count()) {
  await suggestion.click();
  await pageD.waitForTimeout(12000);
  await capturer(pageD, "desk-07-jarvis-reponse");
}
await ctxD.close();

// ── Recadrage + WebP ─────────────────────────────────────────────────────────
//
// UNE SEULE COMMANDE, parce que deux outils pour un seul geste finissent
// toujours par diverger : on regenere les captures et on oublie de recadrer.
//
// Le recadrage n'est pas cosmetique. Une capture pleine page dans une
// demi-colonne rend un texte illisible : elle cesse d'etre une preuve pour
// devenir une texture. On enleve donc ce qui ne porte pas l'argument — le rail
// de navigation, le chrome haut, le vide bas — pour que ce qui reste soit LU a
// la taille ou il sera affiche.
//
// Chromium fait l'encodage : ni ImageMagick ni Pillow ne sont garantis
// presents, et un `<canvas>` sait tres bien redimensionner et sortir du WebP.
const PLANS = [
  // Le heros est affiche pleine largeur : tout compte, on ne recadre pas.
  { de: "desk-01-dashboard.png", vers: "dashboard.webp", crop: null, w: 1800 },
  { de: "desk-07-jarvis-reponse.png", vers: "jarvis.webp", crop: [600, 60, 2540, 1560], w: 1300 },
  { de: "desk-03-erreurs.png", vers: "mistakes.webp", crop: [600, 230, 2540, 1420], w: 1300 },
  { de: "desk-05-analytics.png", vers: "analytics.webp", crop: [600, 380, 2540, 1560], w: 1300 },
  { de: "desk-02-journal.png", vers: "journal.webp", crop: [600, 150, 2540, 1560], w: 1300 },
  { de: "desk-04-calendrier.png", vers: "calendar.webp", crop: [600, 60, 2540, 1700], w: 1300 },
];

console.log("→ recadrage et encodage WebP");
const encodeur = await (await browser.newContext()).newPage();
for (const p of PLANS) {
  const b64 = readFileSync(join(OUT, p.de)).toString("base64");
  const out = await encodeur.evaluate(
    async ([data, crop, w]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${data}`;
      await img.decode();
      const [sx, sy, sw, sh] = crop ?? [0, 0, img.width, img.height];
      const ratio = Math.min(1, w / sw);
      const c = document.createElement("canvas");
      c.width = Math.round(sw * ratio);
      c.height = Math.round(sh * ratio);
      const g = c.getContext("2d");
      g.imageSmoothingQuality = "high";
      g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      return { url: c.toDataURL("image/webp", 0.84), w: c.width, h: c.height };
    },
    [b64, p.crop, p.w],
  );
  const bin = Buffer.from(out.url.split(",")[1], "base64");
  writeFileSync(join(OUT, p.vers), bin);
  console.log(`  ✓ ${p.vers.padEnd(18)} ${out.w}×${out.h}  ${(bin.length / 1024).toFixed(0)} Ko`);
}
// Les PNG intermediaires ne servent qu'au recadrage : les laisser dans
// `src/assets/product/` ferait deux fichiers pour la meme capture, et
// `shots.ts` indexe les deux extensions.
for (const p of PLANS) rmSync(join(OUT, p.de), { force: true });
rmSync(join(OUT, "desk-06-jarvis-vide.png"), { force: true });

await browser.close();
console.log("terminé →", OUT);
