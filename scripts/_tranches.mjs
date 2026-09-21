/* Sonde jetable — une page en tranches lisibles. */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

mkdirSync("/tmp/claude-0/vue", { recursive: true });
const URL_CIBLE = process.argv[2] ?? "http://127.0.0.1:5181/";
const N = Number(process.argv[3] ?? 5);
const PREFIXE = process.argv[4] ?? "part";
const LARGEUR = Number(process.argv[5] ?? 1440);

const b = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: [
    "--no-sandbox",
    ...(process.env.HTTPS_PROXY ? [`--proxy-server=${process.env.HTTPS_PROXY}`] : []),
    "--ignore-certificate-errors",
    "--disable-lcd-text",
  ],
});
const ctx = await b.newContext({
  viewport: { width: LARGEUR, height: 900 },
  deviceScaleFactor: 1,
  colorScheme: "dark",
  isMobile: LARGEUR < 600,
  hasTouch: LARGEUR < 600,
});
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("  [pageerror]", String(e).slice(0, 200)));
await p.goto(URL_CIBLE, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => {});
await p.waitForTimeout(2000);
/* Le reveal au scroll laisse les sections à opacité 0 tant qu'on n'est pas
   passé dessus : sans descendre, la capture montrerait une page vide. */
await p.evaluate(async () => {
  const pas = window.innerHeight * 0.8;
  for (let y = 0; y < document.body.scrollHeight; y += pas) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 160));
  }
  window.scrollTo(0, 0);
});
await p.waitForTimeout(1000);
const h = await p.evaluate(() => document.documentElement.scrollHeight);
const deborde = await p.evaluate(
  () => document.documentElement.scrollWidth > window.innerWidth + 1,
);
for (let i = 0; i < N; i++) {
  const y = Math.floor((h * i) / N);
  const haut = Math.min(Math.ceil(h / N), h - y);
  await p.screenshot({
    path: `/tmp/claude-0/vue/${PREFIXE}${i + 1}.png`,
    fullPage: true,
    clip: { x: 0, y, width: LARGEUR, height: haut },
  });
}
console.log(`hauteur ${h}px · debordement-horizontal=${deborde} · ${N} tranches`);
await b.close();
