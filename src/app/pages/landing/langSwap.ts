/**
 * LE PASSAGE D'UNE LANGUE À L'AUTRE — ce qui traverse le rechargement.
 *
 * Changer de langue change d'adresse (`/` ↔ `/fr`) et re-sert le document :
 * c'est non négociable, sinon le canonical, l'`hreflang` et le `<html lang>`
 * mentent. Ce qui l'est, c'est la RUPTURE que ça produit.
 *
 * ── CE QUI SE PASSAIT ─────────────────────────────────────────────────────
 *
 * Trois ruptures se cumulaient, et la plus grosse n'était pas le fondu :
 *
 *   1. LE RETOUR EN HAUT. On change de langue depuis le sélecteur du PIED DE
 *      PAGE. Le document suivant s'ouvre à zéro : le visiteur est renvoyé
 *      cinq écrans plus haut, dans une page qu'il venait de finir de lire.
 *      Le fondu était soigné, et il masquait un saut de 5 000px.
 *   2. LA CASCADE QUI REJOUE. Les dix-neuf apparitions au défilement se
 *      rejouent intégralement sur la page servie. Pendant deux secondes, le
 *      contenu monte, s'enchaîne, se décale — c'est ce qu'on lit comme du
 *      saccadé.
 *   3. LE TROU NOIR. Entre la page effacée et la page peinte, l'écran est un
 *      aplat de `--tv-bg`. Il ne peut pas disparaître, mais il n'a pas à
 *      durer plus que nécessaire.
 *
 * ── CE QUI TRAVERSE MAINTENANT ────────────────────────────────────────────
 *
 * Une position, pas un pixel. On retient l'ANCRE la plus haute franchie et
 * le décalage dans cette ancre : les deux langues n'ont pas la même hauteur
 * de texte, donc un `scrollY` brut atterrirait à côté. Une section retrouve
 * sa place dans les deux langues ; un nombre de pixels, non.
 *
 * Le paquet est lu UNE fois par document et effacé aussitôt : un
 * rechargement manuel (F5) ne doit rejouer ni le fondu ni la reprise.
 */

const CLE = "tv.landing.langswap";

export interface RepriseLangue {
  /** L'`id` de la section franchie la plus basse, si le visiteur en avait franchi une. */
  ancre: string | null;
  /** De combien on était descendu DANS cette section. */
  decalage: number;
  /** Le repli, quand aucune ancre n'était franchie (on était encore dans le héros). */
  y: number;
}

/** La hauteur de la barre : une ancre est « franchie » quand elle passe dessous. */
const SEUIL = 120;

/** Photographie la position courante, juste avant de quitter le document. */
export function noterLePassage(): void {
  let paquet: RepriseLangue = { ancre: null, decalage: 0, y: Math.round(window.scrollY) };
  const sections = document.querySelectorAll<HTMLElement>("section[id]");
  for (const s of sections) {
    const haut = s.getBoundingClientRect().top;
    if (haut <= SEUIL) paquet = { ancre: s.id, decalage: Math.round(SEUIL - haut), y: paquet.y };
  }
  try {
    window.sessionStorage.setItem(CLE, JSON.stringify(paquet));
  } catch {
    /* Sans stockage, on navigue sec : la reprise est un confort, pas une
       condition du changement de langue. */
  }
}

let lu = false;
let paquet: RepriseLangue | null = null;

/**
 * Le paquet laissé par le document précédent, ou `null`. Lu et EFFACÉ à la
 * première demande ; les appels suivants reçoivent la même valeur, pour que
 * le fondu, la reprise de position et les apparitions parlent tous du même
 * évènement sans se voler la lecture.
 */
export function lireLePassage(): RepriseLangue | null {
  if (lu) return paquet;
  lu = true;
  try {
    const brut = window.sessionStorage.getItem(CLE);
    if (brut) {
      window.sessionStorage.removeItem(CLE);
      paquet = JSON.parse(brut) as RepriseLangue;
    }
  } catch {
    paquet = null;
  }
  return paquet;
}

/** Où il faut retomber, dans le document qu'on vient d'ouvrir. */
export function positionDeReprise(r: RepriseLangue): number {
  const cible = r.ancre ? document.getElementById(r.ancre) : null;
  if (!cible) return Math.max(0, r.y);
  return Math.max(0, cible.getBoundingClientRect().top + window.scrollY - SEUIL + r.decalage);
}
