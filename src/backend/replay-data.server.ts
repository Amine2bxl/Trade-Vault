/**
 * Fournisseurs de données historiques — la vraie histoire du marché.
 *
 * SERVER-ONLY, et c'est le point important : une clé Databento ou Polygon
 * facture à l'usage. La poser en `VITE_*` la livrerait dans le bundle, donc à
 * quiconque ouvre l'onglet réseau — la facture serait pour le propriétaire du
 * compte. Les clés restent ici et ne traversent jamais la frontière.
 *
 * Le terminal continue de fonctionner sans aucune clé : quand rien n'est
 * configuré, ces fonctions rendent une liste vide et le moteur retombe sur le
 * générateur déterministe. Brancher un fournisseur n'est donc pas un
 * prérequis, c'est une amélioration.
 *
 * ⚠️ Les formes de réponse ci-dessous suivent la documentation publique des
 * deux services ; elles n'ont pas pu être confrontées à un compte réel faute
 * de clé. La première connexion mérite d'être regardée de près.
 */

/** Une bougie 1m, dans la forme que le moteur de rejeu consomme. */
export interface RemoteBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface RemoteBarsResult {
  bars: RemoteBar[];
  /** Le fournisseur ayant répondu, `null` si aucun n'est configuré. */
  provider: string | null;
  /** Message d'échec, pour que l'UI puisse être honnête plutôt que muette. */
  error?: string;
}

/**
 * La fenêtre UTC d'un jour de cotation CME.
 *
 * Le jour de cotation court de 18 h (heure de New York) la veille à 17 h le
 * jour même. On la calcule en UTC pour l'interroger, mais les bornes sont
 * bien celles de la bourse — pas celles d'un jour civil.
 */
export function tradingWindowUtc(date: string): { start: string; end: string } {
  const nyOffsetAt = (ms: number): number => {
    const f = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const p = f.formatToParts(new Date(ms));
    const g = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
    let hh = g("hour");
    if (hh === 24) hh = 0;
    return Date.UTC(g("year"), g("month") - 1, g("day"), hh, g("minute"), g("second")) - ms;
  };
  const nyEpoch = (y: number, mo: number, d: number, hh: number): number => {
    let guess = Date.UTC(y, mo - 1, d, 12) - 5 * 3600_000;
    for (let i = 0; i < 4; i++) {
      const next = Date.UTC(y, mo - 1, d, hh) - nyOffsetAt(guess);
      if (next === guess) break;
      guess = next;
    }
    return guess;
  };
  const [y, mo, d] = date.split("-").map(Number);
  const endMs = nyEpoch(y, mo, d, 17);
  const startMs = nyEpoch(y, mo, d, 18) - 24 * 3600_000;
  return { start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() };
}

// ── Databento ───────────────────────────────────────────────────────────────
// Le choix pertinent pour le NQ : contrat CME, donc données GLBX.MDP3. Le
// symbole continu `NQ.c.0` suit le contrat de référence sans qu'on ait à gérer
// les roulements d'échéance à la main.

/** Les prix Databento sont des entiers en virgule fixe, au milliardième. */
const DBN_PRICE_SCALE = 1e-9;

export async function fetchDatabentoBars(date: string, symbol: string): Promise<RemoteBarsResult> {
  const key = process.env.DATABENTO_API_KEY;
  if (!key) return { bars: [], provider: null };

  const { start, end } = tradingWindowUtc(date);
  const params = new URLSearchParams({
    dataset: "GLBX.MDP3",
    symbols: `${symbol}.c.0`,
    stype_in: "continuous",
    schema: "ohlcv-1m",
    encoding: "json",
    start,
    end,
  });

  try {
    const res = await fetch(`https://hist.databento.com/v0/timeseries.get_range?${params}`, {
      method: "GET",
      // Authentification HTTP Basic : la clé tient lieu d'identifiant, le mot
      // de passe reste vide — c'est la convention du service.
      headers: { Authorization: `Basic ${btoa(`${key}:`)}` },
    });
    if (!res.ok) {
      return { bars: [], provider: "databento", error: `HTTP ${res.status}` };
    }
    // La réponse est du JSON ligne à ligne, pas un tableau : une journée de 1m
    // pèse peu, mais le format reste celui d'un flux.
    const text = await res.text();
    const bars: RemoteBar[] = [];
    for (const line of text.split("\n")) {
      const raw = line.trim();
      if (!raw) continue;
      const r = JSON.parse(raw) as {
        hd?: { ts_event?: string | number };
        ts_event?: string | number;
        open: string | number;
        high: string | number;
        low: string | number;
        close: string | number;
        volume: string | number;
      };
      const tsNs = Number(r.hd?.ts_event ?? r.ts_event ?? 0);
      if (!Number.isFinite(tsNs) || tsNs <= 0) continue;
      bars.push({
        // Databento horodate à la nanoseconde ; le moteur compte en ms.
        time: Math.floor(tsNs / 1e6),
        open: Number(r.open) * DBN_PRICE_SCALE,
        high: Number(r.high) * DBN_PRICE_SCALE,
        low: Number(r.low) * DBN_PRICE_SCALE,
        close: Number(r.close) * DBN_PRICE_SCALE,
        volume: Number(r.volume) || 0,
      });
    }
    return { bars, provider: "databento" };
  } catch (e) {
    return { bars: [], provider: "databento", error: String(e) };
  }
}

// ── Polygon ─────────────────────────────────────────────────────────────────
// Second choix : sa couverture futures est plus récente que celle de
// Databento. Gardé parce que le registre ne coûte rien à étendre, et qu'un
// utilisateur déjà abonné n'aura pas à en changer.

export async function fetchPolygonBars(date: string, symbol: string): Promise<RemoteBarsResult> {
  const key = process.env.POLYGON_API_KEY;
  if (!key) return { bars: [], provider: null };

  const { start, end } = tradingWindowUtc(date);
  const ticker = `I:${symbol}`;
  const url =
    `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}` +
    `/range/1/minute/${Date.parse(start)}/${Date.parse(end)}` +
    `?adjusted=true&sort=asc&limit=50000&apiKey=${encodeURIComponent(key)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return { bars: [], provider: "polygon", error: `HTTP ${res.status}` };
    const json = (await res.json()) as {
      results?: { t: number; o: number; h: number; l: number; c: number; v: number }[];
    };
    const bars = (json.results ?? []).map((r) => ({
      time: r.t,
      open: r.o,
      high: r.h,
      low: r.l,
      close: r.c,
      volume: r.v ?? 0,
    }));
    return { bars, provider: "polygon" };
  } catch (e) {
    return { bars: [], provider: "polygon", error: String(e) };
  }
}

/**
 * Le premier fournisseur configuré répond.
 *
 * Aucun n'est configuré → `provider: null`, liste vide, et l'appelant retombe
 * sur le générateur. C'est ce qui permet au terminal de tourner sans compte.
 */
export async function fetchHistoricalBars(date: string, symbol: string): Promise<RemoteBarsResult> {
  if (process.env.DATABENTO_API_KEY) return fetchDatabentoBars(date, symbol);
  if (process.env.POLYGON_API_KEY) return fetchPolygonBars(date, symbol);
  return { bars: [], provider: null };
}
