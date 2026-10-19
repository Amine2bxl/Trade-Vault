/**
 * LE GARDE DES ÉDITEURS AUTO-ENREGISTRÉS (plan de trading, config de checklist).
 *
 * Un éditeur qui s'enregistre seul reçoit aussi ce qui arrive d'ailleurs :
 * l'écho de ses propres sauvegardes, les changements d'un autre appareil, la
 * relecture au retour du réseau. Il ne doit appliquer ces arrivées que s'il
 * n'a RIEN en attente : sinon il effacerait ce que le trader vient de taper.
 *
 *  • Chaque modification ouvre une écriture numérotée (`begin`).
 *  • Seule la réussite de la DERNIÈRE écriture rend l'éditeur propre : celle
 *    d'une sauvegarde plus ancienne ne compte pas.
 *  • Un échec le laisse sale et le signale (`hasFailed`) : au retour du
 *    réseau, l'éditeur renvoie sa saisie au lieu de la remplacer par la
 *    version serveur.
 */
export interface AutosaveGuard {
  /** Une modification locale commence ; rend son numéro. */
  begin(): number;
  /** L'enregistrement n° `seq` s'est terminé (`ok` = réussi). */
  settle(seq: number, ok: boolean): void;
  isDirty(): boolean;
  hasFailed(): boolean;
}

export function createAutosaveGuard(): AutosaveGuard {
  let latest = 0;
  let dirty = false;
  let failed = false;
  return {
    begin() {
      latest += 1;
      dirty = true;
      failed = false;
      return latest;
    },
    settle(seq, ok) {
      if (seq !== latest) return;
      if (ok) {
        dirty = false;
        failed = false;
      } else {
        failed = true;
      }
    },
    isDirty: () => dirty,
    hasFailed: () => failed,
  };
}

/** JSON aux clés triées : jsonb réordonne les clés, une comparaison naïve verrait
 *  un changement là où il n'y en a pas. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      out[k] = sortKeys((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}
