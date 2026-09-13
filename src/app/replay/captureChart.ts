/**
 * captureChart — l'image du graphe au moment où un trade se referme.
 *
 * Une capture prise à la main, après coup, n'est plus la même : le graphe a
 * avancé, l'échelle a bougé, et le stop qu'on cherchait à revoir n'est plus à
 * l'écran. La seule capture qui vaut est celle prise À L'INSTANT de la sortie,
 * et c'est la machine qui peut la prendre, pas le trader.
 *
 * `takeScreenshot()` de la librairie rend un canvas contenant TOUT ce que le
 * graphe dessine — bougies, études, volets, échelles. Ce qu'il ne contient
 * pas, c'est l'overlay SVG des ordres et des dessins, qui vit au-dessus dans
 * le DOM. On les compose donc : le graphe d'abord, l'overlay par-dessus,
 * exactement comme à l'écran.
 *
 * Tout ici peut échouer sans conséquence : l'appelant reçoit `null` et encode
 * son trade sans image. Perdre une capture est ennuyeux ; perdre le trade
 * parce que la capture a échoué le serait beaucoup plus.
 */

import type { IChartApi } from "lightweight-charts";

/** Qualité JPEG de la capture — lisible, et léger à stocker. */
const QUALITY = 0.82;

/** Le SVG d'overlay, rasterisé à la taille du graphe. `null` si impossible. */
async function rasterizeOverlay(svg: SVGSVGElement, w: number, h: number) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  // Les couleurs de l'overlay sont des jetons `var(--tv-…)` résolus par le
  // document. Une image détachée n'a pas de document : sans résolution
  // préalable, tous les traits sortiraient noirs.
  for (const el of Array.from(clone.querySelectorAll<SVGElement>("*"))) {
    for (const attr of ["fill", "stroke"] as const) {
      const raw = el.getAttribute(attr);
      if (!raw || !raw.startsWith("var(")) continue;
      const m = /^var\(\s*(--[a-z0-9-]+)\s*\)$/i.exec(raw.trim());
      if (!m) continue;
      const value = getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim();
      if (value) el.setAttribute(attr, value);
    }
  }
  const markup = new XMLSerializer().serializeToString(clone);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Capture le graphe et son overlay en un seul fichier JPEG.
 *
 * `overlay` et `container` sont facultatifs : sans eux, on rend le graphe nu,
 * ce qui reste utile. `null` en sortie = rien n'a pu être capturé.
 *
 * LES DEUX IMAGES NE SONT PAS À LA MÊME ÉCHELLE, et c'est le piège de cette
 * composition :
 *
 *  • `takeScreenshot()` rend un canvas en pixels PHYSIQUES (× le ratio de
 *    l'écran) couvrant TOUT le graphe — zone de tracé, échelle de prix à
 *    droite, axe des temps en bas ;
 *  • l'overlay, lui, est un SVG en pixels CSS aux dimensions de la SEULE zone
 *    de tracé du volet du prix.
 *
 * Étirer le second sur le premier décalerait chaque ordre et chaque trait de
 * la largeur de l'échelle de prix — une capture pire qu'aucune capture, parce
 * qu'elle aurait l'air juste. On calcule donc le facteur d'échelle à partir de
 * la largeur CSS du conteneur, et on pose l'overlay à sa taille réelle, à son
 * origine réelle : le coin haut-gauche, qu'il partage avec le graphe.
 */
export async function captureChart(
  chart: IChartApi | null,
  overlay: SVGSVGElement | null,
  container: HTMLElement | null,
  name = "replay",
): Promise<File | null> {
  if (!chart || typeof document === "undefined") return null;
  try {
    // `false` sur le viseur : une capture d'archive n'a aucune raison de
    // porter la croix là où la souris se trouvait par hasard.
    const base = chart.takeScreenshot(true, false);
    const w = base.width;
    const h = base.height;
    if (!w || !h) return null;

    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    // Un fond opaque : le JPEG n'a pas de transparence, et sans aplat le
    // graphe sortirait sur du noir pur même en thème clair.
    ctx.fillStyle =
      getComputedStyle(document.documentElement).getPropertyValue("--tv-bg").trim() || "#0c0e10";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(base, 0, 0);

    if (overlay) {
      const cssWidth = container?.getBoundingClientRect().width ?? 0;
      const scale = cssWidth > 0 ? w / cssWidth : 1;
      const ow = Number(overlay.getAttribute("width")) || overlay.clientWidth;
      const oh = Number(overlay.getAttribute("height")) || overlay.clientHeight;
      if (ow > 0 && oh > 0) {
        const img = await rasterizeOverlay(overlay, ow, oh);
        if (img) ctx.drawImage(img, 0, 0, ow * scale, oh * scale);
      }
    }

    const blob = await new Promise<Blob | null>((res) => out.toBlob(res, "image/jpeg", QUALITY));
    if (!blob) return null;
    return new File([blob], `${name}-${Date.now()}.jpg`, { type: "image/jpeg" });
  } catch {
    return null;
  }
}
