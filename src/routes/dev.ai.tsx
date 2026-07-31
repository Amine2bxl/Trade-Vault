import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { aiRuntimeStatus } from "@/modules/ai/runtime/status";

/**
 * Page de diagnostic interne — réservée au développement, jamais liée depuis
 * l'app. Affiche l'état des providers IA, les métriques runtime et la PRÉSENCE
 * des clés (jamais leur contenu). Aucun secret exposé.
 */

export const Route = createFileRoute("/dev/ai")({
  component: DevAiPage,
});

type Status = Awaited<ReturnType<typeof aiRuntimeStatus>>;

const CIRCUIT_LABEL: Record<string, string> = {
  closed: "closed",
  open: "open",
  half_open: "half-open",
};

function DevAiPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    aiRuntimeStatus()
      .then((s) => {
        if (active) setStatus(s);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      active = false;
    };
  }, []);

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
          <div>
            <h1 className="text-lg font-bold text-white">AI Runtime — Diagnostic</h1>
            <p className="text-xs text-slate-500">Réservé au développement · aucune clé exposée</p>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            Impossible de charger le diagnostic : {error}
          </div>
        )}

        {status && (
          <>
            {/* Providers */}
            <h2 className="mt-8 text-[11px] uppercase tracking-widest text-slate-500 font-bold">
              Providers
            </h2>
            <div className="mt-2 space-y-2">
              {status.providers.map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 flex items-center gap-3"
                >
                  <span
                    className={
                      "h-2 w-2 rounded-full " +
                      (!p.configured
                        ? "bg-slate-600"
                        : p.state === "closed"
                          ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,.6)]"
                          : "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,.6)]")
                    }
                  />
                  <span className="flex-1 font-mono text-sm font-semibold text-white">{p.id}</span>
                  <span className="text-xs text-slate-500">
                    {!p.configured ? "not configured" : (CIRCUIT_LABEL[p.state] ?? p.state)}
                  </span>
                  {p.cooldownMsLeft > 0 && (
                    <span className="text-xs text-amber-400 tabular-nums">
                      cooldown {(p.cooldownMsLeft / 1000).toFixed(0)}s
                    </span>
                  )}
                  <span className="text-[11px] text-slate-600 tabular-nums">
                    {p.metric.count} req · {(p.metric.avgMs / 1000).toFixed(2)}s · {p.failures} fail
                  </span>
                </div>
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

            {/* Configuration */}
            <h2 className="mt-8 text-[11px] uppercase tracking-widest text-slate-500 font-bold">
              Configuration
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {status.providers.map((p) => (
                <span
                  key={p.id}
                  className="rounded-lg border border-white/[0.08] px-2.5 py-1 text-xs font-mono"
                >
                  {p.configured ? "✅" : "❌"} {p.id.toUpperCase()}_API_KEY
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
