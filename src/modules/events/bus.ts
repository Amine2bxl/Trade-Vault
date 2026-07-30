import type { DomainEventName, DomainEvents, EventHandler } from "./types";

/**
 * In-process, strongly-typed event bus — the nervous system of TradeVault.
 *
 * Design rules:
 * - Handlers are error-isolated: one failing listener never breaks the
 *   emitter or the other listeners (fire-and-forget async included).
 * - Engines subscribe in their own module file, never inside components.
 * - The bus is per-runtime (browser tab / server invocation). Cross-runtime
 *   delivery (e.g. server → other devices) goes through persisted
 *   notifications, not through this bus.
 */
class EventBus {
  private handlers = new Map<DomainEventName, Set<EventHandler<DomainEventName>>>();

  on<K extends DomainEventName>(event: K, handler: EventHandler<K>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as EventHandler<DomainEventName>);
    return () => this.off(event, handler);
  }

  off<K extends DomainEventName>(event: K, handler: EventHandler<K>): void {
    this.handlers.get(event)?.delete(handler as EventHandler<DomainEventName>);
  }

  async emit<K extends DomainEventName>(event: K, payload: DomainEvents[K]): Promise<void> {
    const set = this.handlers.get(event);
    if (!set || set.size === 0) return;
    const promises: Promise<unknown>[] = [];
    for (const handler of [...set]) {
      try {
        const out = handler(payload);
        if (out instanceof Promise) {
          promises.push(out);
        }
      } catch (e) {
        console.error(`[events] handler failed for ${event}`, e);
      }
    }
    if (promises.length > 0) {
      const results = await Promise.allSettled(promises);
      for (const r of results) {
        if (r.status === "rejected") {
          console.error(`[events] async handler failed for ${event}`, r.reason);
        }
      }
    }
  }

  /** Test/HMR hygiene: drop every subscription. */
  clear(): void {
    this.handlers.clear();
  }
}

/** App-wide singleton. Import this — never instantiate EventBus yourself. */
export const events = new EventBus();
