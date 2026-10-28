import { createRequire } from "node:module";
// Playwright est préinstallé globalement dans les conteneurs d'agent ; ailleurs,
// `PLAYWRIGHT_ROOT` désigne le dossier node_modules qui le contient.
const { chromium } = createRequire(process.env.PLAYWRIGHT_ROOT ?? "/opt/node22/lib/node_modules/")(
  "playwright",
);
import { mkdirSync, writeFileSync } from "node:fs";
const BASE = process.env.L0_BASE ?? "http://127.0.0.1:5181";
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const USER_ID = "b0000000-0000-4000-8000-000000000001";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
};

const browser = await chromium.launch({ args: ["--no-sandbox"] });
async function ctxFor(mobile) {
  const ctx = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: mobile,
    colorScheme: "dark",
  });
  await ctx.addInitScript(() => {
    localStorage.setItem("tv.cookies.choice", "accepted");
    localStorage.setItem("tv.trustpilot.dismissed", "1");
    localStorage.setItem("tv.dashboard.period", "all");
    localStorage.setItem("tv.lang", "en");
  });
  return ctx;
}
async function login(page, mobile) {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
  if (mobile) {
    const menu = page.getByRole("button", { name: "Menu" }).first();
    await menu.click({ timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(600);
  }
  await page
    .getByRole("button", { name: /^(Log in|Sign in|Se connecter)$/ })
    .first()
    .click({ timeout: 45000 });
  await page.locator('input[type="email"]').fill("tv-l0-ui@test.dev");
  await page.locator('input[type="password"]').fill("stub-password");
  await page
    .getByRole("button", { name: /^(Sign in|Se connecter|Log in)$/ })
    .last()
    .click();
  await page.waitForTimeout(8000);
  for (const label of ["No thanks", "Accept", "Got it", "Skip", "Later"]) {
    const b = page.getByRole("button", { name: label, exact: true });
    if (await b.count())
      await b
        .first()
        .click()
        .catch(() => {});
  }
  await page.keyboard.press("Escape").catch(() => {});
}
async function go(page, path, wait = 5000) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(wait);
  await page.keyboard.press("Escape").catch(() => {});
}
const text = (page) => page.locator("main, body").first().innerText();

for (const mobile of [false, true]) {
  const tag = mobile ? "mobile" : "desktop";
  const ctx = await ctxFor(mobile);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await login(page, mobile);
  await page.screenshot({ path: `${OUT}/${tag}-00-after-login.png`, fullPage: false });

  await go(page, "/dashboard");
  await page.screenshot({ path: `${OUT}/${tag}-01-dashboard.png`, fullPage: true });
  let t = await text(page);
  writeFileSync(`${OUT}/${tag}-01-dashboard.txt`, t);
  check(
    `${tag} dashboard: R net non inventé`,
    /net r\s*\n\s*—/i.test(t),
    "attendu « — » (6 trades sans R mesuré)",
  );
  check(`${tag} dashboard: PF 3.06`, t.includes("3.06"));
  check(`${tag} dashboard: win rate 65.0%`, t.includes("65.0%"));

  await go(page, "/analytics");
  await page.screenshot({ path: `${OUT}/${tag}-02-analytics.png`, fullPage: true });
  t = await text(page);
  writeFileSync(`${OUT}/${tag}-02-analytics.txt`, t);
  // 14 R mesurés : octobre 3,8R + septembre 4,5R = 8,3R → 0,59R.
  check(`${tag} analytics: R moyen 0.59R (8,3R / 14)`, t.includes("0.59R"));
  check(`${tag} analytics: n du R affiché`, t.includes("14 of 20 trades with known risk"));

  await go(page, "/journal");
  await page.screenshot({ path: `${OUT}/${tag}-03-journal.png`, fullPage: true });
  t = await text(page);
  writeFileSync(`${OUT}/${tag}-03-journal.txt`, t);
  check(
    `${tag} journal: aucun « 0.0R » pour un risque inconnu`,
    !/(^|\s)0\.0R/.test(t) && !/(^|\s)0\.00R/.test(t),
  );
  // Le rappel vit dans le menu « More » de la page (PageControls).
  await page
    .getByRole("button", { name: "More" })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(800);
  check(
    `${tag} journal: rappel des imports à relire (menu More)`,
    (await page.locator('[title="1 imported trades to review"]').count()) > 0,
  );

  await go(page, "/reports", 6000);
  await page.screenshot({ path: `${OUT}/${tag}-04-reports.png`, fullPage: true });
  t = await text(page);
  writeFileSync(`${OUT}/${tag}-04-reports.txt`, t);
  check(`${tag} reports: PF 99 hérité masqué`, !t.includes("99.00") && !/PF\s*99\b/.test(t));
  check(`${tag} reports: synthèse IA héritée masquée`, !t.includes("Your FOMO cost you"));

  await go(page, "/goals");
  await page.screenshot({ path: `${OUT}/${tag}-05-goals.png`, fullPage: true });
  await go(page, "/calendar");
  await page.screenshot({ path: `${OUT}/${tag}-06-calendar.png`, fullPage: true });
  t = await text(page);
  writeFileSync(`${OUT}/${tag}-06-calendar.txt`, t);
  await go(page, "/insights", 6000);
  await page.screenshot({ path: `${OUT}/${tag}-07-jarvis.png`, fullPage: false });
  check(`${tag} aucune exception de page`, errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}
writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
await browser.close();
