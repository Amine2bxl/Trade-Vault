/**
 * Transfert de trades entre comptes — module PUR.
 *
 * ── LE BESOIN ──────────────────────────────────────────────────────────────
 * Le trader a un COMPTE PRINCIPAL (sa référence, souvent 50 000 $) et des
 * sous-comptes : un nouveau 25k acheté après un compte sauté, une éval qui
 * repart de zéro. Il trade sur le sous-compte, puis veut un jour reverser
 * tout ou partie de ce travail dans son compte de référence — ou l'inverse —
 * sans rien perdre : setups, confluences, erreurs, notes, captures,
 * intention et réflexion.
 *
 * ── DEUX GESTES ────────────────────────────────────────────────────────────
 *   • COPIER : les originaux restent où ils sont, des doublons naissent dans
 *     le compte cible (nouveaux identifiants, captures dupliquées). Chaque
 *     copie retient son original (`copiedFrom`) : relancer le même transfert
 *     ne duplique pas deux fois.
 *   • DÉPLACER : les mêmes lignes changent de compte. Rien n'est dupliqué.
 *
 * ── L'ÉCHELLE ──────────────────────────────────────────────────────────────
 * Un trade pris sur 25k et reversé dans un 50k doit-il valoir le double ? Le
 * trader choisit. Par défaut, le facteur est le rapport des capitaux (50k /
 * 25k = ×2) : c'est la même règle que le recalibrage
 * (`accountCalibration.ts`), et la même conversion — `convertTrade` — qui ne
 * touche QUE l'argent (P&L, risque, MAE/MFE, slippage, frais). Le R multiple,
 * les prix, la quantité et tout le comportemental restent tels quels.
 */

import type { Trade } from "../types";
import { convertTrade, factorFor, IDENTITY_FACTOR, roundMoney } from "./accountCalibration";

export type TransferMode = "copy" | "move";

export interface TransferOptions {
  mode: TransferMode;
  targetAccountId: string;
  /** Facteur appliqué aux montants. 1 = aucune conversion. */
  factor: number;
  /** Bornes INCLUSES, `AAAA-MM-JJ`. `null` = pas de borne de ce côté. */
  from: string | null;
  to: string | null;
  /**
   * Copie : écarter les trades dont une copie existe déjà dans le compte
   * cible. Rejouer le même transfert ne doit pas doubler un historique.
   */
  skipAlreadyCopied: boolean;
}

/** Le facteur par défaut : le rapport des capitaux de départ. */
export function defaultTransferFactor(sourceBalance: number, targetBalance: number): number {
  return factorFor(sourceBalance, targetBalance);
}

/**
 * Un facteur saisi à la main n'est accepté que s'il est un nombre fini et
 * strictement positif ; sinon on n'applique rien plutôt que d'écrire des
 * montants absurdes.
 */
export function sanitizeFactor(raw: number): number {
  return Number.isFinite(raw) && raw > 0 ? raw : IDENTITY_FACTOR;
}

/** Les trades de la période, bornes incluses. Les dates sont des chaînes
 *  `AAAA-MM-JJ` : la comparaison lexicale est exacte, sans fuseau horaire. */
export function tradesInRange(
  trades: readonly Trade[],
  from: string | null,
  to: string | null,
): Trade[] {
  return trades.filter((t) => (!from || t.date >= from) && (!to || t.date <= to));
}

/** L'ensemble des trades source déjà copiés dans le compte cible. */
export function alreadyCopiedIds(targetTrades: readonly Trade[]): Set<string> {
  const out = new Set<string>();
  for (const t of targetTrades) if (t.copiedFrom) out.add(t.copiedFrom);
  return out;
}

export interface PlannedTransfer {
  /** Les lignes à écrire, déjà converties et rattachées au compte cible. */
  trades: Trade[];
  /** Original → copie (mode copie) : sert à dupliquer les captures et à
   *  rattacher l'intention et la réflexion au bon trade. */
  idMap: Map<string, string>;
  /** Trades écartés parce qu'une copie existe déjà. */
  skipped: number;
}

/**
 * Ce que le transfert va écrire. Aucune I/O : les captures sont recopiées
 * ensuite par le store, qui remplace les chemins grâce à `idMap`.
 */
export function planTransfer(
  source: readonly Trade[],
  opts: TransferOptions,
  existingCopies: ReadonlySet<string>,
  newId: () => string,
): PlannedTransfer {
  const factor = sanitizeFactor(opts.factor);
  const idMap = new Map<string, string>();
  const out: Trade[] = [];
  let skipped = 0;

  for (const t of tradesInRange(source, opts.from, opts.to)) {
    if (opts.mode === "copy" && opts.skipAlreadyCopied && existingCopies.has(t.id)) {
      skipped++;
      continue;
    }
    const converted = convertTrade(t, factor);
    if (opts.mode === "move") {
      out.push({ ...converted, accountId: opts.targetAccountId });
      continue;
    }
    const id = newId();
    idMap.set(t.id, id);
    out.push({
      ...converted,
      id,
      accountId: opts.targetAccountId,
      copiedFrom: t.id,
      // Une copie n'est pas un import broker : elle ne doit ni rouvrir le
      // formulaire de relecture, ni entrer en conflit avec la clé de
      // déduplication de l'original (`user_id, external_id` est unique).
      externalId: null,
      reviewPending: false,
      // Un exemple d'onboarding copié reste un exemple.
      isExample: t.isExample,
    });
  }
  return { trades: out, idMap, skipped };
}

export interface TransferSummary {
  count: number;
  pnlBefore: number;
  pnlAfter: number;
  screenshots: number;
  firstDate: string | null;
  lastDate: string | null;
}

/** L'aperçu montré avant confirmation : combien, quel P&L avant/après. */
export function summarizeTransfer(
  source: readonly Trade[],
  opts: Pick<TransferOptions, "from" | "to" | "factor">,
): TransferSummary {
  const factor = sanitizeFactor(opts.factor);
  const picked = tradesInRange(source, opts.from, opts.to);
  let pnlBefore = 0;
  let pnlAfter = 0;
  let screenshots = 0;
  let firstDate: string | null = null;
  let lastDate: string | null = null;
  for (const t of picked) {
    pnlBefore += t.pnl;
    pnlAfter += convertTrade(t, factor).pnl;
    screenshots += t.screenshots.length;
    if (!firstDate || t.date < firstDate) firstDate = t.date;
    if (!lastDate || t.date > lastDate) lastDate = t.date;
  }
  return {
    count: picked.length,
    pnlBefore: roundMoney(pnlBefore),
    pnlAfter: roundMoney(pnlAfter),
    screenshots,
    firstDate,
    lastDate,
  };
}

/** Le chemin Storage d'une capture copiée : même dossier utilisateur, nom
 *  neuf, même extension. Une copie ne doit JAMAIS partager le fichier de son
 *  original — supprimer l'un effacerait l'image de l'autre. */
export function copiedScreenshotPath(userId: string, original: string, nonce: string): string {
  const ext = /\.([a-z0-9]{2,5})$/i.exec(original)?.[1] ?? "png";
  return `${userId}/${nonce}.${ext.toLowerCase()}`;
}
