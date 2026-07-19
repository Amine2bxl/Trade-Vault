/**
 * RAG (Retrieval-Augmented Generation) foundation.
 *
 * Two provider-agnostic contracts mirroring the AI Provider pattern:
 *   - EmbeddingProvider: turns text into vectors (swap OpenAI/Gemini/local by
 *     env, exactly like the chat provider).
 *   - Retriever: indexes the trader's own artifacts (trades, notes, lessons,
 *     reports) and returns the most relevant passages for a query, scoped to
 *     the user. Vectors live in Postgres (pgvector) with owner-only RLS.
 *
 * Retrieved chunks flow into AgentRequest.retrieved so an agent answers from
 * the trader's real history, not the model's generic priors.
 *
 * FOUNDATION ONLY: contracts. No embedding/retrieval is implemented.
 */

export type EmbeddingSource = "trade" | "note" | "lesson" | "report" | "rule";

export interface EmbeddingProvider {
  readonly id: string;
  readonly dimensions: number;
  isConfigured(): boolean;
  embed(texts: string[]): Promise<number[][]>;
}

/** A user artifact to be embedded + indexed for retrieval. */
export interface RagDocument {
  userId: string;
  source: EmbeddingSource;
  /** Id of the origin row (trade id, report id…) for dedupe + re-index. */
  sourceId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

/** A passage returned by semantic search, scored by similarity. */
export interface RetrievedChunk {
  source: EmbeddingSource;
  sourceId: string;
  content: string;
  /** Cosine similarity in [0,1] — higher is closer. */
  score: number;
  metadata?: Record<string, unknown>;
}

export interface Retriever {
  /** Embed + upsert one document into the user's vector store. */
  index(doc: RagDocument): Promise<void>;
  /** Remove a document (e.g. when the source row is deleted). */
  remove(userId: string, source: EmbeddingSource, sourceId: string): Promise<void>;
  /** Top-k most relevant passages for a query, scoped to the user. */
  retrieve(userId: string, query: string, k?: number): Promise<RetrievedChunk[]>;
}
