import { describe, it, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { BlockRenderer } from "../../BlockRenderer";
import type { JarvisBlock } from "../../blocks";

const hero: JarvisBlock = {
  type: "hero",
  lines: [
    { kind: "context", text: "J'ai analysé tes 22 derniers trades." },
    { kind: "observation", text: "J'observe que tu augmentes ton risque de 25% après une perte." },
    { kind: "impact", text: "Ce comportement t'a coûté 1100 $ sur ces 22 trades." },
    { kind: "action", text: "Aujourd'hui : Pause de 15 minutes après -1R." },
  ],
};

const insight: JarvisBlock = {
  type: "insight",
  patternLabel: "Risque après perte",
  metrics: [
    { label: "Risque après perte", value: "+25%", tone: "down" },
    { label: "Trades après perte", value: "22" },
  ],
  impact: "Impact estimé : 1100 $",
};

const mission: JarvisBlock = {
  type: "mission",
  title: "Mission du jour",
  items: ["Pause de 15 minutes après -1R", "Ne pas augmenter la taille après une perte"],
};

describe("BlockRenderer — hero", () => {
  it("rend les 4 lignes, l'action en callout", () => {
    const html = renderToStaticMarkup(<BlockRenderer block={hero} />);
    expect(html).toContain("analysé tes 22 derniers trades.");
    expect(html).toContain("augmentes ton risque de 25%");
    expect(html).toContain("coûté 1100 $");
    expect(html).toContain("Pause de 15 minutes après -1R");
  });
});

describe("BlockRenderer — insight", () => {
  it("rend le label, les métriques et l'impact", () => {
    const html = renderToStaticMarkup(<BlockRenderer block={insight} />);
    expect(html).toContain("Risque après perte");
    expect(html).toContain("+25%");
    expect(html).toContain("Impact estimé : 1100 $");
  });
});

describe("BlockRenderer — mission", () => {
  it("rend le titre et les items cochables", () => {
    const html = renderToStaticMarkup(<BlockRenderer block={mission} />);
    expect(html).toContain("Mission du jour");
    expect(html).toContain("Pause de 15 minutes après -1R");
    expect(html).toContain("✓");
  });
});

describe("BlockRenderer — markdown intact", () => {
  it("le rendu markdown existant fonctionne toujours", () => {
    const html = renderToStaticMarkup(
      <BlockRenderer block={{ type: "markdown", content: "**texte gras**" }} />,
    );
    expect(html).toContain("<strong");
    expect(html).toContain("texte gras");
  });
});
