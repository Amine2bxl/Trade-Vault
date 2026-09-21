/* Sonde jetable — l'animation du prix existe-t-elle vraiment ? */
import { chromium } from "playwright";
const b = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"],
});
const p = await (
  await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" })
).newPage();
await p.goto("http://127.0.0.1:5181/pricing", { waitUntil: "domcontentloaded" });
await p.waitForLoadState("networkidle").catch(() => {});
await p.waitForTimeout(1500);
await p.getByRole("tab", { name: /^monthly$|^mensuel$/i }).click();
console.log(
  await p.evaluate(() => {
    const el = document.querySelectorAll(".prix-anime")[1];
    const anims = el.getAnimations({ subtree: true }).map((a) => ({
      nom: a.animationName,
      duree: a.effect.getTiming().duration,
      etat: a.playState,
      cible: a.effect.target.className,
    }));
    return {
      texte: el.textContent,
      sens: el.dataset.sens,
      animations: anims,
      enfants: [...el.children].map((c) => c.className + " = " + c.textContent),
    };
  }),
);
await p.waitForTimeout(600);
console.log(
  "apres:",
  await p.evaluate(() => {
    const el = document.querySelectorAll(".prix-anime")[1];
    return { texte: el.textContent, enfants: el.children.length };
  }),
);
await b.close();
