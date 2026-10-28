import { createRequire } from "node:module";
// Playwright est préinstallé globalement dans les conteneurs d'agent ; ailleurs,
// `PLAYWRIGHT_ROOT` désigne le dossier node_modules qui le contient.
const { chromium } = createRequire(process.env.PLAYWRIGHT_ROOT ?? "/opt/node22/lib/node_modules/")(
  "playwright",
);
import { mkdirSync, writeFileSync } from "node:fs";
const BASE = process.env.L0_BASE ?? "http://127.0.0.1:5181";
const STUB = process.env.L0_STUB ?? "http://127.0.0.1:5199";
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
};
const state = async () => (await fetch(`${STUB}/__state`)).json();

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: "dark",
});
await ctx.addInitScript(() => {
  localStorage.setItem("tv.cookies.choice", "accepted");
  localStorage.setItem("tv.trustpilot.dismissed", "1");
  localStorage.setItem("tv.dashboard.period", "all");
  localStorage.setItem("tv.lang", "en");
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
await page
  .getByRole("button", { name: /^(Log in|Sign in)$/ })
  .first()
  .click({ timeout: 45000 });
await page.locator('input[type="email"]').fill("tv-l0-ui@test.dev");
await page.locator('input[type="password"]').fill("stub-password");
await page
  .getByRole("button", { name: /^(Sign in|Log in)$/ })
  .last()
  .click();
await page.waitForTimeout(8000);
await page.keyboard.press("Escape").catch(() => {});

// ── 1. Import CSV par l'interface ─────────────────────────────────────────
await page.goto(BASE + "/journal", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
const before = (await state()).trades.length;
await page.evaluate(() => window.dispatchEvent(new CustomEvent("tv:open-import")));
await page.waitForTimeout(4000);

const csv =
  "Date,Symbol,Side,P&L,Risk\n" +
  "2026-10-21,NQ,Long,125.50,\n" + // P&L observé, risque absent
  "2026-10-22,ES,Short,-60,50\n" + // risque fourni
  "2026-10-23,NQ,,90,\n"; // direction absente : refusée par le Journal
await page
  .locator('input[type="file"]')
  .setInputFiles({ name: "l0.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/10-import-preview.png` });
const preview = await page.locator("body").innerText();
check("import: 2 lignes valides annoncées", /2 valid/i.test(preview) && /1 invalid/i.test(preview));
await page.getByRole("button", { name: /^Import \(2\)/ }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/11-import-confirm.png` });
await page
  .getByRole("button", { name: /Confirm|Import/ })
  .last()
  .click();
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/12-import-result.png` });
let s = await state();
const added = s.trades.slice(before);
check(
  "import: exactement 2 trades écrits",
  added.length === 2,
  JSON.stringify(
    added.map((t) => [t.trade_date, t.pnl, t.risk_amount, t.r_multiple, t.review_pending]),
  ),
);
check(
  "import: trades marqués à relire",
  added.every((t) => t.review_pending === true),
);
check("import: ligne sans direction non écrite", !added.some((t) => t.trade_date === "2026-10-23"));
const noRisk = added.find((t) => t.trade_date === "2026-10-21");
check(
  "import: risque absent stocké 0, R 0 (compat), pas de risque inventé",
  noRisk && noRisk.risk_amount === 0 && noRisk.r_multiple === 0,
);
await page.keyboard.press("Escape").catch(() => {});
await page
  .getByRole("button", { name: /Done|Close|OK/ })
  .first()
  .click()
  .catch(() => {});

// ── 2. Relecture d'un import sans risque : le P&L observé survit ──────────
await page.goto(BASE + "/journal", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
const row = page.locator("tr", { hasText: "21/10/26" }).first();
await row.hover();
await row.getByRole("button", { name: "Edit" }).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/13-review-form.png` });
const risk = page.getByLabel(/Risk Amount/i).first();
await risk.fill("50");
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/14-review-form-risk.png` });
await page
  .getByRole("button", { name: /^(Update Trade|Save Trade)$/i })
  .first()
  .click();
await page.waitForTimeout(3000);
s = await state();
const reviewed = s.trades.find((t) => t.id === noRisk?.id);
check(
  "relecture: P&L importé conservé après saisie du risque",
  reviewed &&
    reviewed.pnl === 125.5 &&
    reviewed.risk_amount === 50 &&
    reviewed.review_pending === false,
  JSON.stringify(
    reviewed && [reviewed.pnl, reviewed.risk_amount, reviewed.r_multiple, reviewed.review_pending],
  ),
);

// ── 3. Rapport hérité : masqué, puis recalcul explicite ───────────────────
await page.goto(BASE + "/reports", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);
await page
  .getByRole("button", { name: /Previous month/i })
  .first()
  .click()
  .catch(() => {});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/15-report-legacy.png`, fullPage: true });
let t = await page.locator("body").innerText();
writeFileSync(`${OUT}/15-report-legacy.txt`, t);
check("rapport hérité: avertissement visible", /recalculate safely/i.test(t));
check(
  "rapport hérité: PF 99 / Sortino 99 / synthèse IA non réaffichés",
  !/\b99(\.00)?\b/.test(t) && !t.includes("Your FOMO cost you"),
);
await page
  .getByRole("button", { name: /Recalculate safely/i })
  .first()
  .click()
  .catch(() => {});
await page.waitForTimeout(8000);
s = await state();
const sep = s.monthly_reports.find((r) => r.month === "2026-09");
check(
  "rapport recalculé: méthode v3, PF réel, pas de synthèse IA",
  sep &&
    sep.report.reportMethodVersion === 3 &&
    sep.report.profitFactor === 5.5 &&
    sep.report.aiSummary === null,
  JSON.stringify(
    sep && {
      v: sep.report.reportMethodVersion,
      pf: sep.report.profitFactor,
      r: sep.report.expectancyR,
      ai: sep.report.aiSummary,
    },
  ),
);
await page.screenshot({ path: `${OUT}/16-report-recalculated.png`, fullPage: true });
check("aucune exception de page", errors.length === 0, errors.slice(0, 3).join(" | "));
writeFileSync(`${OUT}/results2.json`, JSON.stringify(results, null, 1));
await browser.close();
