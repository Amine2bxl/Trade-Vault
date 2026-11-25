import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { enforceHourlyAiQuota, requireJarvisSideAccess } from "@/backend/require-pro";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  CAPTURE_LIMITS,
  emptyExtraction,
  normalizeExtraction,
  type CaptureExtraction,
} from "@/domain/capture";
import { resolveProviders, resolveVisionProviders, type AIImage } from "@/modules/ai-provider";
import { slotChain } from "@/modules/ai/runtime/tiers";
import { runCaptureExtraction } from "@/modules/ai/agents/capture.agent";
import { recordAgentRun } from "./telemetry.server";
import { captureFingerprint, sniffImageType } from "./capture.server";

/**
 * LE MOTEUR DE CAPTURE — fonction serveur.
 *
 * Un seul point d'entrée pour toutes les sources (captures collées dans le
 * formulaire, setup manqué, Inbox, note, dictée). Il :
 *   1. relit les captures dans le bucket existant avec le client DU TRADER
 *      (les règles Storage s'appliquent : on ne lit que ses fichiers) ;
 *   2. calcule une empreinte (images + note + version) : une capture déjà
 *      analysée n'est JAMAIS réanalysée — la ligne `capture_items` sert de cache ;
 *   3. n'appelle le modèle qu'ensuite, sous le plafond horaire anti-abus ;
 *   4. passe la réponse au crible déterministe (`normalizeExtraction`) ;
 *   5. écrit le résultat dans la file (`capture_items`), l'original figé.
 *
 * Il n'écrit JAMAIS dans `trades` ni `missed_opportunities` : le trader valide
 * dans le formulaire, qui reste la seule voie d'écriture du journal.
 *
 * COUPE-CIRCUIT : `AI_CAPTURE=off` arrête l'analyse sans redéploiement.
 */

const BUCKET = "trade-screenshots";
/** Au-delà, une analyse « en cours » est tenue pour interrompue et peut reprendre. */
const STALE_PROCESSING_MS = 2 * 60_000;

const Input = z
  .object({
    paths: z.array(z.string().min(3).max(300)).max(CAPTURE_LIMITS.maxImages),
    note: z.string().max(CAPTURE_LIMITS.maxNoteChars).optional(),
    source: z.enum(["image", "note", "voice"]),
    target: z.enum(["trade", "missed"]),
    accountId: z.string().uuid().nullable().optional(),
    /** Date civile du trader (`todayLocalDate()`), pour refuser une date future. */
    today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    hints: z
      .object({
        symbol: z.string().max(24).optional(),
        date: z.string().max(10).optional(),
        setups: z.array(z.string().max(60)).max(20).optional(),
      })
      .optional(),
    /** « Nouvelle analyse » : ignore le cache, garde l'original. */
    force: z.boolean().optional(),
  })
  .refine((d) => d.paths.length > 0 || !!d.note?.trim(), { message: "Nothing to analyze" });

export type CaptureStatus = "completed" | "processing" | "failed" | "disabled" | "no_provider";

export interface CaptureResponse {
  status: CaptureStatus;
  itemId: string | null;
  extraction: CaptureExtraction | null;
  cached: boolean;
}

type Db = SupabaseClient<Database>;

export const analyzeCapture = createServerFn({ method: "POST" })
  .middleware([requireJarvisSideAccess])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }): Promise<CaptureResponse> => {
    const none = (status: CaptureStatus, itemId: string | null = null): CaptureResponse => ({
      status,
      itemId,
      extraction: null,
      cached: false,
    });
    if (process.env.AI_CAPTURE === "off") return none("disabled");

    const { supabase, userId } = context as { supabase: Db; userId: string };
    const note = data.note?.trim() || null;

    // 1. Les captures du trader, et seulement les siennes.
    const images: Uint8Array[] = [];
    const aiImages: AIImage[] = [];
    for (const path of data.paths) {
      if (!path.startsWith(`${userId}/`) || path.includes("..")) {
        throw new Error("FORBIDDEN: capture path outside the caller's folder");
      }
      const { data: blob, error } = await supabase.storage.from(BUCKET).download(path);
      if (error || !blob) throw new Error("CAPTURE_UNREADABLE: screenshot could not be read");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (bytes.byteLength > CAPTURE_LIMITS.maxImageBytes) {
        throw new Error("CAPTURE_TOO_LARGE: screenshot exceeds the size limit");
      }
      const mimeType = sniffImageType(bytes);
      if (!mimeType) throw new Error("CAPTURE_NOT_IMAGE: unsupported file type");
      images.push(bytes);
      aiImages.push({ mimeType, data: Buffer.from(bytes).toString("base64") });
    }

    // 2. Le cache : une capture inchangée ne coûte jamais un second appel.
    const hash = captureFingerprint(images, note, data.target);
    const { data: existing } = await supabase
      .from("capture_items")
      .select("id, status, extraction, updated_at, attempts")
      .eq("user_id", userId)
      .eq("content_hash", hash)
      .maybeSingle();
    if (existing && !data.force) {
      if (
        (existing.status === "completed" || existing.status === "applied") &&
        existing.extraction
      ) {
        return {
          status: "completed",
          itemId: existing.id,
          extraction: existing.extraction as unknown as CaptureExtraction,
          cached: true,
        };
      }
      // Déjà en cours ailleurs (double clic, deux onglets) : pas de seconde exécution.
      if (
        existing.status === "processing" &&
        Date.now() - new Date(existing.updated_at).getTime() < STALE_PROCESSING_MS
      ) {
        return none("processing", existing.id);
      }
    }

    const providers = aiImages.length ? resolveVisionProviders() : resolveProviders();
    if (providers.length === 0) return none("no_provider", existing?.id ?? null);

    // 3. Le jeton horaire n'est pris qu'ici : un appel modèle va vraiment partir.
    await enforceHourlyAiQuota(supabase);

    const base = {
      account_id: data.accountId ?? null,
      source: data.source,
      target: data.target,
      screenshots: data.paths,
      note,
    };
    let itemId = existing?.id ?? null;
    if (itemId) {
      await supabase
        .from("capture_items")
        .update({
          ...base,
          status: "processing",
          attempts: Math.min(50, (existing?.attempts ?? 0) + 1),
          error: null,
        })
        .eq("id", itemId);
    } else {
      const { data: row, error } = await supabase
        .from("capture_items")
        .insert({ ...base, user_id: userId, content_hash: hash, status: "processing", attempts: 1 })
        .select("id")
        .single();
      // Course perdue contre un autre onglet : la contrainte unique a parlé.
      if (error || !row) return none("processing");
      itemId = row.id;
    }

    let served = { provider: "", model: "", latencyMs: 0, inputTokens: 0, outputTokens: 0 };
    try {
      const out = await runCaptureExtraction(
        { images: aiImages, note, target: data.target, hints: data.hints ?? {} },
        slotChain(aiImages.length ? "balanced" : "fast", providers),
        {
          onUsage: (e) => {
            served = {
              provider: e.provider,
              model: e.model,
              latencyMs: e.latencyMs,
              inputTokens: e.inputTokens ?? 0,
              outputTokens: e.outputTokens ?? 0,
            };
          },
        },
      );
      const extraction =
        out.raw === null
          ? emptyExtraction(data.target)
          : normalizeExtraction(out.raw, { target: data.target, note, today: data.today });
      const json = extraction as unknown as Json;

      await supabase
        .from("capture_items")
        .update({
          status: "completed",
          extraction: json,
          model: `${out.provider}:${out.model}`.slice(0, 120),
          processed_at: new Date().toISOString(),
          error: null,
        })
        .eq("id", itemId);
      // L'original n'est posé qu'une fois : une nouvelle analyse ne l'efface pas.
      await supabase
        .from("capture_items")
        .update({ original_extraction: json })
        .eq("id", itemId)
        .is("original_extraction", null);

      void recordAgentRun({
        userId,
        agent: "capture-extract",
        intent: "analyze_trade",
        provider: served.provider,
        model: served.model,
        status: "ok",
        latencyMs: served.latencyMs,
        inputTokens: served.inputTokens,
        outputTokens: served.outputTokens,
      });
      return { status: "completed", itemId, extraction, cached: false };
    } catch (err) {
      const message = err instanceof Error ? err.message.slice(0, 300) : "analysis failed";
      await supabase
        .from("capture_items")
        .update({ status: "failed", error: message })
        .eq("id", itemId);
      void recordAgentRun({
        userId,
        agent: "capture-extract",
        intent: "analyze_trade",
        provider: served.provider,
        model: served.model,
        status: "error",
        latencyMs: served.latencyMs,
        error: message,
      });
      return none("failed", itemId);
    }
  });
