/* Sonde jetable — traque le 500 des CTA après un changement de langue. */
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://127.0.0.1:4173";
const b = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: [
    "--no-sandbox",
    ...(process.env.HTTPS_PROXY ? [`--proxy-server=${process.env.HTTPS_PROXY}`] : []),
    "--ignore-certificate-errors",
  ],
});
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, colorScheme: "dark" });
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("  [pageerror]", String(e).slice(0, 300)));
p.on("console", (m) => {
  if (m.type() === "error") console.log("  [console]", m.text().slice(0, 240));
});
p.on("response", (r) => {
  if (r.status() >= 400) console.log("  [HTTP", r.status() + "]", r.url().slice(0, 140));
});

async function etat(nom) {
  const txt = await p.evaluate(() => document.body.innerText.slice(0, 220));
  const casse = /Something went wrong|500|Une erreur|Internal/i.test(txt);
  console.log(`${nom.padEnd(34)} url=${p.url().replace(BASE, "")} ${casse ? "❌ ÉCRAN D'ERREUR" : "ok"}`);
  if (casse) console.log("   →", txt.replace(/\n+/g, " | ").slice(0, 200));
}

// ── 1. On arrive en anglais, on bascule en français par le menu ──
await p.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForLoadState("networkidle", { timeout: 40000 }).catch(() => {});
await etat("accueil EN");

await p.getByRole("button", { name: "English" }).first().click();
await p.waitForTimeout(400);
await p.getByRole("menuitemradio", { name: /Français/ }).click();
await p.waitForTimeout(2500);
await p.waitForLoadState("networkidle", { timeout: 40000 }).catch(() => {});
await etat("après bascule FR");

// ── 2. Chaque CTA de la page française ──
const cibles = [
  ["Commencer (nav)", () => p.locator("header button.btn-primary").first()],
  ["Se connecter (nav)", () => p.getByRole("button", { name: /^Se connecter$/ }).first()],
  ["Commencer (héros)", () => p.locator("main .btn-primary").first()],
  ["Voir les offres", () => p.getByRole("link", { name: /Voir les offres/ }).first()],
];

for (const [nom, loc] of cibles) {
  await p.goto(BASE + "/fr", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForLoadState("networkidle", { timeout: 40000 }).catch(() => {});
  const l = loc();
  if (!(await l.count())) {
    console.log(`${nom.padEnd(34)} ⊘ introuvable`);
    continue;
  }
  await l.scrollIntoViewIfNeeded().catch(() => {});
  await l.click({ timeout: 8000 }).catch((e) => console.log("  clic:", String(e).slice(0, 80)));
  await p.waitForTimeout(2500);
  await etat(nom);
}

// ── 3. Les liens du pied de page, depuis /fr ──
await p.goto(BASE + "/fr", { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForLoadState("networkidle", { timeout: 40000 }).catch(() => {});
const hrefs = await p.evaluate(() =>
  [...document.querySelectorAll("footer a[href]")].map((a) => a.getAttribute("href")),
);
console.log("liens de pied de page :", JSON.stringify(hrefs));
for (const h of hrefs) {
  if (!h || h.startsWith("#")) continue;
  const r = await p.request.get(BASE + h).catch(() => null);
  console.log(`  ${String(r?.status() ?? "ERR").padEnd(4)} ${h}`);
}

await b.close();
