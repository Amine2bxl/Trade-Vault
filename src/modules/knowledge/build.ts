import { hasMeasuredRisk, isBreakEven, measuredR, type Trade } from "@/domain/trade";
import { getSessionForTrade, MIN_BUCKET_SAMPLE } from "@/domain/quantStats";
import { compareChronological, verifiedPriorClosedTrade } from "@/domain/tradeOrder";
import { APPROXIMATE_SOURCE, newsForTrade, type Clock, type NewsEvent } from "@/domain/tradeNews";
import { MIN_GROUP } from "@/modules/patterns/thresholds";
import { localDateOf } from "@/shared/calendar-date";
import { KnowledgeGraph, fold } from "./graph";
import { ERROR_LIBRARY, detectSignatures, median, type BehaviorContext } from "./behavior";
import type {
  ConversationInput,
  EdgeProvenance,
  ExperimentInput,
  KnowledgeNode,
  MissedInput,
  NodeKind,
  NodeMetrics,
  ProposalInput,
  RelationType,
  ReportInput,
  ResearchInput,
  SimulationInput,
} from "./types";

/**
 * CONSTRUCTION DU GRAPHE — module PUR et déterministe.
 *
 * Mêmes enregistrements → même graphe, au lien près. Chaque extracteur lit
 * UNE source et ne relie que ce qu'elle prouve :
 *
 *   • un fait lu (le trade porte ce setup, cette erreur, cette capture) ;
 *   • une dérivation déclarée (la séance depuis l'heure de New York PROUVÉE,
 *     la bande de risque depuis la médiane mesurée, l'ordre des trades par
 *     `verifiedPriorClosedTrade`) ;
 *   • une correspondance de texte, marquée `hypothesis` (une conversation
 *     qui NOMME un setup n'en parle pas forcément) ;
 *   • une mesure, avec son `n` (deux erreurs cochées ensemble).
 *
 * Ce qui ne se prouve pas n'est pas relié : un import broker non relu n'a pas
 * de séance, un trade sans risque mesuré n'a pas de bande de risque.
 */

export const GRAPH_VERSION = 1;

export interface KnowledgeInput {
  trades: readonly Trade[];
  missed?: readonly MissedInput[];
  /** Annonces du calendrier pour les jours de trades (toutes devises). */
  events?: readonly NewsEvent[];
  conversations?: readonly ConversationInput[];
  research?: readonly ResearchInput[];
  experiments?: readonly ExperimentInput[];
  simulations?: readonly SimulationInput[];
  reports?: readonly ReportInput[];
  proposals?: readonly ProposalInput[];
  account?: { id: string | null; name: string };
  /** Famille d'une erreur (taxonomie de l'app) ; absente : pas de familles. */
  clusterOf?: (mistake: string) => string | null;
  /** Horloge des annonces (jour + heure locaux d'un instant) — injectée en test. */
  clock?: Clock;
  /** Instant du calcul, pour la provenance des liens mesurés. */
  now?: string;
  /** Réflexions et intentions par trade (plan respecté, risque prévu). */
  behavior?: BehaviorContext;
}

/** Les bandes de risque, relatives à la médiane du risque MESURÉ du trader. */
export const RISK_BANDS = [
  { key: "below", max: 0.75 },
  { key: "typical", max: 1.25 },
  { key: "elevated", max: 2 },
  { key: "oversized", max: Infinity },
] as const;
export type RiskBand = (typeof RISK_BANDS)[number]["key"];

export function riskBandOf(ratio: number): RiskBand {
  return RISK_BANDS.find((b) => ratio < b.max)!.key;
}

const FACT = (methodology: string, createdAt: string, sources: EdgeProvenance["sources"]) =>
  ({
    origin: "record",
    validation: "fact",
    methodology,
    confidence: 1,
    createdAt,
    sources,
  }) as const;

const DERIVED = (methodology: string, createdAt: string, sources: EdgeProvenance["sources"]) =>
  ({
    origin: "derived",
    validation: "fact",
    methodology,
    confidence: 1,
    createdAt,
    sources,
  }) as const;

interface Acc {
  n: number;
  pnl: number;
  wins: number;
  losses: number;
  breakEven: number;
  rSum: number;
  nR: number;
}

/** Jour civil local d'un instant ISO, `undefined` s'il n'est pas lisible. */
function dayOfIso(iso: string): string | undefined {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : localDateOf(d);
}

export { median };

/** Un nom saisi par le trader, normalisé pour servir de clé (espaces, casse). */
function keyOf(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function symbolKey(symbol: string): string {
  return symbol.trim().toUpperCase();
}

/**
 * Le texte nomme-t-il `name` comme un MOT (pas une sous-chaîne) ? Les noms
 * courts (≤ 3 caractères : « ES », « NQ ») ne comptent qu'en capitales — « tu
 * es » n'est pas une mention du E-mini S&P.
 */
export function mentions(text: string, name: string): boolean {
  const n = name.trim();
  if (n.length < 2) return false;
  const short = n.length <= 3;
  const hay = short ? text : fold(text);
  const needle = short ? n : fold(n);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "u").test(hay);
}

export function buildKnowledgeGraph(input: KnowledgeInput): KnowledgeGraph {
  const g = new KnowledgeGraph();
  const now = input.now ?? new Date().toISOString();
  const accs = new Map<string, Acc>();
  const id = KnowledgeGraph.nodeId;

  const accountKey = input.account?.id ?? "main";
  const accountId = g.addNode({
    id: id("account", accountKey),
    kind: "account",
    key: accountKey,
    label: input.account?.name ?? "",
    source: input.account?.id ? { table: "accounts", id: input.account.id } : undefined,
  }).id;

  const hub = (kind: NodeKind, key: string, label = key, extra?: Partial<KnowledgeNode>) =>
    g.addNode({ id: id(kind, key), kind, key, label, ...extra }).id;

  const edge = (
    source: string,
    target: string,
    type: RelationType,
    provenance: EdgeProvenance,
    weight = 1,
  ) => g.addEdge({ source, target, type, provenance, weight });

  /** Jour + mois (et le mois rattaché au compte) : l'ossature de la frise. */
  const dayNode = (day: string): string | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
    const month = day.slice(0, 7);
    const monthId = hub("month", month, month, { date: `${month}-01` });
    edge(monthId, accountId, "part_of", DERIVED("calendar:month", now, []));
    const dayId = hub("day", day, day, { date: day });
    edge(dayId, monthId, "part_of", DERIVED("calendar:month", now, []));
    return dayId;
  };

  const tally = (nodeId: string, t: Trade) => {
    let a = accs.get(nodeId);
    if (!a)
      accs.set(nodeId, (a = { n: 0, pnl: 0, wins: 0, losses: 0, breakEven: 0, rSum: 0, nR: 0 }));
    a.n++;
    a.pnl += t.pnl;
    if (isBreakEven(t)) a.breakEven++;
    else if (t.pnl > 0) a.wins++;
    else a.losses++;
    const r = measuredR(t);
    if (r !== null) {
      a.rSum += r;
      a.nR++;
    }
  };

  // ── Trades ────────────────────────────────────────────────────────────────
  const ordered = [...input.trades].sort(compareChronological);
  for (const t of ordered) {
    const src = [{ table: "trades", id: t.id }];
    const at = t.entryAt ?? `${t.date}T00:00:00`;
    const r = measuredR(t);
    const tradeId = g.addNode({
      id: id("trade", t.id),
      kind: "trade",
      key: t.id,
      label: `${symbolKey(t.symbol) || "?"} ${t.direction}`,
      date: t.date,
      source: src[0],
      data: {
        pnl: t.pnl,
        r,
        risk: hasMeasuredRisk(t) ? t.riskAmount : null,
        // Un import non relu n'a pas de note de setup : son 0 stocké n'en est pas une.
        setupQuality: t.reviewPending || !t.setupQuality ? null : t.setupQuality,
        confidence: t.confidence || null,
        entryTime: t.entryTime || null,
        exitTime: t.exitTime || null,
        strategy: t.strategy || null,
        notes: t.notes ? t.notes.length : 0,
      },
    }).id;
    tally(accountId, t);

    const dayId = dayNode(t.date);
    if (dayId) {
      edge(tradeId, dayId, "occurred_on", FACT("field:trades.trade_date", at, src));
      tally(dayId, t);
      tally(id("month", t.date.slice(0, 7)), t);
    }

    // Un import pas encore relu n'a pas de setup confirmé.
    const strategy = t.reviewPending ? "" : keyOf(t.strategy ?? "");
    if (strategy) {
      const s = hub("strategy", strategy);
      edge(tradeId, s, "uses_setup", FACT("field:trades.strategy", at, src));
      tally(s, t);
    }

    const symbol = symbolKey(t.symbol ?? "");
    if (symbol) {
      const s = hub("symbol", symbol);
      edge(tradeId, s, "on_symbol", FACT("field:trades.symbol", at, src));
      tally(s, t);
    }

    const session = getSessionForTrade(t);
    if (session) {
      const s = hub("session", session);
      edge(tradeId, s, "in_session", DERIVED("domain/quantStats.getSessionForTrade", at, src));
      tally(s, t);
    }

    for (const raw of t.mistakes ?? []) {
      const m = keyOf(raw);
      if (!m) continue;
      const mId = hub("mistake", m);
      edge(tradeId, mId, "has_mistake", FACT("field:trades.mistakes", at, src));
      tally(mId, t);
      const cluster = input.clusterOf?.(m);
      if (cluster) {
        const c = hub("mistake_cluster", cluster);
        edge(mId, c, "classified_as", DERIVED("taxonomy:mistake_clusters", now, []));
        tally(c, t);
      }
    }

    for (const raw of t.confluences ?? []) {
      const c = keyOf(raw);
      if (!c) continue;
      const cId = hub("confluence", c);
      edge(tradeId, cId, "has_confluence", FACT("field:trades.confluences", at, src));
      tally(cId, t);
    }

    for (const path of t.screenshots ?? []) {
      if (!path) continue;
      const shot = g.addNode({
        id: id("screenshot", path),
        kind: "screenshot",
        key: path,
        label: path.split("/").pop() ?? path,
        date: t.date,
        source: { table: "storage.trade-screenshots", id: path },
        data: { owner: "trade", ownerId: t.id },
      }).id;
      edge(tradeId, shot, "has_screenshot", FACT("field:trades.screenshots", at, src));
    }
  }

  // L'enchaînement des trades : seulement quand l'ordre des clôtures est
  // PROUVÉ (même compte, heures établies). Sinon, aucun lien n'est inventé.
  for (let i = 1; i < ordered.length; i++) {
    const prev = verifiedPriorClosedTrade(ordered, i);
    if (!prev) continue;
    const cur = ordered[i];
    edge(id("trade", prev.id), id("trade", cur.id), "followed_by", {
      ...DERIVED(
        "domain/tradeOrder.verifiedPriorClosedTrade",
        cur.entryAt ?? `${cur.date}T00:00:00`,
        [
          { table: "trades", id: prev.id },
          { table: "trades", id: cur.id },
        ],
      ),
      evidence: { previous: isBreakEven(prev) ? "be" : prev.pnl > 0 ? "win" : "loss" },
    });
  }

  // ── Bibliothèque d'erreurs : signatures OBSERVÉES ─────────────────────────
  // Le lien trade → signature est une HYPOTHÈSE d'interprétation : la séquence
  // est un fait (12 minutes après une perte), le mot « revenge » ne l'est pas.
  const signatures = detectSignatures(ordered, input.behavior);
  for (const entry of ERROR_LIBRARY) {
    const list = signatures.get(entry.id);
    if (!list?.length || entry.detection.mode !== "signature") continue;
    const method = entry.detection.method;
    const pId = hub("error_pattern", entry.id, entry.id, {
      data: { family: entry.family, method },
    });
    for (const tradeId of list) {
      const t = ordered.find((x) => x.id === tradeId);
      if (!t) continue;
      edge(id("trade", tradeId), pId, "exhibits", {
        origin: "derived",
        validation: "hypothesis",
        methodology: `signature:${entry.id}:${method}`,
        confidence: 0.7,
        createdAt: t.entryAt ?? `${t.date}T00:00:00`,
        sources: [{ table: "trades", id: tradeId }],
      });
      tally(pId, t);
    }
    // Ce que le trader COCHE pour la même erreur.
    for (const tag of entry.tags)
      edge(pId, id("mistake", tag), "declared_as", DERIVED("library:declared-tag", now, []));
  }

  // ── Bandes de risque ─────────────────────────────────────────────────────
  // Relatives au trader lui-même : « au-dessus de ta médiane », jamais une
  // norme extérieure. Sous MIN_GROUP risques mesurés, la médiane ne dit rien.
  const measured = ordered.filter((t) => hasMeasuredRisk(t));
  const riskMedian =
    measured.length >= MIN_GROUP ? median(measured.map((t) => t.riskAmount)) : null;
  if (riskMedian && riskMedian > 0) {
    for (const t of measured) {
      const ratio = t.riskAmount / riskMedian;
      const band = riskBandOf(ratio);
      const b = hub("risk_band", band, band, { data: { median: riskMedian } });
      edge(id("trade", t.id), b, "in_risk_band", {
        ...DERIVED(`risk/median:n=${measured.length}`, t.entryAt ?? `${t.date}T00:00:00`, [
          { table: "trades", id: t.id },
        ]),
        evidence: { ratio: Math.round(ratio * 100) / 100, median: riskMedian },
      });
      tally(b, t);
    }
  }

  // ── Annonces économiques ─────────────────────────────────────────────────
  // Seules les annonces FORTES sur les devises du trade deviennent des nœuds.
  if (input.events?.length) {
    const clock = input.clock;
    const byDay = new Map<string, NewsEvent[]>();
    const dayOfEvent = clock?.dayOf ?? ((iso: string) => localDateOf(new Date(iso)));
    for (const e of input.events) {
      if (e.impact !== "high") continue;
      const d = dayOfEvent(e.startsAt);
      let list = byDay.get(d);
      if (!list) byDay.set(d, (list = []));
      list.push(e);
    }
    for (const t of ordered) {
      const dayEvents = byDay.get(t.date);
      if (!dayEvents) continue;
      const news = newsForTrade(t, dayEvents, clock);
      for (const item of news.items) {
        const e = item.event;
        const approximate = e.source === APPROXIMATE_SOURCE;
        const eventId = g.addNode({
          id: id("economic_event", e.id),
          kind: "economic_event",
          key: e.id,
          label: `${e.currency} · ${e.title}`,
          date: t.date,
          source: { table: "economic_events", id: e.id },
          data: { time: item.time, currency: e.currency, approximate, actual: e.actual ?? null },
        }).id;
        const day = dayNode(t.date);
        if (day)
          edge(
            eventId,
            day,
            "occurred_on",
            FACT("field:economic_events.starts_at", e.startsAt, []),
          );
        if (item.duringTrade) {
          edge(id("trade", t.id), eventId, "during_event", {
            origin: "derived",
            // Une heure du repli intégré est une règle, pas une publication confirmée.
            validation: approximate ? "hypothesis" : "fact",
            methodology: "domain/tradeNews.newsForTrade:±15min",
            confidence: approximate ? 0.5 : 1,
            createdAt: e.startsAt,
            sources: [
              { table: "trades", id: t.id },
              { table: "economic_events", id: e.id },
            ],
          });
          tally(eventId, t);
        }
      }
    }
  }

  // Les noms que le trader emploie : base des correspondances de texte.
  const named = (kind: NodeKind) =>
    [...g.nodes.values()].filter((n) => n.kind === kind).map((n) => ({ id: n.id, name: n.label }));
  const vocabulary = [...named("strategy"), ...named("mistake"), ...named("symbol")];
  const linkMentions = (
    from: string,
    text: string,
    createdAt: string,
    src: EdgeProvenance["sources"],
  ) => {
    if (!text.trim()) return;
    for (const v of vocabulary) {
      if (v.id === from || !mentions(text, v.name)) continue;
      edge(
        from,
        v.id,
        "mentions",
        {
          origin: "text_match",
          validation: "hypothesis",
          methodology: "exact-word-mention",
          confidence: 0.5,
          createdAt,
          sources: src,
        },
        0.4,
      );
    }
  };

  // ── Setups manqués ───────────────────────────────────────────────────────
  for (const m of input.missed ?? []) {
    const src = [{ table: "missed_opportunities", id: m.id }];
    const at = `${m.date}T00:00:00`;
    const symbol = symbolKey(m.symbol ?? "");
    const missedId = g.addNode({
      id: id("missed", m.id),
      kind: "missed",
      key: m.id,
      label: symbol || "?",
      date: m.date,
      source: src[0],
      data: { estimatedR: Number.isFinite(m.estimatedR) ? m.estimatedR : null, hypothetical: true },
    }).id;
    const day = dayNode(m.date);
    if (day)
      edge(
        missedId,
        day,
        "occurred_on",
        FACT("field:missed_opportunities.opportunity_date", at, src),
      );
    if (symbol)
      edge(
        missedId,
        hub("symbol", symbol),
        "on_symbol",
        FACT("field:missed_opportunities.symbol", at, src),
      );
    for (const path of m.screenshots ?? []) {
      if (!path) continue;
      const shot = g.addNode({
        id: id("screenshot", path),
        kind: "screenshot",
        key: path,
        label: path.split("/").pop() ?? path,
        date: m.date,
        source: { table: "storage.trade-screenshots", id: path },
        data: { owner: "missed", ownerId: m.id },
      }).id;
      edge(
        missedId,
        shot,
        "has_screenshot",
        FACT("field:missed_opportunities.screenshots", at, src),
      );
    }
    // Le même jour, sur le même instrument : ce que le trader a pris À LA PLACE.
    for (const t of ordered) {
      if (t.date !== m.date || symbolKey(t.symbol) !== symbol || !symbol) continue;
      edge(
        missedId,
        id("trade", t.id),
        "same_day_as",
        {
          ...DERIVED("same-date+same-symbol", at, [...src, { table: "trades", id: t.id }]),
        },
        0.6,
      );
    }
    linkMentions(
      missedId,
      [m.reasonNotTaken, m.whatHappened, m.lessonLearned, m.nextTimePlan].join("\n"),
      at,
      src,
    );
  }

  // ── Conversations avec Jarvis ────────────────────────────────────────────
  // Une conversation n'est pas une vérité : elle est reliée à ce qu'elle
  // NOMME (hypothèse), jamais présentée comme une preuve.
  for (const c of input.conversations ?? []) {
    const src = [{ table: "jarvis_conversations", id: c.id }];
    const day = dayOfIso(c.createdAt) ?? "";
    const convId = g.addNode({
      id: id("conversation", c.id),
      kind: "conversation",
      key: c.id,
      label: c.title,
      date: day || undefined,
      source: src[0],
      data: { updatedAt: c.updatedAt },
    }).id;
    const dayId = day ? dayNode(day) : null;
    if (dayId) edge(convId, dayId, "occurred_on", FACT("conversation.createdAt", c.createdAt, src));
    else edge(convId, accountId, "belongs_to", FACT("conversation.owner", c.createdAt, src));
    linkMentions(convId, c.userText, c.updatedAt, src);
  }

  // ── Recherche, expériences, simulations, rapports, propositions ──────────
  for (const r of input.research ?? []) {
    const src = [{ table: "research_notes", id: r.id }];
    const nodeId = g.addNode({
      id: id("research_note", r.id),
      kind: "research_note",
      key: r.id,
      label: r.hypothesis,
      date: dayOfIso(r.createdAt),
      source: src[0],
      data: { dimension: r.dimension, cell: r.cellKey, verdict: r.verdict, archived: r.archived },
    }).id;
    const kind: NodeKind | null =
      r.dimension === "strategy"
        ? "strategy"
        : r.dimension === "symbol"
          ? "symbol"
          : r.dimension === "session"
            ? "session"
            : r.dimension === "account"
              ? "account"
              : null;
    const target = kind ? id(kind, kind === "symbol" ? symbolKey(r.cellKey) : r.cellKey) : null;
    if (
      !target ||
      !edge(nodeId, target, "studies", FACT("field:research_notes.protocol", r.createdAt, src))
    ) {
      edge(nodeId, accountId, "belongs_to", FACT("field:research_notes.user_id", r.createdAt, src));
    }
  }

  for (const x of input.experiments ?? []) {
    const src = [{ table: "progress_experiments", id: x.id }];
    const nodeId = g.addNode({
      id: id("experiment", x.id),
      kind: "experiment",
      key: x.id,
      label: x.id,
      date: x.startDay,
      source: src[0],
      data: { maxLosses: x.maxLosses, targetSessions: x.targetSessions, status: x.status },
    }).id;
    edge(
      nodeId,
      accountId,
      "belongs_to",
      FACT("field:progress_experiments.account_id", x.createdAt, src),
    );
  }

  for (const s of input.simulations ?? []) {
    const src = [
      { table: s.origin === "scenario" ? "simulation_scenarios" : "local:mc-plan", id: s.id },
    ];
    const nodeId = g.addNode({
      id: id("simulation", s.id),
      kind: "simulation",
      key: s.id,
      label: s.name,
      date: dayOfIso(s.updatedAt),
      source: src[0],
      data: {
        risk: s.riskPerTrade,
        winRate: s.winRate,
        avgWinR: s.avgWinR,
        avgLossR: s.avgLossR,
        seed: s.seed,
        origin: s.origin,
      },
    }).id;
    edge(nodeId, accountId, "simulates", FACT(`simulation:${s.origin}`, s.updatedAt, src));
  }

  for (const r of input.reports ?? []) {
    if (!/^\d{4}-\d{2}$/.test(r.month)) continue;
    const src = [{ table: "monthly_reports", id: r.id }];
    const nodeId = g.addNode({
      id: id("report", r.month),
      kind: "report",
      key: r.month,
      label: r.month,
      date: `${r.month}-01`,
      source: src[0],
    }).id;
    const monthId = hub("month", r.month, r.month, { date: `${r.month}-01` });
    edge(monthId, accountId, "part_of", DERIVED("calendar:month", now, []));
    edge(nodeId, monthId, "covers", FACT("field:monthly_reports.month", r.createdAt, src));
  }

  for (const p of input.proposals ?? []) {
    const src = [{ table: "agent_proposals", id: p.id }];
    const nodeId = g.addNode({
      id: id("proposal", p.id),
      kind: "proposal",
      key: p.id,
      label: p.text,
      date: dayOfIso(p.createdAt),
      source: src[0],
      data: { action: p.actionType, n: p.n, pattern: p.patternId },
    }).id;
    edge(nodeId, accountId, "belongs_to", FACT("field:agent_proposals.user_id", p.createdAt, src));
    linkMentions(nodeId, p.text, p.createdAt, src);
  }

  // ── Erreurs cochées ensemble ─────────────────────────────────────────────
  // Le nombre de trades où deux erreurs coexistent est un TOTAL, vrai à toute
  // taille ; le « lift » est un TAUX et n'est rendu qu'à partir de MIN_GROUP.
  const pairCounts = new Map<
    string,
    { a: string; b: string; together: number; trades: string[] }
  >();
  const single = new Map<string, number>();
  for (const t of ordered) {
    const ms = [...new Set((t.mistakes ?? []).map(keyOf).filter(Boolean))].sort();
    for (const m of ms) single.set(m, (single.get(m) ?? 0) + 1);
    for (let i = 0; i < ms.length; i++)
      for (let j = i + 1; j < ms.length; j++) {
        const k = `${ms[i]}\u0000${ms[j]}`;
        let p = pairCounts.get(k);
        if (!p) pairCounts.set(k, (p = { a: ms[i], b: ms[j], together: 0, trades: [] }));
        p.together++;
        p.trades.push(t.id);
      }
  }
  const total = ordered.length;
  for (const p of pairCounts.values()) {
    if (p.together < 2) continue;
    const ca = single.get(p.a) ?? 0;
    const cb = single.get(p.b) ?? 0;
    const enough = p.together >= MIN_GROUP;
    const lift = enough && ca && cb ? (p.together * total) / (ca * cb) : null;
    edge(
      id("mistake", p.a),
      id("mistake", p.b),
      "co_occurs_with",
      {
        origin: "statistical",
        validation: enough ? "observed_association" : "fact",
        methodology: `mistake-co-occurrence:min=${MIN_GROUP}`,
        confidence: 1,
        createdAt: now,
        sources: p.trades.slice(0, 50).map((tid) => ({ table: "trades", id: tid })),
        evidence: {
          together: p.together,
          n_a: ca,
          n_b: cb,
          lift: lift === null ? null : Math.round(lift * 100) / 100,
        },
      },
      Math.min(1, p.together / Math.max(1, Math.min(ca, cb))),
    );
  }

  // ── Agrégats des moyeux ──────────────────────────────────────────────────
  for (const [nodeId, a] of accs) {
    const node = g.nodes.get(nodeId);
    if (!node) continue;
    node.metrics = toMetrics(a);
  }
  return g;
}

/**
 * Taux et moyennes seulement au-dessus de `MIN_BUCKET_SAMPLE` : sous ce seuil
 * le module rend `null`, et l'écran n'a rien à décider. Les totaux restent.
 */
function toMetrics(a: Acc): NodeMetrics {
  const decided = a.wins + a.losses;
  return {
    n: a.n,
    pnl: Math.round(a.pnl * 100) / 100,
    wins: a.wins,
    losses: a.losses,
    breakEven: a.breakEven,
    avgR: a.nR >= MIN_BUCKET_SAMPLE ? a.rSum / a.nR : null,
    nR: a.nR,
    winRate: a.n >= MIN_BUCKET_SAMPLE && decided > 0 ? a.wins / decided : null,
  };
}
