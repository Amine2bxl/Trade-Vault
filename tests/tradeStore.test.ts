import { beforeEach, describe, expect, mock, test } from "bun:test";
import { readSource, requireIndex } from "./helpers/source";

/**
 * LA LECTURE DE L'HISTORIQUE, et à quel compte un trade appartient.
 *
 * Deux bugs de DONNÉES vivaient ici, tous deux silencieux :
 *   • une requête sans borne, donc tronquée par PostgREST à 1 000 lignes ;
 *   • le compte actif écrit sur le trade à chaque enregistrement, y compris
 *     lors d'une modification.
 *
 * Le premier se teste pour de vrai : on substitue le client Supabase et on
 * observe les pages demandées.
 */

// ── Client Supabase substitué ────────────────────────────────────────────────
// Ce n'est pas une simulation de Postgres : c'est un enregistreur de requêtes
// qui rend les lignes qu'on lui donne, page par page, comme le ferait
// PostgREST avec son plafond `db.max_rows`.
let allRows: Record<string, unknown>[] = [];
let ranges: [number, number][] = [];
let eqFilters: Record<string, unknown> = {};

function makeQuery() {
  const q = {
    select: () => q,
    eq: (col: string, value: unknown) => {
      eqFilters[col] = value;
      return q;
    },
    order: () => q,
    range: (from: number, to: number) => {
      ranges.push([from, to]);
      const slice = allRows.slice(from, to + 1);
      return Promise.resolve({ data: slice, error: null });
    },
  };
  return q;
}

mock.module("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => makeQuery(),
  },
}));

const { loadUserTrades, rowToTrade } = await import("../src/app/store/trades");
const { setActiveAccountId } = await import("../src/app/store/accounts");

const row = (id: number, over: Record<string, unknown> = {}) => ({
  id: `t${id}`,
  user_id: "u1",
  account_id: "acc-1",
  trade_date: "2026-08-29",
  symbol: "EURUSD",
  direction: "long",
  pnl: 10,
  risk_amount: 100,
  r_multiple: 1,
  strategy: "s",
  mistakes: [],
  setup_quality: 70,
  notes: "",
  screenshots: [],
  entry_time: "",
  exit_time: "",
  confluences: [],
  confidence: 3,
  ...over,
});

beforeEach(() => {
  ranges = [];
  eqFilters = {};
  allRows = [];
});

describe("loadUserTrades — plus de troncature silencieuse", () => {
  test("un historique court tient en une page", async () => {
    allRows = Array.from({ length: 42 }, (_, i) => row(i));
    const trades = await loadUserTrades("u1", { accountId: "acc-1" });
    expect(trades).toHaveLength(42);
    expect(ranges).toEqual([[0, 999]]);
  });

  test("AU-DELÀ DE MILLE LIGNES, les pages s'enchaînent", async () => {
    // Le bug : la requête n'avait aucune borne, et PostgREST plafonne toute
    // réponse à `db.max_rows` (1 000 chez Supabase). Un trader avec plus de
    // mille trades voyait donc un historique amputé — et tout ce que le produit
    // calcule dessus était faux, sans le moindre signal.
    allRows = Array.from({ length: 2350 }, (_, i) => row(i));
    const trades = await loadUserTrades("u1", { accountId: "acc-1" });
    expect(trades).toHaveLength(2350);
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  test("s'arrête dès qu'une page est incomplète — pas de requête inutile", async () => {
    allRows = Array.from({ length: 1000 }, (_, i) => row(i));
    await loadUserTrades("u1", { accountId: "acc-1" });
    // Exactement 1 000 lignes : la première page est pleine, la seconde vide.
    // Deux requêtes, pas trois.
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  test("le compte est celui qu'on lui passe, pas l'état de module", async () => {
    // C'est ce découplage qui empêche un refetch hors rendu (reconnexion,
    // nouvelle tentative) d'écrire les trades d'un compte sous la clé d'un autre.
    const hadWindow = "window" in globalThis;
    if (!hadWindow) (globalThis as { window?: unknown }).window = {};
    try {
      setActiveAccountId("acc-COURANT");
      allRows = [row(1)];
      await loadUserTrades("u1", { accountId: "acc-DEMANDE" });
      expect(eqFilters.account_id).toBe("acc-DEMANDE");
    } finally {
      setActiveAccountId(null);
      if (!hadWindow) delete (globalThis as { window?: unknown }).window;
    }
  });

  test("`accountId: null` lit TOUS les comptes, sans filtre", async () => {
    allRows = [row(1)];
    await loadUserTrades("u1", { accountId: null });
    expect(eqFilters.account_id).toBeUndefined();
    expect(eqFilters.user_id).toBe("u1");
  });

  test("sans option, on retombe sur le compte actif — compatibilité", async () => {
    // `setActiveAccountId` ne retient rien hors navigateur (garde
    // `typeof window === "undefined"`, pour que le rendu serveur ne partage
    // jamais l'état d'un utilisateur avec un autre). On simule donc la présence
    // d'un navigateur le temps de ce cas — c'est le seul où l'état de module
    // est censé servir.
    const hadWindow = "window" in globalThis;
    if (!hadWindow) (globalThis as { window?: unknown }).window = {};
    try {
      setActiveAccountId("acc-COURANT");
      allRows = [row(1)];
      await loadUserTrades("u1");
      expect(eqFilters.account_id).toBe("acc-COURANT");
    } finally {
      setActiveAccountId(null);
      if (!hadWindow) delete (globalThis as { window?: unknown }).window;
    }
  });
});

describe("le compte d'un trade voyage avec le trade", () => {
  test("rowToTrade rend `accountId`", () => {
    expect(rowToTrade(row(1, { account_id: "acc-7" }) as never).accountId).toBe("acc-7");
  });

  test("une ligne sans compte donne `null`, pas `undefined`", () => {
    expect(rowToTrade(row(1, { account_id: null }) as never).accountId).toBeNull();
  });
});

describe("invariants d'écriture", () => {
  const SOURCE = readSource(import.meta.dir, "../src/app/store/trades.ts");

  test("l'enregistrement préfère le compte DU TRADE au compte actif", () => {
    // `account_id: getActiveAccountId()` sans condition réaffectait le trade au
    // compte sélectionné à cet instant — donc modifier une note sur un trade du
    // compte « Prop » depuis le compte « Perso » le faisait disparaître du
    // premier. La migration des captures d'écran, qui réécrit chaque trade
    // concerné, pouvait déplacer un lot entier d'un coup.
    expect(SOURCE).toContain("account_id: t.accountId ?? getActiveAccountId() ?? null");
  });

  test("la lecture est triée de façon STABLE", () => {
    // `trade_date` seul laisse l'ordre des trades du même jour à la discrétion
    // de Postgres : entre deux pages, une ligne pourrait sortir deux fois et
    // une autre jamais.
    const read = SOURCE.slice(requireIndex(SOURCE, "export async function loadUserTrades"));
    expect(read).toContain('.order("trade_date", { ascending: false })');
    expect(read).toContain('.order("id", { ascending: false })');
  });

  test("un refus de quota de la base devient une offre, pas une erreur SQL", () => {
    expect(SOURCE).toContain("planLimitFromDbError(error)");
  });

  test("l'import s'arrête dès que la limite d'offre est atteinte", () => {
    // Sinon des centaines de requêtes partent en sachant qu'elles seront toutes
    // refusées.
    const importFn = SOURCE.slice(requireIndex(SOURCE, "export async function importTrades"));
    expect(importFn).toContain("if (planLimitReached) {");
    expect(importFn).toContain("break;");
  });
});

describe("miroir de session", () => {
  const SOURCE = readSource(import.meta.dir, "../src/app/hooks/useTrades.ts");

  test("jamais de miroir PARTIEL", () => {
    // Le miroir sert d'`initialData` : il est peint tel quel, et tout ce que le
    // produit calcule le serait sur cet échantillon. Au-delà du seuil, on ne
    // miroite rien plutôt que d'afficher un instant des chiffres faux.
    expect(SOURCE).toContain("if (payload.length > MIRROR_MAX_CHARS)");
    const guard = SOURCE.slice(requireIndex(SOURCE, "if (payload.length > MIRROR_MAX_CHARS)"));
    expect(guard.slice(0, 300)).toContain("drop();");
  });

  test("un échec de quota EFFACE le miroir au lieu de laisser une version périmée", () => {
    expect(SOURCE).toContain("const drop = () => {");
    expect(SOURCE).toContain("sessionStorage.removeItem(sKey)");
  });

  test("la donnée initiale est déclarée périmée pour que le refetch parte", () => {
    // Sans `initialDataUpdatedAt: 0`, React Query considère `initialData` comme
    // fraîche à l'instant du montage : combinée à `staleTime`, elle empêchait
    // TOUT rafraîchissement pendant trente secondes après un F5.
    expect(SOURCE).toContain("initialDataUpdatedAt: 0");
  });

  test("la requête reçoit le compte de la CLÉ de cache", () => {
    expect(SOURCE).toContain("loadUserTrades(userId as string, { accountId })");
  });
});
