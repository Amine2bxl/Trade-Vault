/**
 * Calendrier — fuseau America/New_York, sans dépendance.
 *
 * Toutes les horaires de marché (ouverture, sessions, DST) sont en fuseau NY.
 * Le produit doit les afficher ET les calculer : les clamps, la segmentation
 * ETH/RTH et le regroupement des bougies en vivent. Rien ici ne touche au
 * fuseau local du navigateur.
 *
 * DST : on résout l'écart par point fixe — on devine une époque, on lit le
 * décalage réel à cette époque, on corrige, on relit. Deux ou trois itérations
 * suffisent pour converger (le décalage ne bascule qu'à 02:00 locales).
 */

const TZ = "America/New_York";
const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  fractionalSecondDigits: 3,
});

export interface NyParts {
  y: number;
  mo: number; // 1..12
  d: number;
  hh: number;
  mm: number;
  ss: number;
  ms: number;
}

/** Lit une époque (ms UTC) en parties HORLOGES NY. L'heure 24 est ramenée à 0. */
export function nyParts(epochMs: number): NyParts {
  const parts = fmt.formatToParts(new Date(epochMs));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  let hh = Number(get("hour"));
  if (hh === 24) hh = 0;
  return {
    y: Number(get("year")),
    mo: Number(get("month")),
    d: Number(get("day")),
    hh,
    mm: Number(get("minute")),
    ss: Number(get("second")),
    ms:
      Number(get("fractionalSecond")).toString().padEnd(3, "0").slice(0, 3) !== "000"
        ? Number("0." + get("fractionalSecond").padEnd(3, "0"))
        : 0,
  };
}

/** Écart (ms) entre NY et UTC à une époque donnée. */
function nyOffsetMs(epochMs: number): number {
  const p = nyParts(epochMs);
  const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.hh, p.mm, p.ss, p.ms);
  // `p` décrit l'instant réel ; `asUtc` est l'horloge naive qui lui serait
  // attribuée en UTC. Leur différence EST le décalage.
  return asUtc - epochMs;
}

/** Époque (ms UTC) correspondant à une horloge NY naive, corrigée du décalage. */
export function nyEpoch(y: number, mo: number, d: number, hh = 0, mm = 0, ss = 0): number {
  // Estimation à 12 h UTC du jour — assez loin du basculement DST.
  let guess = Date.UTC(y, mo - 1, d, 12) - 5 * 3600_000;
  for (let i = 0; i < 4; i++) {
    const off = nyOffsetMs(guess);
    const target = Date.UTC(y, mo - 1, d, hh, mm, ss) - off;
    if (target === guess) break;
    guess = target;
  }
  return guess;
}

/** Minuit NY d'une date `YYYY-MM-DD`, en ms UTC. */
export function nyMidnightMs(dateStr: string): number {
  const [y, mo, d] = dateStr.split("-").map(Number);
  return nyEpoch(y, mo, d);
}

/** Date civile NY `YYYY-MM-DD` d'une époque, sans `toISOString` (piège UTC). */
export function nyDateOf(epochMs: number): string {
  const p = nyParts(epochMs);
  return `${p.y}-${String(p.mo).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** `HH:MM` NY d'une époque, aligné sur l'horloge de la bourse. */
export function nyTimeOf(epochMs: number): string {
  const p = nyParts(epochMs);
  return `${String(p.hh).padStart(2, "0")}:${String(p.mm).padStart(2, "0")}`;
}

/** Époque ms UTC de `date` + `HH:MM` NY. */
export function nyEpochFromHm(date: string, hm: string): number {
  const [y, mo, d] = date.split("-").map(Number);
  const [hh, mm] = hm.split(":").map(Number);
  return nyEpoch(y, mo, d, hh, mm);
}

/** Jour de semaine NY (0 = dimanche … 6 = samedi). */
export function nyDow(dateStr: string): number {
  return new Date(nyMidnightMs(dateStr) + 12 * 3600_000).getUTCDay();
}

/** La session de la veille (vendredi → lundi) : les weekends n'ouvrent pas. */
export function previousTradingDate(dateStr: string): string {
  const ms = nyMidnightMs(dateStr);
  let out = ms;
  for (let i = 0; i < 7; i++) {
    out -= 24 * 3600_000;
    const dow = new Date(out + 12 * 3600_000).getUTCDay();
    if (dow !== 0 && dow !== 6) break;
  }
  return nyDateOf(out);
}

/** `YYYY-MM-DD` de la veille NY. */
export function nyYesterday(dateStr: string): string {
  return nyDateOf(nyMidnightMs(dateStr) - 24 * 3600_000);
}

/**
 * Les bornes ETH et RTH d'une journée de cotation NQ.
 *
 * Le jour de cotation CME groupe l'ETH de la veille (18 h NY → 23 h 59) avec
 * le RTH du jour (09:30 → 16:00) puis la queue jusqu'à 17 h. C'est le découpage
 * que TradingView affiche naturellement : une « journée » affiche l'overnight
 * puis la séance officielle. L'utilisateur choisit son point de départ dans
 * cette fenêtre.
 */
export interface NySessions {
  /** Début de la fenêtre ETH complète (18:00 NY la veille). */
  ethStart: number;
  /** Fin de la fenêtre ETH (17:00 NY le jour de cotation). */
  ethEnd: number;
  /** Début du RTH (09:30 NY). */
  rthStart: number;
  /** Fin du RTH (16:00 NY). */
  rthEnd: number;
}

export function sessionsOf(dateStr: string): NySessions {
  const ethStart = nyEpochFromHm(nyYesterday(dateStr), "18:00");
  const ethEnd = nyEpochFromHm(dateStr, "17:00");
  const rthStart = nyEpochFromHm(dateStr, "09:30");
  const rthEnd = nyEpochFromHm(dateStr, "16:00");
  return { ethStart, ethEnd, rthStart, rthEnd };
}

/** L'instant est-il dans le RTH ? */
export function isRth(ms: number, dateStr: string): boolean {
  const s = sessionsOf(dateStr);
  return ms >= s.rthStart && ms < s.rthEnd;
}

/** Heures usuelles de la fenêtre ETH pour un affichage compact. */
export const ETH_LABEL = "18:00";
export const RTH_LABEL = "09:30–16:00";
