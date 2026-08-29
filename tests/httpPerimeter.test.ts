import { describe, expect, test } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { readSource, stripComments } from "./helpers/source";

/**
 * LE PÉRIMÈTRE HTTP — tout ce qu'un inconnu peut atteindre.
 *
 * Le produit expose deux surfaces distinctes, et c'est ce qui a laissé passer
 * `/dev/ai` : ses trois fonctions étaient des `createServerFn` SANS
 * middleware, et le limiteur de débit du serveur ne les couvrait pas — il ne
 * s'applique qu'aux chemins `/api/`. `aiRuntimeStatus` livrait donc la carte
 * des fournisseurs IA configurés à qui la demandait, et `aiRuntimeProbe`
 * déclenchait un appel modèle réel, facturé, sans authentification.
 *
 * Ce fichier tient l'INVENTAIRE des deux surfaces. Il n'essaie pas de deviner
 * si un garde est correct — il exige que chaque entrée en ait un, nommé, et
 * que l'exception soit écrite noir sur blanc.
 */

const SRC = resolve(import.meta.dir, "..", "src");
const read = (p: string) => readSource(import.meta.dir, p);

/* ────────────────────────────────────────────────────────────────────────────
   SURFACE 1 — les server functions (RPC du framework)
   ──────────────────────────────────────────────────────────────────────── */

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsFiles(full));
    else if (/\.tsx?$/.test(full) && !full.includes("/tests/")) out.push(full);
  }
  return out;
}

/** Nom de la fonction → middleware déclaré, ou `null`. */
function serverFunctions(): Map<string, string | null> {
  const found = new Map<string, string | null>();
  for (const file of tsFiles(SRC)) {
    const code = stripComments(readSource(import.meta.dir, relative(import.meta.dir, file)));
    if (!code.includes("createServerFn")) continue;
    for (const m of code.matchAll(
      /const\s+(\w+)\s*=\s*createServerFn\([^)]*\)((?:\s*\.\w+\((?:[^()]|\([^()]*\))*\))*)/g,
    )) {
      const chain = m[2] ?? "";
      const mw = /middleware\(\[([^\]]*)\]/.exec(chain);
      found.set(m[1], mw ? mw[1].trim() : null);
    }
  }
  return found;
}

/**
 * Les seules server functions autorisées à répondre sans authentification, et
 * la raison exacte.
 */
const PUBLIC_SERVER_FNS: Record<string, string> = {
  fetchEconomicCalendar:
    "lit le calendrier économique déjà mis en cache en base par le cron — aucune donnée d'utilisateur, aucun appel payant, aucune clé d'API",
  ttsCapabilities:
    "rend un unique booléen : une voix hébergée est-elle configurée. Aucun coût, et l'interface en a besoin avant toute connexion pour choisir la voix du navigateur",
};

describe("server functions", () => {
  const fns = serverFunctions();

  test("l'inventaire n'est pas vide (le relevé fonctionne encore)", () => {
    // Sans ce garde, une régression de l'expression régulière rendrait tous
    // les tests suivants verts en n'inspectant plus rien.
    expect(fns.size).toBeGreaterThanOrEqual(15);
  });

  test("chacune est authentifiée, ou explicitement publique", () => {
    const unguarded = [...fns.entries()]
      .filter(([name, mw]) => mw === null && !(name in PUBLIC_SERVER_FNS))
      .map(([name]) => name)
      .sort();
    expect(unguarded).toEqual([]);
  });

  test("les fonctions de diagnostic IA exigent une adresse administrateur", () => {
    // C'est LE défaut corrigé : trois fonctions sans middleware sur une route
    // que rien ne protégeait.
    for (const name of ["aiRuntimeStatus", "aiRuntimeProbe", "aiTelemetryStats"]) {
      expect(fns.get(name), name).toBe("requireAdminAccess");
    }
  });

  test("toute fonction IA facturée passe par le contrôle d'accès payant", () => {
    for (const name of [
      "aiChat",
      "aiAnalyzeTrade",
      "aiDetectPatterns",
      "aiGenerateDailyBrief",
      "aiGenerateLessons",
      "aiGenerateWeeklyReview",
      "askCoach",
      "extractMemory",
    ]) {
      expect(fns.get(name), name).toBe("requireProAccess");
    }
    // La synthèse vocale brûle un quota ElevenLabs : elle était ANONYME.
    expect(fns.get("ttsSpeak")).toBe("requireSupabaseAuth");
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   SURFACE 2 — les routes `/api/` déclarées à la main dans `server.ts`
   ──────────────────────────────────────────────────────────────────────── */

/** Les gardes que le produit connaît, par nom. */
const GUARDS = [
  "adminFromRequest", // adresse listée dans ADMIN_EMAILS
  "userFromRequest", // jeton Supabase du porteur
  "verifyStripeSignature", // HMAC de Stripe
  "verifyCommerceSignature", // HMAC de Coinbase Commerce
  "CRON_SECRET", // secret partagé des crons
];

/** Route → pourquoi elle répond sans garde. */
const PUBLIC_ROUTES: Record<string, string> = {
  "/api/health":
    "sonde de disponibilité : ne rend qu'un statut, et n'est même pas limitée en débit",
};

describe("routes /api/", () => {
  const server = stripComments(read("../src/server.ts"));

  /**
   * « MÉTHODE chemin » → nom du gestionnaire, tel que `server.ts` les branche.
   *
   * La clé porte la MÉTHODE, et ce n'est pas cosmétique : deux routes
   * partagent le même chemin (`GET` et `POST` sur `/api/admin/grants` et sur
   * `/api/admin/promos`). Une clé réduite au chemin les écrasait l'une
   * l'autre, et les deux gestionnaires de lecture n'étaient donc JAMAIS
   * vérifiés. C'est une mutation — retirer le garde de `handleListPromos` —
   * qui l'a révélé : la suite restait verte.
   */
  function routes(): Map<string, string> {
    const out = new Map<string, string>();
    for (const m of server.matchAll(
      /pathname === "(\/api\/[^"]*)"\s*&&\s*request\.method === "(\w+)"[\s\S]{0,400}?const \{ (handle\w+) \}/g,
    )) {
      out.set(`${m[2]} ${m[1]}`, m[3]);
    }
    // `/api/health` ne teste pas la méthode : elle répond à tout.
    if (server.includes('pathname === "/api/health"')) out.set("GET /api/health", "");
    return out;
  }

  const table = routes();

  test("l'inventaire n'est pas vide", () => {
    expect(table.size).toBeGreaterThanOrEqual(18);
  });

  test("chaque gestionnaire vérifie quelque chose avant d'agir", () => {
    // Le corps du gestionnaire doit nommer un garde connu. On ne juge pas ici
    // s'il est bien appliqué — c'est le rôle des suites de facturation et de
    // sécurité ; on exige qu'il y en ait un.
    // Le début du gestionnaire, borné à la fonction SUIVANTE. Les deux bornes
    // comptent : sans la limite de caractères on lirait un gestionnaire
    // entier, sans la borne `export` la fenêtre déborderait sur la fonction
    // d'à côté — dont le garde masquerait l'absence de celui-ci. Un garde
    // s'écrit de toute façon dans les premières lignes, avant tout travail.
    const handlers = new Map<string, string>();
    for (const file of tsFiles(join(SRC, "backend"))) {
      const code = stripComments(readSource(import.meta.dir, relative(import.meta.dir, file)));
      for (const m of code.matchAll(/export async function (handle\w+)\s*\(/g)) {
        const from = m.index ?? 0;
        const next = code.indexOf("\nexport ", from + 1);
        handlers.set(
          m[1],
          code.slice(from, Math.min(next === -1 ? code.length : next, from + 1500)),
        );
      }
    }

    const naked: string[] = [];
    for (const [route, handler] of table) {
      if (PUBLIC_ROUTES[route.split(" ")[1]]) continue;
      const body = handlers.get(handler);
      // Un gestionnaire introuvable est un échec, pas un laissez-passer.
      if (!body) {
        naked.push(`${route} → ${handler} (corps introuvable)`);
        continue;
      }
      if (!GUARDS.some((g) => body.includes(g))) naked.push(`${route} → ${handler}`);
    }
    expect(naked.sort()).toEqual([]);
  });

  test("toute route d'administration passe par ADMIN_EMAILS", () => {
    const admin = readSource(import.meta.dir, "../src/backend/admin.server.ts");
    const promo = readSource(import.meta.dir, "../src/backend/promo.server.ts");
    for (const [route, handler] of table) {
      if (!route.includes(" /api/admin/")) continue;
      const source = handler.includes("Promo") || handler.includes("promo") ? promo : admin;
      const body = new RegExp(
        `export async function ${handler}\\s*\\([\\s\\S]{0,400}?adminFromRequest`,
      );
      expect(body.test(source), `${route} → ${handler}`).toBe(true);
    }
    // `adminFromRequest` est bien adossé à `ADMIN_EMAILS`, et non à une
    // colonne que l'application pourrait écrire.
    expect(admin).toContain("isAdminEmail");
    expect(readSource(import.meta.dir, "../src/backend/admin-access.ts")).toContain("ADMIN_EMAILS");
  });

  test("les deux webhooks vérifient une signature avant de toucher un abonnement", () => {
    const billing = readSource(import.meta.dir, "../src/backend/billing.server.ts");
    const crypto = readSource(import.meta.dir, "../src/backend/crypto-pay.server.ts");
    expect(billing).toContain("verifyStripeSignature");
    expect(crypto).toContain("verifyCommerceSignature");
  });

  test("tout cron exige le secret partagé", () => {
    for (const file of [
      "../src/backend/monthly-reports.server.ts",
      "../src/backend/lifecycle-emails.server.ts",
      "../src/backend/pattern-scan.server.ts",
      "../src/backend/economic-calendar.server.ts",
      "../src/backend/goal-reminders.server.ts",
    ]) {
      const code = read(file);
      expect(code, file).toContain("process.env.CRON_SECRET");
      expect(code, file).toContain("unauthorized");
    }
  });
});
