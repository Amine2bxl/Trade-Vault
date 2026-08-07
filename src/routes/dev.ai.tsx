import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { aiRuntimeStatus } from "@/modules/ai/runtime/status";
import { aiRuntimeProbe } from "@/modules/ai/runtime/probe";
import { aiTelemetryStats } from "@/modules/ai/runtime/telemetry-stats";

/**
 * Page de diagnostic interne — réservée au développement, jamais liée depuis
 * l'app. Affiche l'état des providers IA (avec bouton « Tester » par clé),
 * les métriques runtime et la PRÉSENCE des clés (jamais leur contenu).
 */

export const Route = createFileRoute("/dev/ai")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex,nofollow" }],
  }),
  component: DevAiPage,
});

type Status = Awaited<ReturnType<typeof aiRuntimeStatus>>;
type ProbeResult = Awaited<ReturnType<typeof aiRuntimeProbe>>;
type Telemetry = Awaited<ReturnType<typeof aiTelemetryStats>>;

const CIRCUIT_LABEL: Record<string, string> = {
  closed: "fermé",
  open: "ouvert",
  half_open: "half-open",
};

function DevAiPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ProbeResult>>({});
  // Télémétrie PERSISTANTE (ai_agent_runs), par opposition aux compteurs
  // runtime ci-dessous qui sont en mémoire et repartent à zéro à chaque cold
  // start serverless. C'est la seule source qui survit aux redéploiements.
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);

  const load = () => {
    aiRuntimeStatus()
      .then(setStatus)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    // Best-effort : un diagnostic partiel vaut mieux qu'une page en erreur.
    aiTelemetryStats()
      .then(setTelemetry)
      .catch(() => setTelemetry(null));
  };
  useEffect(() => {
    load();
  }, []);

  const test = async (provider: string) => {
    setTesting(provider);
    try {
      const r = await aiRuntimeProbe({ data: { provider } });
      setResults((prev) => ({ ...prev, [provider]: r }));
    } catch (e) {
      setResults((prev) => ({
        ...prev,
        [provider]: {
          ok: false,
          provider,
          error: {
            type: "unknown",
            technicalMessage: e instanceof Error ? e.message : String(e),
          },
        },
      }));
    } finally {
      setTesting(null);
    }
  };

  return (
    <div
      className="min-h-screen text-slate-200"
      style={{
        background:
          "radial-gradient(1000px 700px at 80% -10%, rgba(34,211,238,.08), transparent 60%), linear-gradient(160deg,#05070a 0%,#0a0f1e 55%,#05080c 100%)",
      }}
    >
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-1">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 text-white font-bold text-sm">
            J
          </span>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">AI Runtime — Diagnostic</h1>
            <p className="text-xs text-slate-500">
              Réservé au développement · aucune clé exposée · bouton « Tester » = mini appel IA réel
            </p>
          </div>
          <button
            onClick={load}
            className="rounded-lg border border-white/[0.1] px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.05]"
          >
            Actualiser
          </button>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            Impossible de charger le diagnostic : {error}
          </div>
        )}

        {telemetry && (
          <>
            <h2 className="mt-8 text-[11px] uppercase tracking-widest text-slate-500 font-bold">
              Télémétrie · {telemetry.days} derniers jours · compte connecté
            </h2>
            {!telemetry.available ? (
              <div className="mt-2 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
                Table <code>ai_agent_runs</code> introuvable — migration non appliquée. Aucun
                chiffre n'est affiché plutôt que des zéros trompeurs.
              </div>
            ) : telemetry.total === 0 ? (
              <div className="mt-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-xs text-slate-500">
                Aucun appel enregistré sur la période.
              </div>
            ) : (
              <>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { label: "Appels", value: String(telemetry.total) },
                    { label: "Latence médiane", value: `${telemetry.medianMs} ms` },
                    { label: "p95", value: `${telemetry.p95Ms} ms` },
                    {
                      label: "Dégradés",
                      value: `${telemetry.degradedPct}%`,
                      warn: telemetry.degradedPct > 10,
                    },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5"
                    >
                      <div className="text-[11px] text-slate-500">{m.label}</div>
                      <div
                        className={`text-lg font-bold tabular-nums ${m.warn ? "text-amber-400" : "text-white"}`}
                      >
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-xs text-slate-400">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      OK <b className="text-emerald-400">{telemetry.ok}</b>
                    </span>
                    <span>
                      Repli <b className="text-amber-400">{telemetry.fallbacks}</b>
                    </span>
                    <span>
                      Erreurs <b className="text-red-400">{telemetry.errors}</b>
                    </span>
                    <span>
                      Tokens in{" "}
                      <b className="text-slate-200 tabular-nums">
                        {telemetry.totalInputTokens.toLocaleString("fr-FR")}
                      </b>
                    </span>
                    <span>
                      out{" "}
                      <b className="text-slate-200 tabular-nums">
                        {telemetry.totalOutputTokens.toLocaleString("fr-FR")}
                      </b>
                    </span>
                  </div>
                </div>
                {telemetry.byModel.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {telemetry.byModel.map((m) => (
                      <div
                        key={m.model}
                        className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 flex items-center gap-3 text-xs"
                      >
                        <span className="font-semibold text-slate-200 flex-1 truncate">
                          {m.model}
                        </span>
                        <span className="text-slate-500 tabular-nums shrink-0">
                          {m.runs} appels
                        </span>
                        <span className="text-slate-400 tabular-nums shrink-0">
                          {m.medianMs} / {m.p95Ms} ms
                        </span>
                        <span className="text-slate-500 tabular-nums shrink-0 hidden md:inline">
                          {m.avgInputTokens}→{m.avgOutputTokens} tk
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {status && (
          <>
            {/* Providers configurés */}
            <h2 className="mt-8 text-[11px] uppercase tracking-widest text-slate-500 font-bold">
              Providers configurés
            </h2>
            <div className="mt-2 space-y-2">
              {status.providers
                .filter((p) => p.configured)
                .map((p) => (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 flex items-center gap-3"
                  >
                    <span
                      className={
                        "h-2 w-2 rounded-full " +
                        (p.state === "closed"
                          ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,.6)]"
                          : "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,.6)]")
                      }
                    />
                    <span className="flex-1 font-mono text-sm font-semibold text-white">
                      {p.id}
                    </span>
                    <span className="text-xs text-slate-500">
                      {CIRCUIT_LABEL[p.state] ?? p.state}
                      {p.cooldownMsLeft > 0 && ` · ${(p.cooldownMsLeft / 1000).toFixed(0)}s`}
                    </span>
                    <span className="text-[11px] text-slate-600 tabular-nums">
                      {p.metric.count} req · {(p.metric.avgMs / 1000).toFixed(2)}s
                    </span>
                    <button
                      onClick={() => test(p.id)}
                      disabled={testing !== null}
                      className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-50"
                    >
                      {testing === p.id ? "Test…" : "Tester"}
                    </button>
                  </div>
                ))}
            </div>

            {/* Résultats de test */}
            {Object.entries(results).map(([id, r]) => (
              <div
                key={id}
                className={
                  "mt-2 rounded-2xl border px-4 py-3 text-sm " +
                  (r.ok
                    ? "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-200"
                    : "border-red-500/25 bg-red-500/[0.06] text-red-300")
                }
              >
                {r.ok ? (
                  <>
                    ✅ {id} répond — {r.model} · {(r.latencyMs / 1000).toFixed(2)}s · « {r.text} »
                  </>
                ) : (
                  <>
                    ❌ {id} : {r.error?.type} — {r.error?.technicalMessage}
                  </>
                )}
              </div>
            ))}

            {/* Non configurés (facultatif) */}
            <h2 className="mt-8 text-[11px] uppercase tracking-widest text-slate-500 font-bold">
              Non configurés (facultatif)
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {status.providers
                .filter((p) => !p.configured)
                .map((p) => (
                  <span
                    key={p.id}
                    className="rounded-lg border border-white/[0.08] px-2.5 py-1 text-xs font-mono text-slate-500"
                  >
                    ❌ {p.id}
                  </span>
                ))}
            </div>

            {/* Runtime */}
            <h2 className="mt-8 text-[11px] uppercase tracking-widest text-slate-500 font-bold">
              Runtime
            </h2>
            <div className="mt-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <span className="text-slate-500">Requêtes</span>
              <span className="text-white tabular-nums">{status.runtime.requests}</span>
              <span className="text-slate-500">Dernier provider utilisé</span>
              <span className="text-white">{status.runtime.lastUsedProvider ?? "—"}</span>
              <span className="text-slate-500">Dernier fallback</span>
              <span className="text-white">{status.runtime.lastFallbackReason ?? "—"}</span>
              <span className="text-slate-500">Dernière erreur</span>
              <span className="text-white">{status.runtime.lastError ?? "—"}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
