import { describe, expect, mock, test } from "bun:test";

/**
 * L'ÉCRITURE D'UNE NOTIFICATION, côté base.
 *
 * Deux appareils ouverts évaluent les mêmes règles : la garantie « une seule
 * ligne » vient de l'index unique `(user_id, dedup_key)`
 * (`20261019120000_live_sync_all_tables.sql`). Ici, on vérifie que le client
 * s'en sert vraiment : il envoie la clé, demande `on conflict do nothing`, et
 * sait dire si la ligne a été créée.
 */

let upsertCalls: { row: Record<string, unknown>; opts: Record<string, unknown> }[] = [];
let returned: { id: string }[] = [];
let upsertError: { code: string; message: string } | null = null;
let inserts: Record<string, unknown>[] = [];
let updates: { patch: Record<string, unknown>; eqs: [string, unknown][] }[] = [];

mock.module("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      upsert: (row: Record<string, unknown>, opts: Record<string, unknown>) => {
        upsertCalls.push({ row, opts });
        return {
          select: () =>
            Promise.resolve(
              upsertError ? { data: null, error: upsertError } : { data: returned, error: null },
            ),
        };
      },
      insert: (row: Record<string, unknown>) => {
        inserts.push(row);
        return Promise.resolve({ error: null });
      },
      update: (patch: Record<string, unknown>) => {
        const call = { patch, eqs: [] as [string, unknown][] };
        updates.push(call);
        const q = {
          eq: (col: string, v: unknown) => {
            call.eqs.push([col, v]);
            return q;
          },
          then: (r: (v: { error: null }) => void) => r({ error: null }),
        };
        return q;
      },
    }),
  },
}));

const { persistNotification, dismissNotification } =
  await import("../src/modules/notifications/store");

const base = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "u1",
  kind: "discipline_warning",
  title: "t",
  body: "b",
  severity: "info",
  channels: ["dashboard"],
  category: "discipline",
  createdAt: "2026-10-19T10:00:00Z",
  readAt: null,
  data: { codedRule: true, dedupKey: "risk_leak:x:2026-W42" },
} as never;

describe("persistNotification", () => {
  test("envoie la clé et demande d'ignorer un doublon", async () => {
    upsertCalls = [];
    returned = [{ id: "n" }];
    expect(await persistNotification(base)).toBe(true);
    expect(upsertCalls[0].row.dedup_key).toBe("risk_leak:x:2026-W42");
    expect(upsertCalls[0].opts).toEqual({
      onConflict: "user_id,dedup_key",
      ignoreDuplicates: true,
    });
  });

  test("doublon : aucune ligne créée, et il le dit", async () => {
    upsertCalls = [];
    returned = [];
    expect(await persistNotification(base)).toBe(false);
  });

  test("base pas encore migrée : repli sur l'insertion simple, rien ne se perd", async () => {
    upsertCalls = [];
    inserts = [];
    upsertError = { code: "42703", message: 'column "dedup_key" does not exist' };
    try {
      expect(await persistNotification(base)).toBe(true);
      expect(inserts.length).toBe(1);
      expect("dedup_key" in inserts[0]).toBe(false);
    } finally {
      upsertError = null;
    }
  });

  test("une vraie erreur remonte", async () => {
    upsertError = { code: "42501", message: "permission denied" };
    try {
      await expect(persistNotification(base)).rejects.toBeDefined();
    } finally {
      upsertError = null;
    }
  });

  test("fermer un popup l'écrit sur la notification, sans perdre ses données", async () => {
    updates = [];
    await dismissNotification("u1", {
      ...(base as object),
      data: { popup: true, eventId: "e1" },
    } as never);
    expect(updates.length).toBe(1);
    const data = updates[0].patch.data as Record<string, unknown>;
    expect(data.popup).toBe(true);
    expect(data.eventId).toBe("e1");
    expect(typeof data.dismissedAt).toBe("string");
    expect(updates[0].eqs).toEqual([
      ["id", "11111111-1111-4111-8111-111111111111"],
      ["user_id", "u1"],
    ]);
  });
});
