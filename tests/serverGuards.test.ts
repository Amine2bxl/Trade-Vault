import { afterEach, describe, expect, test } from "bun:test";
import { adminEmails, isAdminEmail } from "../src/backend/admin-access";
import { readSource, stripComments } from "./helpers/source";

/**
 * LES GARDES SERVEUR.
 *
 * Une server function est un point d'entrée HTTP. Cacher la page qui l'appelle
 * ne la protège pas : `/dev/ai` n'était « protégée » que par l'absence de lien
 * et une balise `noindex`, pendant que ses deux server functions répondaient à
 * n'importe qui — dont l'une en déclenchant un appel modèle facturé.
 *
 * Deux niveaux de test ici :
 *   • la DÉCISION d'admin est une fonction pure : elle est exécutée pour de vrai ;
 *   • le CÂBLAGE des middlewares est vérifié sur la source, parce qu'un
 *     middleware TanStack Start ne s'exécute pas hors de son runtime — et
 *     qu'une garde retirée par mégarde ne casserait aucun autre test.
 */

const ENV = process.env.ADMIN_EMAILS;
afterEach(() => {
  if (ENV === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = ENV;
});

describe("isAdminEmail — fermé par défaut", () => {
  test("sans ADMIN_EMAILS, PERSONNE n'est administrateur", () => {
    delete process.env.ADMIN_EMAILS;
    expect(adminEmails()).toEqual([]);
    expect(isAdminEmail("qui-que-ce-soit@example.com")).toBe(false);
  });

  test("une variable vide n'ouvre rien non plus", () => {
    process.env.ADMIN_EMAILS = "";
    expect(isAdminEmail("")).toBe(false);
    expect(isAdminEmail("a@b.com")).toBe(false);
  });

  test("une adresse vide ne peut pas correspondre à une entrée vide", () => {
    // Le piège : `"a@b.com,,c@d.com".split(",")` contient une chaîne vide. Sans
    // `filter(Boolean)`, un appelant sans adresse deviendrait administrateur.
    process.env.ADMIN_EMAILS = "a@b.com,,c@d.com";
    expect(isAdminEmail("")).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });

  test("la liste est insensible à la casse et aux espaces", () => {
    process.env.ADMIN_EMAILS = " Admin@Example.COM , second@example.com ";
    expect(isAdminEmail("admin@example.com")).toBe(true);
    expect(isAdminEmail("ADMIN@EXAMPLE.COM")).toBe(true);
    expect(isAdminEmail("  admin@example.com  ")).toBe(true);
    expect(isAdminEmail("second@example.com")).toBe(true);
  });

  test("un utilisateur ordinaire n'est pas administrateur", () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    expect(isAdminEmail("trader@example.com")).toBe(false);
  });

  test("une correspondance PARTIELLE ne suffit pas", () => {
    // `includes` sur un tableau, pas sur une chaîne : « admin@example.com.evil.tld »
    // ne doit jamais passer.
    process.env.ADMIN_EMAILS = "admin@example.com";
    expect(isAdminEmail("admin@example.com.evil.tld")).toBe(false);
    expect(isAdminEmail("notadmin@example.com")).toBe(false);
    expect(isAdminEmail("admin@example.co")).toBe(false);
  });
});

const read = (p: string) => readSource(import.meta.dir, p);

describe("câblage des gardes — /dev/ai", () => {
  const cases: [string, string][] = [
    ["aiRuntimeStatus", "../src/modules/ai/runtime/status.ts"],
    ["aiRuntimeProbe", "../src/modules/ai/runtime/probe.ts"],
    ["aiTelemetryStats", "../src/modules/ai/runtime/telemetry-stats.ts"],
  ];

  for (const [name, path] of cases) {
    test(`${name} exige une adresse administratrice, côté serveur`, () => {
      const source = read(path);
      expect(source).toContain('from "@/backend/require-admin"');
      expect(source).toContain(".middleware([requireAdminAccess])");
    });
  }

  test("la garde chaîne bien après l'authentification", () => {
    // Sans `requireSupabaseAuth` en amont, `context.user` serait vide et la
    // comparaison d'adresse porterait sur rien du tout.
    const guard = read("../src/backend/require-admin.ts");
    expect(guard).toContain(".middleware([requireSupabaseAuth])");
    expect(guard).toContain("if (!isAdminEmail(email)) throw new AdminRequiredError();");
  });

  test("la page ne se protège pas elle-même — elle reflète le refus du serveur", () => {
    const page = read("../src/routes/dev.ai.tsx");
    expect(page).toContain("setForbidden(true)");
    // Aucune décision d'accès prise dans le composant : pas de liste
    // d'adresses côté client, qui serait à la fois inefficace et une fuite.
    // Hors commentaires — l'en-tête du fichier EXPLIQUE que la garde repose sur
    // `ADMIN_EMAILS`, et cette explication ne doit pas faire échouer le test.
    expect(stripComments(page).includes("ADMIN_EMAILS")).toBe(false);
  });
});

describe("câblage des gardes — synthèse vocale", () => {
  const tts = read("../src/backend/tts.functions.ts");

  test("ttsSpeak exige une authentification", () => {
    // Elle n'en avait aucune : n'importe qui pouvait brûler le quota
    // ElevenLabs, six cents caractères à la fois, sans même créer de compte.
    expect(tts).toContain('from "@/integrations/supabase/auth-middleware"');
    expect(tts).toContain(".middleware([requireSupabaseAuth])");
  });

  test("ttsSpeak est soumis à un quota serveur, sur sa propre portée", () => {
    expect(tts).toContain("consume_ai_quota_scoped");
    // Portée distincte : griller sa voix ne doit pas consommer le quota du
    // coach, et inversement.
    expect(tts).toContain('p_scope: "tts"');
  });

  test("le quota de la voix échoue FERMÉ", () => {
    // Le repli est la voix locale du navigateur : l'utilisateur garde la
    // fonctionnalité, donc rien ne justifie de laisser passer un appel facturé
    // quand on ne sait pas s'il est dans les clous.
    expect(tts).toMatch(/if \(error \|\| allowed === false\)[\s\S]{0,200}available: false/);
  });

  test("le limiteur d'IP de server.ts ne couvre PAS les server functions", () => {
    // Constat qui justifie le quota ci-dessus : il ne s'applique qu'aux chemins
    // `/api/`, or les server functions ne sont pas servies sous `/api/`.
    const server = read("../src/server.ts");
    expect(server).toContain('pathname.startsWith("/api/")');
  });
});

describe("câblage des gardes — quotas IA", () => {
  const requirePro = read("../src/backend/require-pro.ts");

  test("le quota quotidien est compté EN BASE, à partir du palier lu en base", () => {
    expect(requirePro).toContain("LIMITS[effectiveTier(row)].jarvisPerDay");
    expect(requirePro).toContain('consumeQuota(supabase, "daily"');
  });

  test("le quota quotidien et le plafond horaire sont deux compteurs séparés", () => {
    // Une seule clé `(user_id, window_start)` les aurait fait partager une
    // ligne : les deux fenêtres tombent sur le même instant à minuit UTC.
    expect(requirePro).toContain('consumeQuota(supabase, "hourly"');
    expect(requirePro).toContain("p_scope: scope");
  });

  test("le quota commercial échoue FERMÉ, le garde-fou de coût échoue OUVERT", () => {
    // Deux natures différentes, deux décisions différentes — et c'est pour ça
    // que `consumeQuota` distingue `false` de `null`.
    expect(requirePro).toContain("if (allowed !== true) throw new DailyQuotaError();");
    expect(requirePro).toContain("if (withinHourly === false) throw new RateLimitError();");
  });

  test("l'entitlement échoue FERMÉ", () => {
    expect(requirePro).toContain("if (rowError || !isEntitled(row)) throw new ProRequiredError();");
  });
});

describe("outils IA à effet de bord", () => {
  test("un outil qui écrit n'est jamais exécuté sans autorisation explicite", () => {
    // Le contenu utilisateur (notes, mémoire, conversation) est une donnée non
    // fiable qui atteint le modèle. La barrière n'est pas de filtrer ce
    // contenu — c'est que rien d'irréversible ne parte d'une décision du modèle
    // seul.
    const runtime = read("../src/modules/ai/tools/runtime.ts");
    expect(runtime).toContain("tool.sideEffect && !opts.allowSideEffects");
  });

  test("une proposition d'agent est revalidée au moment de l'acceptation", () => {
    const proposals = read("../src/backend/proposals.functions.ts");
    expect(proposals).toContain("validateProposal({");
    expect(proposals).toContain(".middleware([requireSupabaseAuth])");
  });
});
