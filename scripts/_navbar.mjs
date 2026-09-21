/* Sonde jetable — la barre de navigation à différentes hauteurs de scroll. */
import { chromium } from "playwright";
const b = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox", "--disable-lcd-text"],
});
const ctx = await b.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
});
const p = await ctx.newPage();
await p.goto(process.argv[2], { waitUntil: "domcontentloaded" });
await p.waitForLoadState("networkidle").catch(() => {});
await p.waitForTimeout(1200);
for (const [nom, frac] of [
  ["haut", 0],
  ["tiers", 0.33],
  ["fin", 0.92],
]) {
  await p.evaluate((f) => window.scrollTo(0, document.body.scrollHeight * f), frac);
  await p.waitForTimeout(700);
  await p.screenshot({
    path: `/tmp/claude-0/vue/nav-${nom}.png`,
    clip: { x: 0, y: 0, width: 1440, height: 90 },
  });
}
console.log("ok");
await b.close();
