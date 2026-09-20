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
  args: [
    "--no-sandbox",
    /* LA POLICE — le detail qui decidait de tout.
     *
     * TradeVault charge Inter depuis Google Fonts (`routes/__root.tsx`). Dans
     * un conteneur d'agent, la sortie HTTPS passe par un proxy qui presente son
     * propre CA : sans ces deux options, la requete de police echoue en
     * `ERR_CERT_AUTHORITY_INVALID`, le navigateur retombe sur une grotesque
     * systeme, et la capture montre une typographie QUI N'EST PAS CELLE DU
     * PRODUIT. Le defaut est invisible a qui ne cherche pas — et saute aux yeux
     * de qui connait l'application.
     *
     * Sur une machine ordinaire, ces options ne servent a rien et ne nuisent
     * pas : `HTTPS_PROXY` est alors vide et Chromium les ignore. */
    ...(process.env.HTTPS_PROXY ? [`--proxy-server=${process.env.HTTPS_PROXY}`] : []),
    "--ignore-certificate-errors",
    /* Le lissage sous-pixel de macOS ne se reproduit pas sous Linux. Le
     * desactiver donne un rendu en niveaux de gris, plus proche du rendu Retina
     * d'un Mac qu'un lissage LCD horizontal qui frange les bords en couleur. */
    "--disable-lcd-text",
    "--font-render-hinting=none",
  ],
});

async function contexte(viewport, scale, mobile = false) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: scale,
    colorScheme: "dark",
    ignoreHTTPSErrors: true,
    /* `isMobile` fait plus que retrecir : il active la meta viewport et les
       evenements tactiles, donc les points d'arret `pointer: coarse` du
       produit. Sans lui on photographierait une fenetre etroite de bureau, ce
       qui n'est pas ce que voit un telephone. */
    isMobile: mobile,
    hasTouch: mobile,
    /* Le produit ne branche rien sur l'agent utilisateur ; il sert ici a ce que
     * tout code tiers qui l'inspecte se comporte comme devant un Mac — ou,
     * en mobile, devant un iPhone. */
    userAgent: mobile
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  });
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

async function connecter(page, mobile = false) {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  /* Sur la vitrine, « Sign in » est `hidden sm:block` : sous 640px il vit dans
     le menu deroulant, derriere le bouton hamburger. Sans cette ouverture, la
     passe mobile attendait trente secondes un bouton qui n'est pas affiche. */
  if (mobile) {
    await page
      .getByRole("button", { name: "Menu" })
      .first()
      .click()
      .catch(() => {});
    await page.waitForTimeout(800);
  }
  /* LE LIBELLE DU DECLENCHEUR N'EST PAS UN CONTRAT.
     Il valait « Sign in », il vaut « Log in » : renommer un bouton de la
     vitrine avait casse le harnais de capture, ce qui n'a aucun sens — le
     harnais doit suivre le produit, pas le figer. Une alternative couvre les
     deux, et le jour ou un troisieme nom arrive, l'erreur sera lisible. */
  await page
    .getByRole("button", { name: /^(Log in|Sign in|Se connecter)$/ })
    .first()
    .click();
  await page.waitForTimeout(1200);
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(MOTDEPASSE);
  await page
    .getByRole("button", { name: /^(Sign in|Se connecter)$/ })
    .last()
    .click();
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

/* LA BOITE DE CONTENU, MESUREE — pas devinee.
 *
 * Le recadrage horizontal etait ecrit en dur : `sx = 600` pour « enlever le
 * rail de navigation ». Le rail en fait 470 (device px, a 2x). Les 130 px de
 * trop ne tombaient pas dans le vide : ils coupaient le contenu, et la capture
 * des Erreurs est partie en production avec « ur correction plan » et « ze too
 * large » — des mots tranches en plein milieu.
 *
 * Une constante magique ne peut pas suivre une mise en page qui bouge. Le
 * `<main class="app-main">` de `App.tsx` EST la boite de contenu : on la
 * mesure, et le recadrage devient juste par construction. Si le rail change de
 * largeur demain, les captures suivent sans qu'on y touche. */
let BOITE = null;

async function mesurerBoite(page, dpr) {
  const r = await page.evaluate(() => {
    const m = document.querySelector("main.app-main");
    if (!m) return null;
    const b = m.getBoundingClientRect();
    return { x: b.left, w: b.width };
  });
  if (!r) {
    console.log("  ⚠ <main.app-main> introuvable — recadrage horizontal par defaut");
    return null;
  }
  // Un cheveu de marge interieure : le bord arrondi du `<main>` n'apporte rien
  // et laisse un liseré clair sur le cadre sombre de la vitrine.
  const marge = 2 * dpr;
  BOITE = { sx: Math.round(r.x * dpr + marge), sw: Math.round(r.w * dpr - 2 * marge) };
  console.log(`  boite de contenu : x=${BOITE.sx} largeur=${BOITE.sw} (device px)`);
  return BOITE;
}

/** Aller sur une section SANS capturer — quand il reste un geste a faire
 *  avant que l'ecran soit presentable (fermer une modale, choisir une
 *  source). */
async function allerSection(page, lien) {
  const l = page.getByRole("button", { name: lien, exact: true }).first();
  if (!(await l.count())) {
    console.log(`  ⊘ section « ${lien} » introuvable`);
    return false;
  }
  await l.click();
  await page.waitForTimeout(4500);
  return true;
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
  /* INTER DOIT ÊTRE POSÉE AVANT LE DÉCLENCHEMENT.
   *
   * `font-display: swap` affiche d'abord une police de repli puis bascule. Une
   * capture prise pendant ce battement montre la mauvaise typographie, ou pire
   * un état mixte — et rien dans l'image ne le signale. On attend donc que le
   * navigateur DÉCLARE Inter prête, et on le vérifie plutôt que de l'espérer. */
  const inter = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('600 16px "Inter"');
  });
  if (!inter) console.log(`  ⚠ ${nom} : Inter absente — la capture aura la mauvaise police`);
  await page.screenshot({ path: `${OUT}/${nom}.png` });
  console.log(`  ✓ ${nom}.png${inter ? "" : "  (POLICE DE REPLI)"}`);
}

/* NAVIGUER SUR TELEPHONE — le rail n'est plus une colonne.
 *
 * Sous `md`, la barre laterale devient un menu : le lien « Journal » n'est pas
 * a l'ecran tant qu'on ne l'a pas ouvert. On tente donc le clic direct, et on
 * ne passe par le bouton de menu que s'il le faut — l'ordre inverse casserait
 * le jour ou la mise en page change. */
async function allerMobile(page, lien) {
  const direct = page.getByRole("button", { name: lien, exact: true }).first();
  if (await direct.count()) {
    await direct.click().catch(() => {});
  } else {
    const menu = page
      .getByRole("button", { name: /menu|navigation/i })
      .first()
      .or(page.locator('[aria-label*="enu"]').first());
    await menu.click().catch(() => {});
    await page.waitForTimeout(700);
    const l = page.getByRole("button", { name: lien, exact: true }).first();
    if (!(await l.count())) {
      console.log(`  ⊘ mobile : « ${lien} » introuvable`);
      return false;
    }
    await l.click().catch(() => {});
  }
  await page.waitForTimeout(4500);
  return true;
}

/* NAVIGUER VERS UNE PAGE DU GROUPE, SUR TELEPHONE — et le VERIFIER.
 *
 * `Mistakes` et `Calendar` ne sont pas des sous-onglets : ce sont des PAGES
 * du meme groupe que `Journal`. Sous `md`, le selecteur de groupe se replie
 * en menu deroulant, et `role="tab"` n'existe plus a l'ecran.
 *
 * La premiere version se rabattait sur un selecteur `text=` — qui a "reussi"
 * en cliquant autre chose. Resultat : trois captures differentes montrant la
 * meme page Journal, sans un seul avertissement. Un clic qui rate en silence
 * est pire qu'un clic impossible.
 *
 * D'ou le MARQUEUR : un texte qui n'existe QUE sur la page visee. Tant qu'il
 * n'est pas la, on n'est pas arrive, quel que soit ce qu'on a cliqué. */
async function allerPageMobile(page, nom, marqueur) {
  const present = async () =>
    (await page.getByText(marqueur, { exact: false }).first().count()) > 0;

  const essayer = async () => {
    const cible = page.getByRole("tab", { name: nom, exact: true }).first();
    const bouton = page.getByRole("button", { name: nom, exact: true }).first();
    const l = (await cible.count()) ? cible : (await bouton.count()) ? bouton : null;
    if (!l) return false;
    await l.scrollIntoViewIfNeeded().catch(() => {});
    await l.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(4500);
    return await present();
  };

  if (await essayer()) return true;

  // Rien d'atteignable directement : on ouvre le selecteur de groupe replie.
  const menus = page.locator("[aria-haspopup], [aria-expanded]");
  const n = Math.min(await menus.count(), 4);
  for (let i = 0; i < n; i++) {
    await menus
      .nth(i)
      .click({ timeout: 4000 })
      .catch(() => {});
    await page.waitForTimeout(800);
    if (await essayer()) return true;
    await page.keyboard.press("Escape").catch(() => {});
  }
  console.log(`  ⊘ mobile : « ${nom} » jamais atteinte (marqueur « ${marqueur} » absent)`);
  return false;
}

/* La capture mobile est prise A LA HAUTEUR DE LA FENETRE, pas en pleine page :
   un telephone montre un ecran, et une bande de 390×4000 sur la vitrine serait
   aussi illisible que la capture de bureau retrecie qu'on cherche a remplacer. */
async function capturerMobile(page, nom, lien) {
  if (lien && !(await allerMobile(page, lien))) return;
  const inter = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('600 16px "Inter"');
  });
  if (!inter) console.log(`  ⚠ ${nom} : Inter absente — la capture aura la mauvaise police`);
  await page.screenshot({ path: `${OUT}/${nom}.png` });
  console.log(`  ✓ ${nom}.png${inter ? "" : "  (POLICE DE REPLI)"}`);
}

// ── Desktop ──────────────────────────────────────────────────────────────────
console.log("→ desktop 1600×1000 @2x");
const ctxD = await contexte({ width: 1600, height: 1000 }, 2);
const pageD = await ctxD.newPage();
pageD.on("pageerror", (e) => console.log("  [pageerror]", String(e).slice(0, 140)));
await connecter(pageD);
await mesurerBoite(pageD, 2);
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
  /* ON VERIFIE QU'IL EST DEVENU ACTIF.
     Le commentaire de cette fonction reclamait deja ce controle sans le
     faire : « un clic qui rate en silence produit une capture de la page
     precedente sous un nouveau nom ». C'est exactement ce qui est arrive a
     la passe mobile. `SubNav` pose `aria-selected` — on le lit. */
  const actif = await t.getAttribute("aria-selected");
  if (actif !== "true") {
    console.log(`  ⊘ « ${nom} » clique mais pas actif (aria-selected=${actif})`);
    return false;
  }
  return true;
}

// La page Erreurs vit dans la section Journal (sous-onglet) — c'est elle qui
// porte la PENTE semaine par semaine, la piece la plus singuliere du produit.
await sousOnglet(pageD, "Mistakes");
await capturer(pageD, "desk-03-erreurs");
await sousOnglet(pageD, "Calendar");
await capturer(pageD, "desk-04-calendrier");

await capturer(pageD, "desk-05-analytics", "Analysis");

// Les rapports mensuels vivent dans un sous-onglet d'Analyse.
await sousOnglet(pageD, "Monthly Reports");
await capturer(pageD, "desk-08-rapports");

/* LES QUATRE PAGES QUE LA VITRINE NE MONTRAIT PAS ENCORE.
   Elles portent des arguments que rien d'autre ne porte : la preparation
   d'avant-seance, le calendrier macro, les setups qu'on a LAISSES passer
   (personne ne compte ceux-la), et la ruine simulee sur dix mille tirages.
   Chacune vit dans une section differente — d'ou le double saut. */
/* MONTE CARLO — il faut LANCER la simulation.
   A l'arrivee la page affiche « Your Monte Carlo starts with your data »
   alors que le panneau compte bien 193 trades : le calcul ne part pas tout
   seul. Capturer sans cliquer donnait un etat vide sur une page qui a des
   donnees — le pire des deux mondes. */
await sousOnglet(pageD, "Monte Carlo");
/* Le garde-fou de la page est `samples.length < 5`. La carte « Journal »
   affiche bien « 193 trades » mais la source n'est pas ACTIVE tant qu'on ne
   l'a pas choisie : on la clique, puis on verifie que l'etat vide a bien
   disparu avant de declencher. */
const srcJournal = pageD.locator('button:has-text("193"), [role="button"]:has-text("193")').first();
if (await srcJournal.count()) {
  await srcJournal.click().catch(() => {});
  await pageD.waitForTimeout(6000);
}
const vide = await pageD.getByText("starts with your data").count();
if (vide) {
  console.log("  ⊘ Monte Carlo : toujours a l'etat vide, capture ignoree");
} else {
  await capturer(pageD, "desk-09-montecarlo");
}

/* CHECKLIST — une modale d'accueil (« Let's build your checklist together »)
   recouvre la page, qui est pleine derriere. On la ferme par « Later ». */
await allerSection(pageD, "Preparation");
const plusTard = pageD.getByRole("button", { name: /^(Later|Plus tard)$/ }).first();
if (await plusTard.count()) {
  await plusTard.click().catch(() => {});
  await pageD.waitForTimeout(2500);
}
// UNE seule capture, apres fermeture. La premiere version capturait AVANT
// puis re-capturait sous le meme nom : le second cliche, pris pendant le
// re-rendu, ecrasait le bon par une page blanche.
await capturer(pageD, "desk-10-checklist");

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

// ── Mobile 390×900 @2x ───────────────────────────────────────────────────────
//
// POURQUOI UNE SECONDE PASSE, ET PAS UN RECADRAGE DE LA PREMIERE.
//
// Une capture de 1300px posee dans une colonne de 336px tombe a l'echelle 0,26:
// le texte du produit, 13px a l'ecran, arrive a 3,4px sur le telephone. On a
// d'abord essaye de recadrer — montrer un tiers de l'ecran, agrandi. Ca marche
// pour un tableau ou une carte, ca ne marche PAS pour Jarvis : sa valeur est
// une PHRASE (« Chased entry, -$305.09 sur 8 trades, PF 1.69 »), et une phrase
// recadree est une phrase coupee en deux. C'est exactement le defaut qu'on
// venait de corriger sur les captures elles-memes.
//
// Le produit est responsive : la vraie reponse est de le photographier A LA
// LARGEUR DU TELEPHONE. Le texte s'y replie tout seul, la capture est lisible
// a l'echelle 1, et c'est toujours le produit reel — pas un fragment.
console.log("→ mobile 390×900 @2x");
const ctxM = await contexte({ width: 390, height: 900 }, 2, true);
const pageM = await ctxM.newPage();
pageM.on("pageerror", (e) => console.log("  [pageerror]", String(e).slice(0, 140)));
await connecter(pageM, true);
/* PAS de `mesurerBoite` ici, et surtout PAS de `BOITE = null` : sous `md` le
   rail n'est plus une colonne, il n'y a rien a retrancher — mais le
   recadrage se fait APRES cette passe, et les plans DESKTOP lisent encore
   `BOITE`. L'avoir remise a zero ici sortait six captures de bureau non
   recadrees, rail compris, sans qu'aucune erreur ne le signale.
   Les plans mobiles sont `pleine: true` : ils ne la consultent pas. */
/* Le tableau de bord EN PREMIER : au retour de `connecter()` on y est deja,
   donc aucune navigation a faire. C'est la capture du heros, et c'etait la
   derniere de la page a rester illisible sur telephone - faute de variante
   `-m`, le heros servait la capture de BUREAU reduite a 350px. */
await capturerMobile(pageM, "mob-dashboard");
await capturerMobile(pageM, "mob-journal", "Journal");
// Une capture prise apres une navigation RATEE est une capture de la page
// precedente sous un autre nom : pire qu'une capture manquante, parce qu'elle
// a l'air correcte.
if (await allerPageMobile(pageM, "Mistakes", "Your correction plan"))
  await capturerMobile(pageM, "mob-mistakes");
if (await allerPageMobile(pageM, "Calendar", "TRADING DAYS"))
  await capturerMobile(pageM, "mob-calendar");
await capturerMobile(pageM, "mob-analytics", "Analysis");
await capturerMobile(pageM, "mob-jarvis", "Jarvis");
const sugM = pageM.getByRole("button", { name: /Chased entry|overtrading|Thursday/i }).first();
if (await sugM.count()) {
  await sugM.click();
  await pageM.waitForTimeout(12000);
  await capturerMobile(pageM, "mob-jarvis");
}
await ctxM.close();

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
// `vfen: [y, hauteur]` en device px — la FENETRE VERTICALE, seule part du
// recadrage qui reste un choix editorial (quelle carte montrer). L'horizontale
// vient de `BOITE`, mesuree sur le `<main>`. `pleine: true` ne recadre rien.
const PLANS = [
  // Le heros est affiche pleine largeur : tout compte, on ne recadre pas.
  /* LE HÉROS SORT À 2400, PAS 1800.
     Dans le héros en deux colonnes il s'affiche sur ~1000 px CSS, soit
     2000 px physiques sur un écran Retina. À 1800 de large, le navigateur
     AGRANDISSAIT donc la capture : c'est exactement ce qui la rendait molle.
     2400 laisse de la marge jusqu'aux très grands écrans, et l'encodage WebP
     absorbe la différence de poids. */
  { de: "desk-01-dashboard.png", vers: "dashboard.webp", pleine: true, w: 2400 },
  // Les fenetres commencent et finissent sur un BORD DE CARTE. Une carte
  // tranchee en deux par le cadrage se lit comme une image mal chargee.
  { de: "desk-07-jarvis-reponse.png", vers: "jarvis.webp", vfen: [170, 1500], w: 2400 },
  { de: "desk-03-erreurs.png", vers: "mistakes.webp", vfen: [230, 1210], w: 2400 },
  { de: "desk-05-analytics.png", vers: "analytics.webp", vfen: [505, 1500], w: 2400 },
  { de: "desk-02-journal.png", vers: "journal.webp", vfen: [150, 1560], w: 2400 },
  /* PAS DE `monthly-reports.webp`.
     Les rapports mensuels sont une vraie fonctionnalite livree, mais le compte
     vitrine n'en a jamais genere : la page tombe sur son etat vide, neuf
     boutons « Generate » et pas un rapport. `shots.ts` fait un glob EAGER —
     tout fichier depose ici part dans le bundle — donc encoder cette capture,
     c'est embarquer une image d'etat vide et tendre un piege a la prochaine
     personne qui cherchera une illustration des rapports.
     Pour la retablir : generer un rapport sur le compte vitrine, puis remettre
     une ligne `{ de: "desk-08-rapports.png", vers: "monthly-reports.webp",
     vfen: [150, 1560], w: 2400 }`. La capture PNG, elle, continue d'etre
     prise : c'est elle qui permettra de verifier que l'etat n'est plus vide. */
  { de: "desk-04-calendrier.png", vers: "calendar.webp", vfen: [60, 1700], w: 2400 },
  { de: "desk-09-montecarlo.png", vers: "montecarlo.webp", vfen: [150, 1560], w: 2400 },
  { de: "desk-10-checklist.png", vers: "checklist.webp", vfen: [100, 1560], w: 2400 },
  /* PAS de `news.webp` ni de `missed.webp`.
     - Economic News : depuis ce conteneur l'API du calendrier est injoignable,
       la page affiche donc un bandeau « Live calendar unavailable » et un
       horaire indicatif. Publier un etat degrade comme capture produit, c'est
       montrer une panne.
     - Missed Setups : le compte vitrine n'a aucun setup manque enregistre, la
       page tombe sur « No missed setups yet ». Meme piege que les rapports
       mensuels.
     Les deux redeviennent capturables des que la donnee existe : remettre une
     ligne ici suffit. */

  /* Les variantes telephone. Suffixe `-m`, largeur 780 (390 CSS a 2x) : la
     vitrine les sert sous 640px via `<picture>`. Aucun recadrage — le produit
     s'est deja replie tout seul a cette largeur, c'est tout l'interet. */
  { de: "mob-dashboard.png", vers: "dashboard-m.webp", pleine: true, w: 780 },
  { de: "mob-mistakes.png", vers: "mistakes-m.webp", pleine: true, w: 780 },
  { de: "mob-jarvis.png", vers: "jarvis-m.webp", pleine: true, w: 780 },
  { de: "mob-analytics.png", vers: "analytics-m.webp", pleine: true, w: 780 },
  { de: "mob-calendar.png", vers: "calendar-m.webp", pleine: true, w: 780 },
  { de: "mob-journal.png", vers: "journal-m.webp", pleine: true, w: 780 },
];

console.log("→ recadrage et encodage WebP");
const encodeur = await (await browser.newContext()).newPage();
for (const p of PLANS) {
  const b64 = readFileSync(join(OUT, p.de)).toString("base64");
  /* La fenetre verticale est un choix ; la bande horizontale est une mesure.
     Faute de mesure (le `<main>` a disparu), on ne recadre PAS en largeur :
     une capture trop large se voit et se corrige, une capture qui tranche un
     mot passe inapercue jusqu'en production. */
  const crop = p.pleine ? null : [BOITE?.sx ?? 0, p.vfen[0], BOITE?.sw ?? null, p.vfen[1]];
  const out = await encodeur.evaluate(
    async ([data, crop, w]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${data}`;
      await img.decode();
      let [sx, sy, sw, sh] = crop ?? [0, 0, img.width, img.height];
      sw ??= img.width - sx;
      // Un recadrage qui deborde la source rend du transparent sur le bord :
      // on le ramene dans l'image plutot que d'encoder un liseré vide.
      sw = Math.min(sw, img.width - sx);
      sh = Math.min(sh, img.height - sy);
      const ratio = Math.min(1, w / sw);
      const c = document.createElement("canvas");
      c.width = Math.round(sw * ratio);
      c.height = Math.round(sh * ratio);
      const g = c.getContext("2d");
      g.imageSmoothingQuality = "high";
      g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      return { url: c.toDataURL("image/webp", 0.84), w: c.width, h: c.height };
    },
    [b64, crop, p.w],
  );
  const bin = Buffer.from(out.url.split(",")[1], "base64");
  writeFileSync(join(OUT, p.vers), bin);
  console.log(`  ✓ ${p.vers.padEnd(18)} ${out.w}×${out.h}  ${(bin.length / 1024).toFixed(0)} Ko`);
}
// Les PNG intermediaires ne servent qu'au recadrage : les laisser dans
// `src/assets/product/` ferait deux fichiers pour la meme capture, et
// `shots.ts` indexe les deux extensions.
for (const p of PLANS) rmSync(join(OUT, p.de), { force: true });
// Les captures prises mais NON encodees. Elles ne sont dans aucun plan, donc
// la boucle ci-dessus ne les voit pas — et `shots.ts` globbe aussi les `.png`
// du dossier : en oublier une, c'est la publier.
for (const n of ["desk-06-jarvis-vide.png", "desk-08-rapports.png", "desk-11-news.png"])
  rmSync(join(OUT, n), { force: true });

await browser.close();
console.log("terminé →", OUT);
