import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { Cell, Pie, PieChart } from "recharts";

/**
 * Un secteur de camembert Recharts est rendu en `<path role="img">` : sans
 * nom, axe le signale (`svg-img-alt`, constat du lot 0) et un lecteur d'écran
 * n'annonce rien. Le nom passe par `aria-label` sur chaque `Cell`.
 */
describe("camembert accessible", () => {
  it("l'aria-label d'un Cell atteint le secteur rendu", () => {
    const data = [
      { name: "Win", value: 3 },
      { name: "Loss", value: 2 },
    ];
    const html = renderToStaticMarkup(
      <PieChart width={200} height={200}>
        <Pie data={data} dataKey="value" isAnimationActive={false}>
          {data.map((e, i) => (
            <Cell key={i} aria-label={`${e.name} : ${e.value}`} fill="#000" />
          ))}
        </Pie>
      </PieChart>,
    );
    const sectors = html.match(/<path[^>]*role="img"[^>]*>/g) ?? [];
    expect(sectors.length).toBe(2);
    expect(sectors.map((s) => /aria-label="([^"]*)"/.exec(s)?.[1])).toEqual([
      "Win : 3",
      "Loss : 2",
    ]);
  });

  it("chaque Cell d'un Pie de l'app porte un aria-label", () => {
    const src = readFileSync(
      resolve(import.meta.dir, "../src/app/features/analytics/Analytics.tsx"),
      "utf8",
    );
    const pie = src.slice(src.indexOf("<Pie"), src.indexOf("</Pie>"));
    expect(pie).toContain("<Cell");
    expect(pie).toContain("aria-label=");
  });
});
