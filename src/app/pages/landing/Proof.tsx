import { Check, Link2, ShieldAlert } from "lucide-react";
import { eur, MONTHLY_EUR } from "../../utils/pricing";
import { useLandingT, type LandingKey } from "./i18n";
import { ShotOuVisuel } from "./ProductShot";

/**
 * LES TROIS SECTIONS QUI MANQUAIENT À LA VITRINE.
 *
 * ── CE QU'ELLES RÈGLENT ─────────────────────────────────────────────────────
 *
 * `docs/product/PRODUCT.md` §4 ouvre un chantier explicite : « la landing parle
 * encore à tous ; resserrer le message sur prop-firm / discipline est un levier
 * de conversion ». La page vendait un JOURNAL — le seul marché où TradeVault
 * arrive derrière Tradezella, TraderSync et Edgewonk, et où sa seule
 * différence tient dans un logo.
 *
 * Elle vend maintenant les trois choses que `docs/POSITIONNEMENT.md` §6 liste
 * comme prouvables, et qu'aucun concurrent ne peut reprendre sans refaire son
 * architecture :
 *
 *   1. `SectionPreuve`  — Claim → Evidence. Chaque affirmation de Jarvis porte
 *      ses chiffres, sa période, son échantillon. Un journal peut ajouter une
 *      IA en une semaine ; il ne peut pas lui interdire d'halluciner sans
 *      moteurs déterministes en amont (règle `ANTI_HALLUCINATION`).
 *   2. `SectionEdgeScore` — un score de comportement dont le P&L est
 *      VOLONTAIREMENT absent. C'est la philosophie du produit — la discipline
 *      avant le profit — dite en un chiffre.
 *   3. `AncrageDePrix` — on cesse de se comparer aux journaux à 25 €/mois pour
 *      se comparer au coût que la cible PAIE DÉJÀ : le challenge qu'elle
 *      repasse.
 *
 * ── LES CHIFFRES AFFICHÉS ───────────────────────────────────────────────────
 *
 * Ce sont des ILLUSTRATIONS d'interface, pas des résultats de client. La
 * mention `illustration` les accompagne partout où elles apparaissent, et la
 * section Edge Score passe par `ShotOuVisuel` : le jour où `edge-score.png`
 * est déposé dans `src/assets/product/`, le dessin s'efface de lui-même.
 */

/* ─────────────────────── L'ÉTIQUETTE D'ILLUSTRATION ─────────────────────── */
/**
 * Un visiteur ne distingue pas un dessin soigné d'une capture d'écran. Tant
 * qu'on dessine le produit, on le dit — c'est la contrepartie honnête du
 * « lead every section with a product screenshot » de `DESIGN.md`.
 */
function Illustration() {
  const { t } = useLandingT();
  return <p className="tv-label mt-3 text-center text-slate-600">{t("hero.illustration")}</p>;
}

/* ─────────────────────────── CLAIM → EVIDENCE ─────────────────────────── */

const PREUVE_LIGNES: { l: LandingKey; v: string; fort?: boolean }[] = [
  { l: "evidence.r1.l", v: "1.0%" },
  { l: "evidence.r2.l", v: "1.8%", fort: true },
  { l: "evidence.r3.l", v: "" },
  { l: "evidence.r4.l", v: "" },
];

const PREUVE_POINTS: LandingKey[] = ["evidence.b1", "evidence.b2", "evidence.b3"];

export function SectionPreuve() {
  const { t } = useLandingT();

  /* Les deux dernières lignes portent une valeur TRADUITE (« 12 trades »,
     « 30 derniers jours ») ; les deux premières un pourcentage, qui ne se
     traduit pas. D'où la table ci-dessus et cette résolution ici, plutôt que
     quatre clés de valeur dont deux seraient identiques dans les deux langues. */
  const valeur = (l: LandingKey, v: string) =>
    v || (l === "evidence.r3.l" ? t("evidence.r3.v") : t("evidence.r4.v"));

  return (
    <section id="evidence" className="relative section-divider py-14 lg:py-20">
      <div className="lp-container">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="reveal">
            <h2 className="font-display text-[clamp(1.9rem,3.6vw,2.7rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-white">
              {t("evidence.title.a")} <span className="text-accent">{t("evidence.title.b")}</span>
            </h2>
            <p className="mt-4 max-w-xl leading-7 text-slate-400">{t("evidence.sub")}</p>
            <ul className="mt-8 space-y-3">
              {PREUVE_POINTS.map((k) => (
                <li key={k} className="flex items-start gap-3 text-[14px] text-slate-300">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[rgb(var(--tv-accent-rgb)/0.1)] text-[var(--tv-highlight)]">
                    <Check className="h-3 w-3" />
                  </span>
                  {t(k)}
                </li>
              ))}
            </ul>
          </div>

          <div className="reveal">
            <div className="lp-panel p-5">
              {/* L'affirmation — ce que dit le coach. */}
              <p className="tv-label text-slate-500">{t("evidence.claim.l")}</p>
              <p className="mt-2 text-[15px] font-semibold leading-6 text-white">
                {t("evidence.claim")}
              </p>

              {/* La preuve — ce sur quoi il s'appuie. Le liseré d'accent à
                  gauche fait la couture entre les deux : c'est la même chose
                  dite deux fois, une fois en français, une fois en chiffres. */}
              <div className="mt-5 border-t border-white/[.08] pt-4">
                <p className="tv-label text-[var(--tv-highlight)]">{t("evidence.proof.l")}</p>
                <dl className="mt-3 space-y-2">
                  {PREUVE_LIGNES.map(({ l, v, fort }) => (
                    <div
                      key={l}
                      className="flex items-baseline justify-between gap-4 rounded-lg border border-white/[.05] bg-white/[.02] px-3.5 py-2.5"
                    >
                      <dt className="text-[13px] text-slate-400">{t(l)}</dt>
                      <dd
                        className={`tv-figure text-[13px] tabular-nums ${
                          fort ? "text-[var(--tv-chart-red)]" : "text-slate-200"
                        }`}
                      >
                        {valeur(l, v)}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--tv-highlight)]">
                  <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("evidence.link")}
                </p>
              </div>
            </div>

            {/* LA SÉCURITÉ STATISTIQUE — le cas où le produit se TAIT.
                C'est contre-intuitif sur une page de vente, et c'est exactement
                pour ça que c'est convaincant : montrer le refus de conclure
                prouve la règle mieux que l'affirmer. */}
            <div className="lp-card mt-3 p-4">
              <div className="flex items-start gap-3">
                <ShieldAlert
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--tv-warning)]"
                  aria-hidden="true"
                />
                <div>
                  <p className="tv-label text-slate-500">{t("evidence.guard.l")}</p>
                  <p className="mt-1 text-[13px] leading-5 text-slate-300">{t("evidence.guard")}</p>
                </div>
              </div>
            </div>

            <Illustration />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── EDGE SCORE ─────────────────────────── */

/** Les quatre composantes et leurs poids réels (`app/utils/edgeScore.ts`). */
const EDGE_PARTS: { l: LandingKey; poids: number }[] = [
  { l: "edge.c1", poids: 35 },
  { l: "edge.c2", poids: 25 },
  { l: "edge.c3", poids: 25 },
  { l: "edge.c4", poids: 15 },
];

/** Le cadran. 326 = circonférence d'un rayon de 52 (2πr), comme dans le bento. */
function CadranEdge({ valeur }: { valeur: number }) {
  const { t } = useLandingT();
  const C = 326;
  return (
    <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="9" />
        <circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke="var(--tv-highlight)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C - C * (valeur / 100)}
        />
      </svg>
      <div className="absolute text-center">
        <span className="tv-figure block text-[2.4rem] leading-none tabular-nums text-white">
          {valeur}
        </span>
        <span className="tv-label mt-1 block text-slate-500">{t("hero.edge")}</span>
      </div>
    </div>
  );
}

export function SectionEdgeScore() {
  const { t } = useLandingT();
  return (
    <section id="edge" className="relative section-divider py-14 lg:py-20">
      <div className="lp-container">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="reveal order-2 lg:order-1">
            <ShotOuVisuel
              nom="edge-score"
              alt={t("shot.edge.alt")}
              legende={t("shot.edge.cap")}
              repli={
                <>
                  <div className="lp-panel p-5">
                    <CadranEdge valeur={78} />
                    <p className="mt-3 text-center text-[12px] font-semibold text-emerald-400">
                      {t("bento.edge.ready")}
                    </p>

                    <div className="mt-6 space-y-2.5 border-t border-white/[.08] pt-5">
                      {EDGE_PARTS.map(({ l, poids }) => (
                        <div key={l}>
                          <div className="flex items-baseline justify-between text-[13px]">
                            <span className="text-slate-300">{t(l)}</span>
                            <span className="tv-figure text-[11px] tabular-nums text-slate-500">
                              {poids} %
                            </span>
                          </div>
                          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/[.05]">
                            <div
                              className="h-full rounded-full bg-[var(--tv-highlight)]/70"
                              style={{ width: `${poids}%` }}
                            />
                          </div>
                        </div>
                      ))}

                      {/* La ligne qui dit tout : la composante ABSENTE. */}
                      <div className="flex items-baseline justify-between border-t border-white/[.06] pt-3 text-[13px]">
                        <span className="text-slate-600 line-through">{t("edge.excluded")}</span>
                        <span className="tv-figure text-[11px] tabular-nums text-slate-600">
                          0 %
                        </span>
                      </div>
                    </div>
                  </div>
                  <Illustration />
                </>
              }
            />
          </div>

          <div className="reveal order-1 lg:order-2">
            <h2 className="font-display text-[clamp(1.9rem,3.6vw,2.7rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-white">
              {t("edge.title.a")} <span className="text-accent">{t("edge.title.b")}</span>
            </h2>
            <p className="mt-4 max-w-xl leading-7 text-slate-400">{t("edge.sub")}</p>

            <div className="lp-card mt-8 p-5">
              <p className="text-sm font-semibold text-white">{t("edge.why")}</p>
              <p className="mt-1.5 text-[13px] leading-6 text-slate-400">{t("edge.why.d")}</p>
            </div>

            <p className="mt-5 text-[13px] leading-6 text-slate-500">{t("edge.note")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── ANCRAGE DE PRIX ─────────────────────────── */

/**
 * Le prix vient du CATALOGUE (`domain/plans`), jamais d'une constante recopiée
 * sur la vitrine : une landing qui affiche un tarif périmé coûte plus cher
 * qu'une landing qui n'en affiche pas.
 */
export function AncrageDePrix() {
  const { t } = useLandingT();
  return (
    <section className="relative section-divider py-14 lg:py-20">
      <div className="lp-container">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-display text-[clamp(1.9rem,3.6vw,2.7rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-white">
            {t("anchor.title.a")} <span className="text-slate-500">{t("anchor.title.b")}</span>
          </h2>
          <p className="mt-4 leading-7 text-slate-400">{t("anchor.sub")}</p>
        </div>

        <div className="reveal mx-auto grid max-w-[760px] items-stretch gap-3 sm:grid-cols-2">
          {/* Ce que la cible paie DÉJÀ. */}
          <div className="lp-panel flex flex-col p-6">
            <p className="tv-label text-slate-500">{t("anchor.a.l")}</p>
            <p className="tv-figure mt-3 text-[clamp(1.8rem,4vw,2.4rem)] leading-none tabular-nums text-[var(--tv-chart-red)]">
              {t("anchor.a.v")}
            </p>
            <p className="mt-3 text-[13px] leading-6 text-slate-400">{t("anchor.a.d")}</p>
          </div>

          {/* Ce qu'on demande. */}
          <div className="card-featured flex flex-col p-6">
            <p className="tv-label text-[var(--tv-highlight)]">{t("anchor.b.l")}</p>
            <p className="mt-3 flex items-baseline gap-1.5">
              <span className="tv-figure text-[clamp(1.8rem,4vw,2.4rem)] leading-none tabular-nums text-white">
                {eur(MONTHLY_EUR)}
              </span>
              <span className="text-[13px] text-slate-500">{t("anchor.b.per")}</span>
            </p>
            <p className="mt-3 text-[13px] leading-6 text-slate-400">{t("anchor.b.d")}</p>
          </div>
        </div>

        <p className="reveal mt-6 text-center text-[15px] font-semibold text-white">
          {t("anchor.punch")}
        </p>
      </div>
    </section>
  );
}
