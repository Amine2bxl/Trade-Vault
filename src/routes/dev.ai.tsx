import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { aiRuntimeStatus } from "@/modules/ai/runtime/status";
import { aiRuntimeProbe } from "@/modules/ai/runtime/probe";
import { aiTelemetryStats } from "@/modules/ai/runtime/telemetry-stats";

/**
 * Page de diagnostic interne — réservée aux administrateurs.
 *
 * CE QUI PROTÈGE CETTE PAGE N'EST PAS CETTE PAGE. Les trois server functions
 * qu'elle appelle exigent chacune, côté serveur, une adresse listée dans
 * `ADMIN_EMAILS` (`backend/require-admin.ts`). Un visiteur qui ouvre l'URL
 * n'obtient donc rien, et un attaquant qui appelle directement les server
 * functions n'obtient rien non plus — c'était le vrai trou : la page était
 * seulement « non liée » et `noindex`, ce qui ne protège rien.
 *
 * L'écran ci-dessous ne fait que REFLÉTER ce refus proprement, au lieu
 * d'afficher une pile d'erreurs techniques.
 */

export const Route = createFileRoute("/dev/ai")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex,nofollow" }],
  }),
  component: DevAiPage,
});

/** Le refus renvoyé par `requireAdminAccess`, reconnu à son préfixe. Les
 *  server functions sérialisent l'erreur : on n'a que son message. */
function isForbidden(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  return message.includes("FORBIDDEN") || message.includes("Unauthorized");
}

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
  const [forbidden, setForbidden] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ProbeResult>>({});
  // Télémétrie PERSISTANTE (ai_agent_runs), par opposition aux compteurs
  // runtime ci-dessous qui sont en mémoire et repartent à zéro à chaque cold
  // start serverless. C'est la seule source qui survit aux redéploiements.
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);

  const load = () => {
    aiRuntimeStatus()
      .then((s) => {
        setStatus(s);
        setForbidden(false);
      })
      .catch((e) => {
        if (isForbidden(e)) {
          setForbidden(true);
          return;
        }
        setError(e instanceof Error ? e.message : String(e));
      });
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

  // Refus du serveur : un écran net, aucune donnée, aucun bouton d'action. On
  // ne dit pas « connecte-toi avec la bonne adresse » — cette page ne doit pas
  // renseigner sur l'existence d'une liste d'administrateurs.
  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#05070a] px-6 text-center">
        <div>
          <p className="text-sm font-semibold text-slate-300">Page indisponible</p>
          <p className="mt-1.5 text-xs text-slate-500">
            Ce diagnostic n'est pas accessible depuis ce compte.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-slate-200"
      style={{
        background: "var(--tv-bg)",
      }}
    >
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-1">
          <span className="grid h-9 w-9 place-items-center rounded-xl tv-accent-fill font-bold text-sm">
            J
          </span>
          <div className="flex-1">
            <h1 className="text-sm font-bold text-white">AI Runtime — Diagnostic</h1>
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
            <h2 className="tv-label mt-8 text-slate-500">
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
                        className={`tv-figure text-lg ${m.warn ? "text-amber-400" : "text-white"}`}
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
                      <b className="tv-figure text-slate-200">
                        {telemetry.totalInputTokens.toLocaleString("fr-FR")}
                      </b>
                    </span>
                    <span>
                      out{" "}
                      <b className="tv-figure text-slate-200">
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
                        <span className="tv-figure text-slate-500 shrink-0">{m.runs} appels</span>
                        <span className="tv-figure text-slate-400 shrink-0">
                          {m.medianMs} / {m.p95Ms} ms
                        </span>
                        <span className="tv-figure text-slate-500 shrink-0 hidden md:inline">
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
            <h2 className="tv-label mt-8 text-slate-500">Providers configurés</h2>
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
                        (p.state === "closed" ? "bg-emerald-400" : "bg-amber-400")
                      }
                    />
                    <span className="flex-1 font-mono text-sm font-semibold text-white">
                      {p.id}
                    </span>
                    <span className="text-xs text-slate-500">
                      {CIRCUIT_LABEL[p.state] ?? p.state}
                      {p.cooldownMsLeft > 0 && ` · ${(p.cooldownMsLeft / 1000).toFixed(0)}s`}
                    </span>
                    <span className="tv-figure text-[11px] text-slate-600">
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
            <h2 className="tv-label mt-8 text-slate-500">Non configurés (facultatif)</h2>
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
            <h2 className="tv-label mt-8 text-slate-500">Runtime</h2>
            <div className="mt-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <span className="text-slate-500">Requêtes</span>
              <span className="tv-figure text-white">{status.runtime.requests}</span>
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
