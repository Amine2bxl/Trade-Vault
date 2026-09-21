/* Sonde jetable — un élément, en grand. */
import { chromium } from "playwright";
const [url, selecteur, index, sortie] = process.argv.slice(2);
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
await p.goto(url, { waitUntil: "domcontentloaded" });
await p.waitForLoadState("networkidle").catch(() => {});
await p.evaluate(async () => {
  const pas = window.innerHeight * 0.8;
  for (let y = 0; y < document.body.scrollHeight; y += pas) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 140));
  }
});
await p.waitForTimeout(800);
const el = p.locator(selecteur).nth(Number(index));
await el.scrollIntoViewIfNeeded();
await p.waitForTimeout(600);
await el.screenshot({ path: sortie });
console.log("ok", await p.locator(selecteur).count());
await b.close();
