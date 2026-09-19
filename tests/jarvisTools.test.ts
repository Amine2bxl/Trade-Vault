import { test, expect } from "bun:test";
import { ensureJarvisTools, JARVIS_TOOL_DEFS, JARVIS_TOOL_NAMES } from "../src/backend/ai-tools";
import { getTool, toolManifest } from "../src/modules/ai/tools/types";
import { toProviderTools } from "../src/modules/ai/tools/runtime";
import { buildCoachMessages, runCoach, TOOL_PROTOCOL } from "../src/modules/ai/agents/coach.agent";
import type { AIProvider, AIRequest, AIResponse } from "../src/modules/ai/infra";

/**
 * LES OUTILS DE JARVIS — les garanties qui ne doivent jamais se perdre.
 *
 * Ce fichier ne teste pas « est-ce que ça marche » : un appel d'outil réel a
 * besoin d'une base. Il teste les quatre invariants qu'une évolution innocente
 * casserait sans que rien ne le signale, et qui portent chacun un vrai risque :
 *
 *  1. AUCUN OUTIL N'ÉCRIT. Un `sideEffect: true` glissé dans la liste
 *     deviendrait appelable par un modèle à partir d'une phrase du trader.
 *  2. AUCUN SCHÉMA NE LAISSE CHOISIR L'UTILISATEUR NI LE COMPTE. C'est la
 *     seule défense qui tient contre une injection dans la question : le modèle
 *     ne peut pas demander le journal de quelqu'un d'autre s'il n'a pas de
 *     champ pour l'écrire.
 *  3. LE PROTOCOLE N'APPARAÎT QUE SI LES OUTILS SONT LÀ. Décrire des outils
 *     absents produit un assistant qui annonce des lectures qu'il ne fera pas.
 *  4. LE CHEMIN SANS OUTILS RÉPOND TOUJOURS. C'est celui servi quand aucune
 *     provider ne sait les appeler ; s'il se casse, l'IA se tait en production.
 */

test("tous les outils de Jarvis sont en lecture seule et locaux", () => {
  expect(JARVIS_TOOL_DEFS.length).toBeGreaterThan(0);
  for (const tool of JARVIS_TOOL_DEFS) {
    expect(tool.sideEffect).toBe(false);
    expect(tool.source).toBe("local");
    // Une description courte est une description que le modèle ignore : c'est
    // elle qui décide s'il appelle l'outil ou s'il improvise.
    expect(tool.description.length).toBeGreaterThan(80);
    expect((tool.inputSchema as { type?: string }).type).toBe("object");
  }
});

test("aucun schéma d'outil ne laisse le modèle choisir l'utilisateur ou le compte", () => {
  for (const tool of JARVIS_TOOL_DEFS) {
    const schema = JSON.stringify(tool.inputSchema).toLowerCase();
    for (const interdit of ["userid", "user_id", "accountid", "account_id", "email"]) {
      expect(schema).not.toContain(interdit);
    }
  }
});

test("les noms sont uniques et le registre se remplit une seule fois", () => {
  expect(new Set(JARVIS_TOOL_NAMES).size).toBe(JARVIS_TOOL_NAMES.length);

  const noms = ensureJarvisTools();
  expect(noms).toEqual(JARVIS_TOOL_NAMES);
  const premier = getTool(JARVIS_TOOL_NAMES[0]);
  // Idempotence : un second appel ne doit pas REMPLACER les définitions, sans
  // quoi un outil capturé par une boucle en cours pointerait sur une autre.
  ensureJarvisTools();
  expect(getTool(JARVIS_TOOL_NAMES[0])).toBe(premier);

  expect(toolManifest(JARVIS_TOOL_NAMES).length).toBe(JARVIS_TOOL_NAMES.length);
  const manifeste = toProviderTools(JARVIS_TOOL_NAMES);
  expect(manifeste.map((t) => t.name)).toEqual([...JARVIS_TOOL_NAMES]);
  for (const t of manifeste) expect(t.parameters).toBeDefined();
});

test("les cinq outils attendus sont présents", () => {
  expect([...JARVIS_TOOL_NAMES].sort()).toEqual([
    "get_edge_score",
    "get_mistakes",
    "get_stats",
    "get_trades",
    "search_memory",
  ]);
});

test("sans identifiants serveur, un outil échoue en le DISANT", async () => {
  ensureJarvisTools();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    // Le message compte : il remonte au modèle comme `ToolResult.error`. Un
    // échec muet lui ferait conclure que le trader n'a aucune donnée — et il
    // le lui dirait, ce qui est une fausse affirmation sur son propre journal.
    const outil = getTool("get_stats")!;
    await expect(outil.execute({}, { userId: "u1" })).rejects.toThrow(/Database unavailable/);
  } finally {
    if (url) process.env.SUPABASE_URL = url;
    if (key) process.env.SUPABASE_SERVICE_ROLE_KEY = key;
  }
});

test("le protocole d'outils n'entre dans le prompt que quand des outils sont branchés", () => {
  const sans = buildCoachMessages({ question: "ça va ?" });
  expect(sans[0].content).not.toContain(TOOL_PROTOCOL);

  const avec = buildCoachMessages({ question: "ça va ?" }, { tools: true });
  expect(avec[0].content).toContain(TOOL_PROTOCOL);
  // Le contrat anti-hallucination ne disparaît PAS quand les outils arrivent.
  expect(avec[0].content).toContain("STRICT DATA RULE");
});

// ── La boucle, avec une provider factice ─────────────────────────────────────

/** Une provider qui demande un outil au premier tour, puis répond. */
function providerOutillee(appels: AIRequest[]): AIProvider {
  let tour = 0;
  return {
    id: "fake-tools",
    supportsTools: true,
    isConfigured: () => true,
    async complete(req: AIRequest): Promise<AIResponse> {
      appels.push(req);
      tour += 1;
      if (tour === 1) {
        return {
          text: "",
          provider: "fake-tools",
          model: "m",
          finishReason: "tool_calls",
          toolCalls: [{ id: "c1", name: "get_stats", arguments: { days: 30 } }],
        };
      }
      return { text: "Ton win rate tient, ta taille non.", provider: "fake-tools", model: "m" };
    },
  };
}

test("runCoach exécute l'outil demandé et REND sa sortie au modèle", async () => {
  ensureJarvisTools();
  const appels: AIRequest[] = [];
  const url = process.env.SUPABASE_URL;
  delete process.env.SUPABASE_URL;
  try {
    const res = await runCoach(
      { question: "où je perds ?" },
      {
        provider: providerOutillee(appels),
        tools: JARVIS_TOOL_NAMES,
        toolContext: { userId: "u1", accountId: null },
      },
    );
    expect(res.text).toContain("win rate");
    // Deux allers-retours : la demande d'outil, puis la réponse.
    expect(appels.length).toBe(2);
    // Le manifeste a bien été remis au modèle.
    expect(appels[0].tools?.map((t) => t.name)).toContain("get_stats");
    /* Et surtout : l'outil a ÉCHOUÉ (pas de base en test) et son échec est
       revenu au modèle au lieu de faire tomber la requête. C'est le
       comportement qui compte en production : une lecture impossible dégrade la
       réponse, elle ne l'annule pas. */
    const relance = appels[1].messages.map((m) => m.content).join("\n");
    expect(relance).toContain("TOOL RESULTS");
    expect(relance).toContain("get_stats");
  } finally {
    if (url) process.env.SUPABASE_URL = url;
  }
});

test("sans contexte d'outil, le coach garde l'ancien chemin — un seul appel", async () => {
  const appels: AIRequest[] = [];
  const res = await runCoach(
    { question: "help", stats: { winRate: 0.5 } },
    { provider: providerOutillee(appels), tools: JARVIS_TOOL_NAMES },
  );
  expect(appels.length).toBe(1);
  expect(appels[0].tools).toBeUndefined();
  // La première réponse de la factice ne porte pas de texte : le chemin sans
  // outils la rend telle quelle, et c'est `askCoach` qui sert alors le repli
  // déterministe. Ce qui compte ici, c'est qu'aucun outil n'ait été remis.
  expect(res.provider).toBe("fake-tools");
});

test("si la boucle d'outils échoue, le coach répond quand même", async () => {
  ensureJarvisTools();
  const appels: AIRequest[] = [];
  /* Échoue UNIQUEMENT quand des outils sont présents : c'est la panne réelle
     qu'on veut couvrir — une provider capable d'outils indisponible, alors
     qu'une autre clé peut encore répondre sans. */
  const capricieuse: AIProvider = {
    id: "fake-flaky",
    supportsTools: true,
    isConfigured: () => true,
    async complete(req: AIRequest): Promise<AIResponse> {
      appels.push(req);
      if (req.tools?.length) throw new Error("tool endpoint down");
      return { text: "Réponse sans outils.", provider: "fake-flaky", model: "m" };
    },
  };
  const res = await runCoach(
    { question: "où je perds ?" },
    {
      provider: capricieuse,
      tools: JARVIS_TOOL_NAMES,
      toolContext: { userId: "u1", accountId: null },
    },
  );
  expect(res.text).toContain("Réponse sans outils");
  expect(appels.length).toBe(2);
  expect(appels[1].tools).toBeUndefined();
});
