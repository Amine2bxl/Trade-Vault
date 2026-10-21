import { OUTCOME_FAILED, OUTCOME_PASSED, type Simulation } from "./simulation";

/**
 * DIX MILLE COURBES LISIBLES — UNE CARTE DE DENSITÉ, PAS UN ÉCHEVEAU.
 *
 * Tracer dix mille lignes l'une sur l'autre donne une tache : là où mille
 * courbes passent, le pixel est aussi blanc que là où il en passe cent. On
 * compte donc, pixel par pixel, COMBIEN de trajectoires le traversent — puis
 * on peint ce décompte.
 *
 * La méthode est celle des « DenseLines » (Moritz & Fisher, 2018) : dans
 * chaque colonne de pixels, chaque trajectoire dépose exactement 1, réparti
 * sur les pixels qu'elle traverse. Une courbe qui plonge ne pèse pas plus
 * qu'une courbe plate parce qu'elle allume davantage de pixels ; la lumière
 * d'un pixel est donc bien une PART des comptes, pas un artefact de pente.
 *
 * La teinte dit où ces comptes finissent : vers le vert quand les courbes qui
 * passent là atteindront l'objectif, vers le rouge quand elles toucheront la
 * limite, neutre quand elles tiennent l'horizon. Rien n'est décoratif : chaque
 * pixel est un comptage.
 */

export interface FanGrid {
  w: number;
  h: number;
  /** Densité : trajectoires par pixel. */
  tot: Float32Array;
  /** Densité signée : +1 objectif, −1 limite, 0 horizon tenu. */
  sgn: Float32Array;
  /** Tampons du lissage, alloués une fois. */
  scratch: Float32Array;
  smoothTot: Float32Array;
  smoothSgn: Float32Array;
}

export function createFanGrid(w: number, h: number): FanGrid {
  const W = Math.max(2, Math.floor(w));
  const H = Math.max(2, Math.floor(h));
  const n = W * H;
  return {
    w: W,
    h: H,
    tot: new Float32Array(n),
    sgn: new Float32Array(n),
    scratch: new Float32Array(n),
    smoothTot: new Float32Array(n),
    smoothSgn: new Float32Array(n),
  };
}

/**
 * Flou de boîte séparable (horizontal puis vertical), rayon `r` pixels, de
 * `src` vers `dst`. La masse est conservée hors des bords.
 */
function boxBlur(
  src: Float32Array,
  dst: Float32Array,
  tmp: Float32Array,
  w: number,
  h: number,
  r: number,
) {
  const k = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc * k;
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = acc * k;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
}

export function clearFanGrid(g: FanGrid): void {
  g.tot.fill(0);
  g.sgn.fill(0);
}

/**
 * Dépose les tirages `[from, to)` dans la grille. `yPx` convertit un solde en
 * ordonnée de pixel (0 = haut) ; l'abscisse couvre l'horizon complet.
 */
export function rasterizeRuns(
  g: FanGrid,
  sim: Simulation,
  from: number,
  to: number,
  yPx: (balance: number) => number,
): void {
  const paths = sim.paths;
  if (!paths) return;
  const { w, h, tot, sgn } = g;
  const P = sim.points;
  const kx = (P - 1) / (w - 1);
  const maxY = h - 1;
  const clampY = (y: number) => (y < 0 ? 0 : y > maxY ? maxY : y);
  // Un compte qui franchit un mur s'arrête SUR le mur : son dernier trade a pu
  // le dépasser, mais la courbe dit où il a franchi, pas de combien.
  const top = sim.target;
  const bottom = sim.floor;

  for (let i = from; i < to; i++) {
    const base = i * P;
    const end = sim.ends[i];
    const sign = sim.status[i] === OUTCOME_PASSED ? 1 : sim.status[i] === OUTCOME_FAILED ? -1 : 0;
    const xEnd = Math.floor((end / (P - 1)) * (w - 1));
    let prev = clampY(yPx(paths[base]));
    for (let x = 0; x <= xEnd; x++) {
      const t = x * kx;
      const c0 = Math.floor(t);
      const v =
        c0 >= end
          ? paths[base + end]
          : paths[base + c0] + (paths[base + c0 + 1] - paths[base + c0]) * (t - c0);
      const y = clampY(yPx(v > top ? top : v < bottom ? bottom : v));
      const lo = prev < y ? prev : y;
      const hi = prev < y ? y : prev;
      if (hi - lo < 1) {
        // Trait presque horizontal : réparti entre les deux pixels voisins
        // (anticrénelage vertical).
        const yc = (lo + hi) / 2;
        const iy = Math.floor(yc);
        const f = yc - iy;
        const a = iy * w + x;
        tot[a] += 1 - f;
        sgn[a] += (1 - f) * sign;
        if (iy + 1 <= maxY) {
          tot[a + w] += f;
          sgn[a + w] += f * sign;
        }
      } else {
        // Trait qui monte ou plonge : 1 au total, réparti sur la hauteur
        // traversée.
        const y0 = Math.floor(lo);
        const y1 = Math.floor(hi);
        const wt = 1 / (y1 - y0 + 1);
        for (let yy = y0; yy <= y1; yy++) {
          const a = yy * w + x;
          tot[a] += wt;
          sgn[a] += wt * sign;
        }
      }
      prev = y;
    }
  }
}

export interface FanPalette {
  neutral: readonly [number, number, number];
  pos: readonly [number, number, number];
  neg: readonly [number, number, number];
}

/**
 * Peint la grille dans un tampon RGBA (`w × h × 4`).
 *
 * Chaque colonne est normalisée par son pixel le plus dense : sans ça, le
 * départ (dix mille courbes sur un seul pixel) éteindrait tout le reste. La
 * puissance 0,62 relève les queues de distribution, là où vivent les comptes
 * rares qu'on veut voir, sans aplatir le cœur où se concentrent les autres. Et la colonne pâlit à mesure que les
 * comptes sortent par l'objectif ou la limite : un horizon où il ne reste
 * qu'un compte sur cinq ne doit pas briller comme le départ.
 */
export function paintFan(
  g: FanGrid,
  out: Uint8ClampedArray,
  palette: FanPalette,
  totalRuns: number,
  intensity = 0.92,
  /**
   * Rayon du lissage, en pixels de la grille. Dix mille segments droits, dont
   * beaucoup ont la même pente (les tailles de trade se répètent), tissent un
   * hachurage qui n'est pas de l'information : un noyau de deux pixels le
   * fond en une densité continue — c'est une estimation de densité, pas un
   * effet.
   */
  smooth = 0,
): void {
  const { w, h } = g;
  let tot = g.tot;
  let sgn = g.sgn;
  if (smooth > 0) {
    boxBlur(g.tot, g.smoothTot, g.scratch, w, h, smooth);
    boxBlur(g.sgn, g.smoothSgn, g.scratch, w, h, smooth);
    tot = g.smoothTot;
    sgn = g.smoothSgn;
  }
  const [nr, ng, nb] = palette.neutral;
  const [pr, pg, pb] = palette.pos;
  const [er, eg, eb] = palette.neg;
  for (let x = 0; x < w; x++) {
    let max = 0;
    let sum = 0;
    for (let y = 0; y < h; y++) {
      const d = tot[y * w + x];
      sum += d;
      if (d > max) max = d;
    }
    const alive = totalRuns > 0 ? Math.min(1, sum / totalRuns) : 0;
    const fade = (0.4 + 0.6 * alive) * intensity * 255;
    for (let y = 0; y < h; y++) {
      const a = y * w + x;
      const o = a * 4;
      const d = tot[a];
      if (d <= 0 || max <= 0) {
        out[o + 3] = 0;
        continue;
      }
      const s = sgn[a] / d;
      let r: number;
      let gg: number;
      let b: number;
      if (s >= 0) {
        r = nr + (pr - nr) * s;
        gg = ng + (pg - ng) * s;
        b = nb + (pb - nb) * s;
      } else {
        r = nr + (er - nr) * -s;
        gg = ng + (eg - ng) * -s;
        b = nb + (eb - nb) * -s;
      }
      out[o] = r;
      out[o + 1] = gg;
      out[o + 2] = b;
      out[o + 3] = Math.pow(d / max, 0.62) * fade;
    }
  }
}
