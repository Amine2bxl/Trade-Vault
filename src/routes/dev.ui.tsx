import { lazy, Suspense, useState } from "react";
import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { ThemeProvider } from "@/app/contexts/ThemeContext";
import { AuthProvider } from "@/app/contexts/AuthContext";
import { AccountProvider } from "@/app/contexts/AccountContext";
import { LanguageProvider } from "@/app/i18n/LanguageContext";
import { ToastProvider } from "@/app/contexts/ToastContext";
import { ConfirmProvider } from "@/app/contexts/ConfirmContext";
import { PageActionsProvider } from "@/app/contexts/PageActionsContext";
import { previewTrades } from "@/app/utils/previewTrades";
import { computeStats } from "@/app/utils/tradeCalcs";
import { computeQuantStats } from "@/app/utils/quantStats";
import type { Trade } from "@/app/types";

/**
 * BANC D'ESSAI VISUEL — `/dev/ui`, EN DÉVELOPPEMENT UNIQUEMENT.
 *
 * Les écrans du produit vivent derrière l'authentification : les vérifier
 * demandait de se connecter avec un vrai compte, ce qui n'est ni reproductible
 * ni possible en revue. Cette page monte la MÊME pile de fournisseurs que
 * `App` (thème, langue, comptes, toasts, confirmation, en-tête de page) et
 * rend un écran choisi, nourri par les trades de démonstration déjà utilisés
 * par le mur d'aperçu — donc sans jeu de données de plus à maintenir.
 *
 * Elle ne rend RIEN hors développement (`import.meta.env.DEV`), et tous les
 * écrans sont importés en différé : le bundle de production ne gagne que cette
 * poignée de lignes.
 */

const MonteCarlo = lazy(() => import("@/app/pages/MonteCarlo"));
const Analytics = lazy(() => import("@/app/pages/Analytics"));
const Mistakes = lazy(() => import("@/app/pages/Mistakes"));
const Goals = lazy(() => import("@/app/pages/Goals"));
const TradingPlan = lazy(() => import("@/app/pages/TradingPlan"));
const Subscription = lazy(() => import("@/app/pages/Subscription"));
const Inbox = lazy(() => import("@/app/pages/Inbox"));
const GoalsPlan = lazy(() =>
  import("@/app/pages/goals/views").then((m) => ({ default: m.PlanView })),
);

const IDS = [
  "montecarlo",
  "analytics",
  "mistakes",
  "goals",
  "goalsplan",
  "tradingplan",
  "subscription",
  "inbox",
] as const;
type EcranId = (typeof IDS)[number];

export const Route = createFileRoute("/dev/ui")({
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
  component: () => <ClientOnly fallback={null}>{<DevUiPage />}</ClientOnly>,
});

function DevUiPage() {
  /* L'écran choisi survit au rechargement à chaud : sans ça, chaque
     modification de style ramenait le banc sur le premier écran, et il fallait
     re-cliquer avant chaque capture. */
  const [ecran, setEcran] = useState<EcranId>(() => {
    try {
      const v = localStorage.getItem("tv.devUi");
      return (IDS as readonly string[]).includes(v ?? "") ? (v as EcranId) : "montecarlo";
    } catch {
      return "montecarlo";
    }
  });

  if (!import.meta.env.DEV) return null;

  const trades = previewTrades();

  return (
    <ThemeProvider>
      <AuthProvider>
        <AccountProvider>
          <LanguageProvider>
            <ToastProvider>
              <ConfirmProvider>
                <PageActionsProvider setActions={() => {}}>
                  <div className="min-h-screen bg-[var(--tv-bg)]">
                    <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--tv-border)] px-3 py-2">
                      {IDS.map((id) => (
                        <button
                          key={id}
                          onClick={() => {
                            setEcran(id);
                            try {
                              localStorage.setItem("tv.devUi", id);
                            } catch {
                              /* mode privé : le banc marche quand même */
                            }
                          }}
                          className={`tv-subnav-item ${id === ecran ? "tv-subnav-item-active" : ""}`}
                        >
                          {id}
                        </button>
                      ))}
                    </div>
                    <Suspense fallback={<div className="p-6 text-sm text-slate-500">…</div>}>
                      {ecran === "montecarlo" && <MonteCarlo trades={trades} />}
                      {ecran === "analytics" && <Analytics trades={trades} />}
                      {ecran === "mistakes" && <Mistakes trades={trades} />}
                      {ecran === "goals" && <Goals trades={trades} />}
                      {ecran === "goalsplan" && <PlanHarness trades={trades} />}
                      {ecran === "tradingplan" && <TradingPlan setPage={() => {}} />}
                      {ecran === "subscription" && <Subscription />}
                      {ecran === "inbox" && <Inbox />}
                    </Suspense>
                  </div>
                </PageActionsProvider>
              </ConfirmProvider>
            </ToastProvider>
          </LanguageProvider>
        </AccountProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

/**
 * La vue « plan généré » de Goals demande un plan enregistré et un contexte de
 * mesure : sans utilisateur, la page n'affiche que le sélecteur. Ce montage
 * fabrique les deux à partir des trades de démonstration, pour que la moitié
 * la plus lourde de l'écran soit vérifiable elle aussi.
 */
function PlanHarness({ trades }: { trades: Trade[] }) {
  const stats = computeStats(trades);
  const ctx = {
    stats,
    quant: computeQuantStats(trades, 10000),
    startingBalance: 10000,
    journalRate: 0.6,
  };
  const plan = {
    goals: [
      { id: "g1", kind: "capital" as const, startValue: 10000, targetValue: 20000 },
      { id: "g2", kind: "win_rate" as const, startValue: 39, targetValue: 55 },
    ],
    startedAt: "2026-05-01",
    horizonMonths: 6,
    tasksDone: {},
  };
  return (
    <div className="mx-auto max-w-[1000px] p-4 md:p-5">
      <GoalsPlan
        plan={plan}
        ctx={ctx}
        fr={false}
        lang="en"
        busy={false}
        onDelete={() => {}}
        onToggleTask={() => {}}
        onManualValue={() => {}}
        forecast={null}
      />
    </div>
  );
}
