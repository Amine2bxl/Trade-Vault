/**
 * LA RÉFRACTION SE REPOSE PENDANT UN DÉFILEMENT.
 *
 * La lentille de Glisse est un filtre SVG (`feDisplacementMap`) appliqué au
 * fond VIVANT : chaque image où ce qu'il y a derrière le verre bouge, le
 * navigateur refait le calcul, en grande partie sur le processeur. Au repos,
 * c'est gratuit ; pendant un défilement, avec une barre d'onglets, un rail et
 * une douzaine de boutons de verre, la page tombait de 60 à 30 images par
 * seconde (et plus bas encore sur une page à graphiques).
 *
 * Pendant qu'on défile, on regarde le contenu bouger, pas le verre : le temps
 * du défilement, la réfraction est suspendue (`html.tv-scrolling`, voir
 * styles.css) — le flou, la teinte et le liseré lumineux restent. Elle revient
 * dès l'arrêt, avant qu'on ne pose les yeux sur un contrôle.
 */
const IDLE_MS = 140;

export function installGlassScrollEconomy(doc: Document = document): () => void {
  const root = doc.documentElement;
  let timer = 0;
  const win = doc.defaultView;
  if (!win) return () => {};
  const onScroll = () => {
    if (!timer) root.classList.add("tv-scrolling");
    else win.clearTimeout(timer);
    timer = win.setTimeout(() => {
      timer = 0;
      root.classList.remove("tv-scrolling");
    }, IDLE_MS);
  };
  const opts = { capture: true, passive: true } as const;
  doc.addEventListener("scroll", onScroll, opts);
  return () => {
    doc.removeEventListener("scroll", onScroll, opts);
    if (timer) win.clearTimeout(timer);
    root.classList.remove("tv-scrolling");
  };
}
