/* Sonde jetable — la bascule mensuel/annuel, image par image. */
import { chromium } from "playwright";
const b = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox", "--disable-lcd-text"],
});
const ctx = await b.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
  reducedMotion: "no-preference",
});
const p = await ctx.newPage();
await p.goto("http://127.0.0.1:5181/pricing", { waitUntil: "domcontentloaded" });
await p.waitForLoadState("networkidle").catch(() => {});
await p.waitForTimeout(1500);
const zone = { x: 380, y: 0, width: 700, height: 220 };
const cadre = async (n) => {
  const cible = p.locator(".prix-anime").nth(1);
  const box = await cible.boundingBox();
  await p.screenshot({
    path: `/tmp/claude-0/vue/bascule-${n}.png`,
    clip: { x: box.x - 40, y: box.y - 30, width: 420, height: 130 },
  });
};
await cadre("avant");
await p.getByRole("tab", { name: /monthly|mensuel/i }).click();
await p.waitForTimeout(90);
await cadre("pendant");
await p.waitForTimeout(400);
await cadre("apres");
console.log("ok");
await b.close();
