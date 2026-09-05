import { describe, expect, test } from "bun:test";
import {
  CRON_PAGE_SIZE,
  cursorFrom,
  pageOfActiveUsers,
  runUserBatch,
} from "../src/backend/cron-batch";
import { readSource, requireIndex } from "./helpers/source";

/**
 * LES BALAYAGES PAR UTILISATEUR.
 *
 * Trois défauts se cachaient derrière la même boucle : une requête tronquée en
 * silence par `db.max_rows`, une invocation serverless qui mourait au milieu,
 * et rien pour reprendre. Les trois se testent réellement — `runUserBatch` ne
 * dépend que d'un client qui répond à `rpc`, et d'une horloge.
 */

/** Un client qui rend des pages d'identifiants, comme le ferait Postgres. */
function fakeClient(allUserIds: string[]) {
  const calls: { after: string | null; limit: number }[] = [];
  return {
    calls,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rpc(_fn: string, args: Record<string, unknown>): any {
      const after = (args.p_after as string | null) ?? null;
      const limit = args.p_limit as number;
      calls.push({ after, limit });
      const start = after ? allUserIds.findIndex((id) => id > after) : 0;
      const slice = start === -1 ? [] : allUserIds.slice(start, start + limit);
      return Promise.resolve({ data: slice.map((user_id) => ({ user_id })), error: null });
    },
  };
}

const ids = (n: number, prefix = "u") =>
  Array.from({ length: n }, (_, i) => `${prefix}${String(i).padStart(5, "0")}`);

describe("pageOfActiveUsers", () => {
  test("demande des identifiants DISTINCTS et triés, après un curseur", async () => {
    const sb = fakeClient(ids(10));
    const page = await pageOfActiveUsers(sb, "2026-08-01", null, 4);
    expect(page).toEqual(["u00000", "u00001", "u00002", "u00003"]);
    expect(sb.calls[0]).toEqual({ after: null, limit: 4 });
  });

  test("le curseur avance sans doublon ni oubli", async () => {
    const sb = fakeClient(ids(10));
    const first = await pageOfActiveUsers(sb, "2026-08-01", null, 4);
    const second = await pageOfActiveUsers(sb, "2026-08-01", first[first.length - 1], 4);
    expect(second).toEqual(["u00004", "u00005", "u00006", "u00007"]);
    // Aucune intersection : c'est toute la garantie de la pagination par
    // curseur, qu'un `select` tronqué puis dédoublonné en mémoire ne donnait pas.
    expect(first.filter((id) => second.includes(id))).toEqual([]);
  });

  test("replie sur la requête directe si la fonction SQL n'est pas déployée", async () => {
    // Le code peut atteindre la production avant la migration. Un cron qui
    // refuse de tourner ce jour-là serait pire qu'un cron qui se replie.
    const rows = ids(6).flatMap((id) => [{ user_id: id }, { user_id: id }]);
    const sb = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rpc(): any {
        return Promise.resolve({ data: null, error: { message: "function does not exist" } });
      },
      from() {
        const builder = {
          select: () => builder,
          gte: () => builder,
          order: () => builder,
          limit: () => builder,
          gt: () => builder,
          then: (resolve: (v: unknown) => void) => resolve({ data: rows, error: null }),
        };
        return builder;
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = await pageOfActiveUsers(sb as any, "2026-08-01", null, 4);
    // Dédoublonné, et surtout BORNÉ — c'est l'absence de borne qui produisait
    // la troncature muette.
    expect(page).toEqual(["u00000", "u00001", "u00002", "u00003"]);
  });
});

describe("runUserBatch", () => {
  test("traite tout le monde quand il y a de la place", async () => {
    const sb = fakeClient(ids(7));
    const seen: string[] = [];
    const result = await runUserBatch(sb, { since: "2026-08-01" }, async (id) => {
      seen.push(id);
    });
    expect(seen).toHaveLength(7);
    expect(new Set(seen).size).toBe(7);
    expect(result.processed).toBe(7);
    expect(result.hasMore).toBe(false);
  });

  test("un compte qui échoue n'emporte pas les autres", async () => {
    const sb = fakeClient(ids(5));
    const result = await runUserBatch(sb, { since: "2026-08-01" }, async (id) => {
      if (id === "u00002") throw new Error("boom");
    });
    expect(result.processed).toBe(4);
    expect(result.failed).toBe(1);
    expect(result.hasMore).toBe(false);
  });

  test("s'ARRÊTE quand le budget de temps est dépassé, et dit où reprendre", async () => {
    // Le cœur du correctif : plutôt que d'être coupé par la plateforme au
    // milieu d'une écriture, le balayage s'arrête lui-même et rend un curseur.
    const sb = fakeClient(ids(50));
    const seen: string[] = [];
    const result = await runUserBatch(
      // Budget déjà écoulé au démarrage.
      sb,
      { since: "2026-08-01", budgetMs: 0, startedAt: Date.now() - 1000 },
      async (id) => {
        seen.push(id);
      },
    );
    expect(seen).toHaveLength(0);
    expect(result.hasMore).toBe(true);
    expect(result.processed).toBe(0);
  });

  test("reprend exactement après le curseur fourni", async () => {
    const sb = fakeClient(ids(10));
    const seen: string[] = [];
    await runUserBatch(sb, { since: "2026-08-01", after: "u00006" }, async (id) => {
      seen.push(id);
    });
    expect(seen).toEqual(["u00007", "u00008", "u00009"]);
  });

  test("deux passages chaînés couvrent exactement tout le monde, une fois chacun", async () => {
    // Le scénario réel : un maillon s'arrête sur budget, le suivant repart de
    // son curseur. Ce qui doit être vrai à la fin, c'est que PERSONNE n'a été
    // traité deux fois et que personne n'a été oublié.
    const all = ids(9);
    const seen: string[] = [];

    // Premier maillon : un budget de quelques millisecondes, et un travail qui
    // prend un peu de temps — l'arrêt se produit donc pour de vrai, après
    // quelques comptes, comme en production sur un budget de quatre minutes.
    const sbA = fakeClient(all);
    const first = await runUserBatch(sbA, { since: "2026-08-01", budgetMs: 12 }, async (id) => {
      seen.push(id);
      await new Promise((r) => setTimeout(r, 6));
    });
    expect(first.hasMore).toBe(true);
    expect(first.lastUserId).not.toBeNull();
    expect(seen.length).toBeLessThan(all.length);
    expect(seen.length).toBeGreaterThan(0);

    // Second maillon : reprend au curseur rendu, sans contrainte de temps.
    const sbB = fakeClient(all);
    const second = await runUserBatch(
      sbB,
      { since: "2026-08-01", after: first.lastUserId },
      async (id) => {
        seen.push(id);
      },
    );
    expect(second.hasMore).toBe(false);

    // Personne deux fois, personne oublié.
    expect(new Set(seen).size).toBe(seen.length);
    expect([...seen].sort()).toEqual(all);
  });

  test("traverse plusieurs pages quand il y a plus d'utilisateurs qu'une page", async () => {
    const total = CRON_PAGE_SIZE + 25;
    const sb = fakeClient(ids(total));
    const seen: string[] = [];
    const result = await runUserBatch(sb, { since: "2026-08-01" }, async (id) => {
      seen.push(id);
    });
    expect(result.processed).toBe(total);
    expect(new Set(seen).size).toBe(total);
    // Plus d'un appel de pagination : la boucle ne s'arrête pas à la première page.
    expect(sb.calls.length).toBeGreaterThan(1);
  });
});

describe("cursorFrom", () => {
  test("lit le curseur posé par le maillon précédent", () => {
    const request = new Request("https://tradevault.be/api/cron/pattern-scan?after=u00042", {
      method: "POST",
    });
    expect(cursorFrom(request)).toBe("u00042");
  });

  test("rend null quand il n'y en a pas — le premier maillon part du début", () => {
    expect(cursorFrom(new Request("https://tradevault.be/api/cron/pattern-scan"))).toBeNull();
  });
});

describe("câblage des crons", () => {
  const read = (p: string) => readSource(import.meta.dir, p);

  for (const [name, path] of [
    ["rapports mensuels", "../src/backend/monthly-reports.server.ts"],
    ["scan de patterns", "../src/backend/pattern-scan.server.ts"],
  ] as const) {
    test(`${name} : plus aucun select non borné sur trades`, () => {
      const source = read(path);
      // La requête d'origine, mot pour mot. Sa réapparition rétablirait la
      // troncature muette de `db.max_rows`.
      expect(source).not.toContain('.select("user_id").gte("trade_date"');
      expect(source).toContain("runUserBatch(sb,");
    });

    test(`${name} : chaîne l'invocation suivante quand le budget est épuisé`, () => {
      const source = read(path);
      const has = requireIndex(source, "batch.hasMore && batch.lastUserId");
      const chain = requireIndex(source, "chainNextInvocation(request,");
      expect(chain).toBeGreaterThan(has);
    });

    test(`${name} : la réponse dit s'il reste du travail`, () => {
      // Un cron qui répond 200 sans dire qu'il s'est arrêté à mi-chemin est un
      // cron dont personne ne saura jamais qu'il a échoué à moitié.
      const source = read(path);
      expect(source).toContain("hasMore: batch.hasMore");
      expect(source).toContain("resumeAfter");
    });
  }

  test("le maillon chaîné se réauthentifie avec le secret de cron", () => {
    const source = read("../src/backend/cron-batch.ts");
    expect(source).toContain("authorization: `Bearer ${secret}`");
    // Pas de porte dérobée : sans secret configuré, aucune chaîne ne part.
    expect(source).toContain("if (!secret) return false;");
  });

  test("le budget de temps reste sous la durée maximale de la fonction", () => {
    // 240 s de budget pour 300 s de plafond : il faut qu'il reste de quoi
    // écrire l'état, lancer le maillon suivant et répondre.
    const config = read("../vite.config.ts");
    expect(config).toContain("maxDuration: 300");
    const batch = read("../src/backend/cron-batch.ts");
    expect(batch).toContain('CRON_TIME_BUDGET_MS ?? "240000"');
  });
});
