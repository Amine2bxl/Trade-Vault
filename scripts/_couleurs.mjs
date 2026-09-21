/* Sonde jetable — les couleurs calculées d'une page. */
import { chromium } from "playwright";
const b = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"],
});
const p = await (await b.newContext({ colorScheme: "dark" })).newPage();
await p.goto(process.argv[2], { waitUntil: "domcontentloaded" });
await p.waitForLoadState("networkidle").catch(() => {});
await p.waitForTimeout(1500);
console.log(
  await p.evaluate(() => {
    const r = getComputedStyle(document.documentElement);
    const out = {};
    for (const k of [
      "--tv-accent",
      "--tv-accent-rgb",
      "--tv-highlight",
      "--tv-cta",
      "--tv-cta-hover",
      "--tv-cta-active",
      "--tv-primary-h",
      "--tv-primary-c",
    ])
      out[k] = r.getPropertyValue(k).trim();
    const btn = document.querySelector(".btn-primary");
    if (btn) out["btn-primary bg"] = getComputedStyle(btn).backgroundColor;
    const fill = document.querySelector(".tv-accent-fill");
    if (fill) out["tv-accent-fill bg"] = getComputedStyle(fill).backgroundColor;
    return out;
  }),
);
await b.close();
