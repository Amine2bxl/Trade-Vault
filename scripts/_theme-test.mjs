/* Sonde jetable — un thème hostile posé sur la racine, la vitrine doit tenir. */
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
    const r = document.documentElement.style;
    /* Ce que poserait un thème Amber. */
    r.setProperty("--tv-primary-h", "70");
    r.setProperty("--tv-primary-c", "1.4");
    r.setProperty("--tv-accent", "#f59e0b");
    r.setProperty("--tv-accent-rgb", "245 158 11");
    r.setProperty("--tv-highlight", "#fbbf24");
    r.setProperty("--tv-cta", "#f59e0b");
    const lire = (s) => {
      const e = document.querySelector(s);
      return e ? getComputedStyle(e).backgroundColor : "absent";
    };
    return {
      "btn-primary": lire(".btn-primary"),
      "tv-accent-fill": lire(".tv-accent-fill"),
      "texte accentue": (() => {
        const e = document.querySelector(".text-accent, .mark-accent, .tv-label");
        return e ? getComputedStyle(e).color : "absent";
      })(),
    };
  }),
);
await b.close();
