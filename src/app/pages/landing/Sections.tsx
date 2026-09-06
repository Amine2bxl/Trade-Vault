import type { ReactNode } from "react";
import { useLandingT } from "./i18n";
import { Icon, type IName } from "./Icon";

/**
 * LES SECTIONS DE LA VITRINE REFONDUE.
 *
 * Elles sortent du corps de `Landing.tsx`, qui mélangeait la machinerie (état
 * d'authentification, ancres, compte à rebours, révélation au défilement) et
 * 500 lignes de mise en page. La machinerie reste là-bas ; ce qui se REGARDE
 * vit ici, en morceaux nommés qu'on peut relire un par un.
 *
 * Le vocabulaire visuel est celui posé dans `landing.css` : le graphite est la
 * matière, l'émeraude est l'événement — une carte pleine par section, jamais
 * deux.
 */

/* ── LA GRILLE DE FOND ──────────────────────────────────────────────────── */
export function BackgroundGrid() {
  return <div aria-hidden className="lp-grid" />;
}

/* ── LE TITRE DE SECTION ────────────────────────────────────────────────────
   Deux temps : un sur-titre en petites capitales espacées, puis le titre en
   deux teintes — la moitié sourde pose le sujet, la moitié pleine porte la
   promesse. C'est la construction des deux références, et c'est aussi celle du
   logotype (« Trade » sourd, « Vault » plein). */
export function SectionHead({
  eyebrow,
  title,
  sub,
  align = "center",
}: {
  eyebrow?: string;
  title: ReactNode;
  sub?: string;
  align?: "center" | "left";
}) {
  const centered = align === "center";
  return (
    <div
      className={centered ? "reveal mx-auto mb-10 max-w-2xl text-center" : "reveal mb-10 max-w-2xl"}
    >
      {eyebrow && (
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--lp-text-3)]">
          {eyebrow}
        </p>
      )}
      <h2 className="font-display text-[clamp(1.75rem,3.4vw,2.6rem)] font-bold leading-[1.12] tracking-[-0.03em] text-[var(--lp-text)]">
        {title}
      </h2>
      {sub && (
        <p
          className={
            centered
              ? "mx-auto mt-4 max-w-xl leading-7 text-[var(--lp-text-2)]"
              : "mt-4 leading-7 text-[var(--lp-text-2)]"
          }
        >
          {sub}
        </p>
      )}
    </div>
  );
}

/* ── LES TROIS PILIERS NUMÉROTÉS ────────────────────────────────────────────
   Le geste de la première référence : trois cartes, celle du MILIEU pleine
   d'accent, et c'est elle — et elle seule — qui porte un bouton.

   Pourquoi celle du milieu : sur une rangée de trois, le regard part du centre.
   Lui donner l'aplat, c'est répondre à la question « par où je commence ? »
   avant qu'elle soit posée. Les deux autres restent lisibles, elles ne sont pas
   éteintes — elles n'appellent simplement pas d'action. */
export interface Pillar {
  icon: IName;
  title: string;
  body: string;
}

export function PillarCards({
  pillars,
  ctaLabel,
  onCta,
}: {
  pillars: [Pillar, Pillar, Pillar];
  ctaLabel: string;
  onCta: () => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3 md:items-center">
      {pillars.map((p, i) => {
        const featured = i === 1;
        return (
          <article
            key={p.title}
            style={{ transitionDelay: `${i * 70}ms` }}
            className={[
              "reveal p-6",
              featured
                ? /* La carte du milieu déborde d'un cran en hauteur sur grand
                     écran : c'est ce qui la fait lire comme le sommet des trois,
                     pas comme la troisième d'une rangée. */
                  "lp-plate-accent md:-my-4 md:py-10"
                : "lp-plate lp-plate-hover",
            ].join(" ")}
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <span className="lp-num">{String(i + 1).padStart(2, "0")}</span>
              <span className={featured ? "lp-ring h-10 w-10" : "lp-ring h-10 w-10"}>
                <Icon n={p.icon} cls="h-[18px] w-[18px]" />
              </span>
            </div>
            <h3
              className={[
                "font-display text-[17px] font-bold leading-snug",
                featured ? "" : "text-[var(--lp-text)]",
              ].join(" ")}
            >
              {p.title}
            </h3>
            <p
              className={[
                "mt-2 text-[13px] leading-6",
                featured ? "lp-muted" : "text-[var(--lp-text-2)]",
              ].join(" ")}
            >
              {p.body}
            </p>
            {featured && (
              <button
                type="button"
                onClick={onCta}
                className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-bold text-[var(--lp-on-accent)] underline-offset-4 hover:underline"
              >
                {ctaLabel}
                <span aria-hidden>→</span>
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}

/* ── LE PARCOURS EN COURBE ──────────────────────────────────────────────────
   Le composant qui vient de la seconde référence, et le plus utile des deux :
   une progression posée sur une COURBE ASCENDANTE plutôt que sur une rangée de
   cinq pastilles alignées.

   Ce que la courbe dit et qu'une rangée ne dit pas : que les étapes ne se
   valent pas. Journaliser un trade est le pied de la pente ; corriger un biais
   est le haut. Une rangée horizontale les met à égalité et transforme un
   parcours en sommaire.

   Le tracé est en coordonnées de boîte (0→100 en largeur, 0→100 en hauteur)
   avec `preserveAspectRatio="none"` : il s'étire donc proprement de 320px à
   1200px sans que les jalons se décalent du trait. Sous 768px la courbe cède la
   place à une colonne — une pente de cinq points sur 320px n'est plus une
   pente, c'est un trait. */
export interface Milestone {
  icon: IName;
  title: string;
  sub: string;
  /** L'état du jalon — « acquis », « en cours », « à venir ». */
  state: "done" | "now" | "next";
}

/* Les cinq abscisses/ordonnées des jalons, en pourcentage de la boîte. La
   courbe passe EXACTEMENT par ces points : le chemin ci-dessous est construit
   à partir d'eux, il n'est pas dessiné à part. */
const CURVE_POINTS: [number, number][] = [
  [4, 86],
  [27, 68],
  [50, 50],
  [73, 28],
  [96, 10],
];

/** Une courbe lissée qui passe par les points (Catmull-Rom → Bézier cubique). */
function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

const CURVE_D = smoothPath(CURVE_POINTS);

export function JourneyCurve({ milestones }: { milestones: Milestone[] }) {
  const { t } = useLandingT();
  const stateLabel: Record<Milestone["state"], string> = {
    done: t("journey.state.done"),
    now: t("journey.state.now"),
    next: t("journey.state.next"),
  };

  return (
    <div className="reveal relative">
      {/* ── La courbe, à partir de 768px ── */}
      <div className="relative hidden h-[300px] md:block lg:h-[340px]">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
          className="absolute inset-0 h-full w-full"
        >
          {/* La descente sous la courbe : elle donne du poids à la pente sans
              ajouter un seul trait. */}
          <defs>
            <linearGradient id="lp-journey-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--lp-accent)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--lp-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${CURVE_D} L 96 100 L 4 100 Z`} fill="url(#lp-journey-fill)" />
          <path
            d={CURVE_D}
            fill="none"
            stroke="var(--lp-accent)"
            strokeWidth="0.7"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className="chart-line"
          />
        </svg>

        {/* Les jalons, positionnés en pourcentage — donc toujours SUR le trait,
            quelle que soit la largeur. */}
        {milestones.slice(0, CURVE_POINTS.length).map((m, i) => {
          const [x, y] = CURVE_POINTS[i];
          return (
            <div
              key={m.title}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              {/* Le nœud sur la courbe */}
              <span
                aria-hidden
                className="mx-auto block h-3 w-3 rounded-full border-[3px] border-[var(--lp-ink)] bg-[var(--lp-accent)]"
              />
              {/* Le libellé, au-dessus du nœud */}
              <div className="absolute bottom-[calc(100%+0.6rem)] left-1/2 w-[150px] -translate-x-1/2 text-center">
                <p className="font-display text-[13px] font-bold leading-tight text-[var(--lp-text)]">
                  {m.title}
                </p>
                <p className="mt-0.5 text-[11px] leading-4 text-[var(--lp-text-3)]">{m.sub}</p>
                <span
                  className={[
                    "lp-pill mt-2",
                    m.state === "done" ? "lp-pill-done" : m.state === "now" ? "lp-pill-now" : "",
                  ].join(" ")}
                >
                  <span aria-hidden className="lp-pill-dot" />
                  {stateLabel[m.state]}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── La colonne, sous 768px ──
          Le même parcours, mais vertical : un filet à gauche, les jalons
          dessus. La pente ne se lit plus, l'ORDRE si — et sur un téléphone
          c'est l'ordre qui compte. */}
      <ol className="relative space-y-5 border-l border-[var(--lp-line)] pl-6 md:hidden">
        {milestones.map((m) => (
          <li key={m.title} className="relative">
            <span
              aria-hidden
              className="absolute -left-[1.9rem] top-1 h-3 w-3 rounded-full border-[3px] border-[var(--lp-ink)] bg-[var(--lp-accent)]"
            />
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-[14px] font-bold text-[var(--lp-text)]">{m.title}</p>
              <span
                className={[
                  "lp-pill",
                  m.state === "done" ? "lp-pill-done" : m.state === "now" ? "lp-pill-now" : "",
                ].join(" ")}
              >
                <span aria-hidden className="lp-pill-dot" />
                {stateLabel[m.state]}
              </span>
            </div>
            <p className="mt-1 text-[12.5px] leading-5 text-[var(--lp-text-2)]">{m.sub}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ── LES TROIS ÉTAPES D'ENTRÉE ──────────────────────────────────────────────
   Le bloc « Fund your account / Verify your identity / Start trading » de la
   première référence, transposé au produit : ce que le trader fait dans ses
   trois premières minutes. Même règle — la carte du milieu est pleine, et elle
   porte le bouton. */
export function StepCards({
  steps,
  ctaLabel,
  onCta,
}: {
  steps: [Pillar, Pillar, Pillar];
  ctaLabel: string;
  onCta: () => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3 md:items-center">
      {steps.map((s, i) => {
        const featured = i === 1;
        return (
          <article
            key={s.title}
            style={{ transitionDelay: `${i * 70}ms` }}
            className={[
              "reveal p-6 text-center",
              featured ? "lp-plate-accent md:-my-4 md:py-10" : "lp-plate lp-plate-hover",
            ].join(" ")}
          >
            <span className="lp-ring mx-auto mb-4 h-14 w-14">
              <Icon n={s.icon} cls="h-6 w-6" />
            </span>
            <h3
              className={[
                "font-display text-[15px] font-bold",
                featured ? "" : "text-[var(--lp-text)]",
              ].join(" ")}
            >
              {s.title}
            </h3>
            <p
              className={[
                "mx-auto mt-2 max-w-[26ch] text-[12.5px] leading-6",
                featured ? "lp-muted" : "text-[var(--lp-text-2)]",
              ].join(" ")}
            >
              {s.body}
            </p>
            {featured && (
              <button
                type="button"
                onClick={onCta}
                className="lp-btn mt-5 h-10 bg-[var(--lp-ink)] text-white"
              >
                {ctaLabel}
                <span aria-hidden>→</span>
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}

/* ── LE CHROME DU PRODUIT ───────────────────────────────────────────────────
   Le héros montrait une CARTE — une courbe d'equity posée sur une plaque. Une
   carte peut venir de n'importe quel outil ; elle ne dit pas qu'il y a une
   application derrière. Ce composant l'entoure du chrome réel : un rail de
   navigation à gauche, une barre de tête au-dessus. C'est la seule chose qui
   fasse lire le visuel comme UN PRODUIT plutôt que comme une illustration.

   Le rail est volontairement RÉDUIT à ses pastilles sous 640px : sur un
   téléphone, quatre libellés de navigation dans une maquette de 300px de large
   ne se lisent plus, ils se tassent. La maquette garde alors sa silhouette
   (rail + en-tête + contenu) sans le texte qui la sature.

   Aucun chiffre inventé ici : ce sont les mêmes valeurs de démonstration que
   portait déjà la carte, et les libellés viennent du dictionnaire. */
export function ProductChrome({
  navLabels,
  children,
}: {
  navLabels: [string, string, string, string];
  children: ReactNode;
}) {
  return (
    <div className="lp-plate overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,.6)]">
      {/* La barre de tête */}
      <div className="flex items-center gap-2.5 border-b border-[var(--lp-line)] bg-[var(--lp-plate-2)] px-3 py-2.5">
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-[var(--lp-accent)] text-[10px] font-extrabold text-[var(--lp-on-accent)]">
          TV
        </span>
        <span className="font-display text-[12px] font-bold tracking-[-0.01em] text-[var(--lp-text)]">
          TradeVault
        </span>
        {/* Les trois pastilles de fenêtre — à droite, discrètes : elles disent
            « application », elles ne se regardent pas. */}
        <span aria-hidden className="ml-auto flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-1.5 rounded-full bg-[var(--lp-line-strong)]" />
          ))}
        </span>
      </div>

      <div className="flex">
        {/* Le rail */}
        <nav
          aria-hidden
          className="shrink-0 space-y-1 border-r border-[var(--lp-line)] bg-[var(--lp-plate-2)] p-2 sm:w-[124px]"
        >
          {navLabels.map((label, i) => (
            <span
              key={label}
              className={[
                "flex h-7 items-center gap-2 rounded-md px-2 text-[11px] font-medium",
                i === 0
                  ? "bg-[var(--lp-plate-3)] text-[var(--lp-text)]"
                  : "text-[var(--lp-text-3)]",
              ].join(" ")}
            >
              <span
                className={[
                  "size-1.5 shrink-0 rounded-full",
                  i === 0 ? "bg-[var(--lp-accent)]" : "bg-[var(--lp-line-strong)]",
                ].join(" ")}
              />
              <span className="hidden truncate sm:inline">{label}</span>
            </span>
          ))}
        </nav>

        {/* Le contenu */}
        <div className="min-w-0 flex-1 p-4">{children}</div>
      </div>
    </div>
  );
}

/* ── LA RÉPARTITION PAR SETUP ───────────────────────────────────────────────
   Les barres horizontales de la maquette Lovable, mais branchées sur une
   notion RÉELLE du produit : la part de chaque setup dans les trades
   journalisés. C'est ce que la page Analytics calcule déjà.

   La barre est une jauge, pas une décoration : elle porte la même part que le
   pourcentage écrit à côté, et l'accent ne peint QUE la portion remplie. */
export function SetupSplit({ rows }: { rows: { label: string; pct: number }[] }) {
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="truncate text-[11px] text-[var(--lp-text-2)]">{r.label}</span>
            <span className="tv-figure shrink-0 text-[11px] text-[var(--lp-text-3)]">{r.pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--lp-plate-3)]">
            <div
              className="h-full rounded-full bg-[var(--lp-accent)]"
              style={{ width: `${r.pct}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── LA SECTION ÉDITORIALE ──────────────────────────────────────────────────
   LE LEVIER LE PLUS LOURD DE LA REFONTE, ET LE MOINS VISIBLE DANS LE CODE.

   La vitrine empilait des blocs centrés dans un `max-w-2xl` : un titre au
   milieu, un sous-titre au milieu, du contenu dessous, section après section.
   C'est la mise en page par DÉFAUT — celle qu'on obtient quand on n'en choisit
   aucune. Elle est symétrique, donc elle n'a pas de hiérarchie : rien n'y est
   plus important que le reste, et l'œil n'a aucun endroit où se poser.

   Une grille de douze colonnes coupée en 4/8 (ou 5/7) fait le contraire. Le
   titre tient une colonne étroite à gauche et ne bouge plus ; le contenu
   occupe la large à droite. L'œil descend en Z au lieu de zigzaguer, et la
   page se lit comme une publication plutôt que comme une suite de diapositives.

   `aside` porte le titre : sur grand écran il devient COLLANT — il reste en
   place pendant que le contenu défile à côté. C'est ce qui donne l'impression
   d'un document tenu, et ça ne coûte qu'une ligne. */
export function EditorialSection({
  id,
  eyebrow,
  title,
  sub,
  aside,
  children,
  split = "4/8",
}: {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  sub?: string;
  /** Contenu additionnel sous le titre (un bouton, une mention). */
  aside?: ReactNode;
  children: ReactNode;
  split?: "4/8" | "5/7";
}) {
  const left = split === "4/8" ? "lg:col-span-4" : "lg:col-span-5";
  const right = split === "4/8" ? "lg:col-span-8" : "lg:col-span-7";
  return (
    <section
      id={id}
      className="relative border-b border-[var(--lp-line)] px-4 py-16 sm:px-7 lg:py-24"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-12 gap-8">
        <div className={`col-span-12 ${left}`}>
          <div className="lg:sticky lg:top-24">
            {eyebrow && (
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--lp-text-3)]">
                {eyebrow}
              </p>
            )}
            <h2 className="lp-display mt-3 text-3xl font-semibold leading-[1.08] text-[var(--lp-text)] sm:text-4xl">
              {title}
            </h2>
            {sub && (
              <p className="mt-4 max-w-md text-sm leading-7 text-[var(--lp-text-2)]">{sub}</p>
            )}
            {aside && <div className="mt-6">{aside}</div>}
          </div>
        </div>
        <div className={`col-span-12 ${right}`}>{children}</div>
      </div>
    </section>
  );
}

/* ── LA BANDE DE CHIFFRES ───────────────────────────────────────────────────
   Le motif le plus rentable de la maquette Lovable, et il tient en une
   déclaration : `gap-px` sur un conteneur dont le FOND est la couleur du
   liseré. Les cellules, elles, portent le fond de la page — les « bordures »
   qu'on voit sont donc les interstices du fond qui transparaissent.

   Pourquoi c'est mieux qu'une bordure par cellule : aucune ligne n'est doublée
   à la jonction, donc les filets font exactement 1px partout, y compris quand
   la grille se replie en deux colonnes sur téléphone. Une carte par chiffre,
   espacée, donnerait quatre objets ; ici on lit UN objet à quatre cases. */
export function StatStrip({ items }: { items: { value: string; label: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--lp-r-lg)] border border-[var(--lp-line)] bg-[var(--lp-line)] md:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="bg-[var(--lp-ink)] p-5 sm:p-6">
          <div className="lp-display text-2xl font-semibold text-[var(--lp-text)] sm:text-3xl">
            {it.value}
          </div>
          <div className="mt-1.5 text-xs leading-5 text-[var(--lp-text-2)]">{it.label}</div>
        </div>
      ))}
    </div>
  );
}
