/**
 * Circuit breaker par provider.
 *
 * Fermé → ouvert après `threshold` échecs → toutes les requêtes passent au
 * provider suivant pendant `cooldownMs` → puis un TEST (half-open) est autorisé
 * : succès → fermé, échec → rouvert. Évite de perdre des secondes sur un
 * provider déjà en panne.
 */

export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitStatus {
  id: string;
  state: CircuitState;
  failures: number;
  cooldownUntil: number;
}

interface BreakerState extends CircuitStatus {
  testing: boolean;
}

export class CircuitBreaker {
  private states = new Map<string, BreakerState>();

  constructor(
    private readonly cooldownMs = 60_000,
    private readonly threshold = 2,
  ) {}

  private state(id: string): BreakerState {
    let s = this.states.get(id);
    if (!s) {
      s = { id, state: "closed", failures: 0, cooldownUntil: 0, testing: false };
      this.states.set(id, s);
    }
    return s;
  }

  /** Le provider doit-il être SKIPPÉ (circuit ouvert) ? */
  isOpen(id: string): boolean {
    const s = this.state(id);
    if (s.state === "closed") return false;
    if (s.state === "half_open") return s.testing; // un seul test à la fois
    // open : cooldown écoulé → on laisse passer UN test.
    if (Date.now() >= s.cooldownUntil) {
      s.state = "half_open";
      s.testing = true;
      return false;
    }
    return true;
  }

  recordSuccess(id: string): void {
    const s = this.state(id);
    s.state = "closed";
    s.failures = 0;
    s.testing = false;
    s.cooldownUntil = 0;
  }

  recordFailure(id: string): void {
    const s = this.state(id);
    s.failures += 1;
    s.testing = false;
    if (s.state === "half_open" || s.failures >= this.threshold) {
      s.state = "open";
      s.cooldownUntil = Date.now() + this.cooldownMs;
    }
  }

  /** État courant, pour la page de diagnostic. */
  status(id: string): CircuitStatus {
    const s = this.state(id);
    return { id, state: s.state, failures: s.failures, cooldownUntil: s.cooldownUntil };
  }

  reset(id?: string): void {
    if (id) this.states.delete(id);
    else this.states.clear();
  }
}

/** Instance partagée du runtime. */
export const circuit = new CircuitBreaker();
