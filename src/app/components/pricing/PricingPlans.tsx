import { useState } from "react";
import {
  Check,
  Sparkles,
  Zap,
  Gauge,
  ArrowRight,
  Bitcoin,
  Lock,
  Infinity as Infini,
} from "lucide-react";
import { cn } from "../../utils/cn";
import PrixAnime from "./PrixAnime";
import { LIMITS } from "@/domain/plans";
import {
  TIERS,
  eur,
  monthsFree,
  planId,
  yearlyPerMonth,
  PAGE_VALUE,
  pagesOfTier,
  type Bi,
  type Interval,
  type PaidPlan,
  type PaidTier,
  type Plan,
  type Tier,
  type TierDef,
} from "../../utils/pricing";

/**
 * La grille tarifaire — un seul composant, la landing et l'application.
 *
 * Trois colonnes, mais une seule qui doit être lue : Pro est la vedette. La
 * grille ne vend pas trois offres, elle vend UNE offre (Pro) en rassurant sur
 * la gratuité d'à-côté. Chaque élément qui n'aide pas à prendre cette décision
 * a été retiré : pas de sous-titre, pas de calcul en cascade, pas de troisième
 * prière — les deux autres colonnes restent discrètes.
 *
 * Pro mène avec ses DEUX bénéfices les plus concrets (tes erreurs chiffrées en
 * euros, ta probabilité de ruine) — ce sont eux, pas le nom d'une page, qui
 * font passer à l'action. Le reste est une liste courte et vérifiable.
 *
 * ── LE BAS DES COLONNES ───────────────────────────────────────────────────
 *
 * Pro est dense, Gratuit et Elite ne l'étaient pas : les colonnes s'étirant à
 * la même hauteur, les deux se terminaient par 200 à 260 px de vide. Un trou
 * au bas d'une colonne de prix ne se lit pas comme de l'espace, il se lit
 * comme « il n'y a rien de plus ici », juste sous le bouton qu'on veut faire
 * cliquer.
 *
 * Deux blocs le referment, et tous deux APPORTENT l'information qui manquait :
 *
 *   • `BandeauLimites`, ancré en bas de CHAQUE colonne (`mt-auto`) : les trois
 *     chiffres qu'on compare réellement avant de payer — trades par mois,
 *     Jarvis par jour, comptes. Ils viennent de `LIMITS`, la même table que
 *     celle qui les fait respecter dans le produit ; ils ne peuvent donc pas
 *     mentir. Les puces qui ne faisaient que les répéter sont retirées
 *     (marqueur `metered` du catalogue) : le chiffre se lit une fois.
 *
 *   • dans la colonne Gratuit, les 9 pages Premium en gris et cadenassées —
 *     exactement la même grille que celle de Pro, à l'aplomb l'une de l'autre.
 *     C'est la comparaison la plus utile de la page, et elle se fait d'un
 *     coup d'œil : deux grilles identiques, l'une verte, l'autre éteinte.
 */

const ICONS: Record<Tier, typeof Sparkles> = {
  free: Gauge,
  pro: Sparkles,
  elite: Zap,
};

export interface PricingPlansProps {
  lang: "fr" | "en";
  /** Le plan actuel, pour marquer la colonne « offre en cours ». */
  currentPlan?: Plan | null;
  /** Clé de l'action en cours (désactive les boutons et affiche l'attente). */
  busy?: string | null;
  /** Choix d'une offre payante — checkout carte. */
  onChoose: (plan: PaidPlan) => void;
  /** Paiement en crypto, quand il est proposé. */
  onCrypto?: (plan: PaidPlan) => void;
  /** Action de la colonne gratuite. Absente = colonne affichée sans bouton. */
  onFree?: () => void;
  /** Période affichée à l'ouverture. */
  defaultInterval?: Interval;
  className?: string;
}

export default function PricingPlans({
  lang,
  currentPlan,
  busy,
  onChoose,
  onCrypto,
  onFree,
  defaultInterval = "yearly",
  className,
}: PricingPlansProps) {
  const [interval, setInterval] = useState<Interval>(defaultInterval);
  const fr = lang === "fr";
  const yearly = interval === "yearly";

  return (
    <div className={cn("space-y-6", className)}>
      {/* Bascule mensuel / annuel — la seule décision avant l'offre. */}
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label={fr ? "Période de facturation" : "Billing period"}
          className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] p-1"
        >
          {(["monthly", "yearly"] as const).map((value) => (
            <button
              key={value}
              role="tab"
              aria-selected={interval === value}
              onClick={() => setInterval(value)}
              className={cn(
                // 44 px au doigt : la bascule mensuel/annuel est la premiere
                // chose qu'on touche dans la grille, elle etait a 36.
                "inline-flex min-h-[44px] items-center rounded-full px-4 py-2 text-[13px] font-semibold transition sm:min-h-0",
                interval === value
                  ? "bg-white text-[#04101a] shadow-lg shadow-black/30"
                  : "text-slate-500 hover:text-slate-200",
              )}
            >
              {value === "monthly" ? (fr ? "Mensuel" : "Monthly") : fr ? "Annuel" : "Yearly"}
              {value === "yearly" && (
                <span className="ml-1.5 text-[11px] font-bold text-emerald-400">
                  −{monthsFree("pro")} {fr ? "mois" : "mo."}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
        {TIERS.map((tier) => {
          const val =
            tier.id === "free" ? null : planId(tier.id as PaidTier, yearly ? "yearly" : "monthly");
          const current = val != null ? currentPlan === val : currentPlan === "free";
          return (
            <PlanColumn
              key={tier.id}
              tier={tier}
              lang={lang}
              yearly={yearly}
              current={current}
              busy={busy}
              onChoose={val ? onChoose : undefined}
              onCrypto={onCrypto}
              onFree={tier.id === "free" ? onFree : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

function PlanColumn({
  tier,
  lang,
  yearly,
  current,
  busy,
  onChoose,
  onCrypto,
  onFree,
}: {
  tier: TierDef;
  lang: "fr" | "en";
  yearly: boolean;
  current: boolean;
  busy?: string | null;
  onChoose?: (plan: PaidPlan) => void;
  onCrypto?: (plan: PaidPlan) => void;
  onFree?: () => void;
}) {
  const fr = lang === "fr";
  const tr = (b: Bi) => b[lang];
  const Icon = ICONS[tier.id];
  const isFree = tier.id === "free";
  const isPro = tier.id === "pro";
  const plan = isFree ? null : planId(tier.id as PaidTier, yearly ? "yearly" : "monthly");
  const key = plan ?? "free";
  const price = isFree
    ? eur(0, lang)
    : eur(Math.round((yearly ? yearlyPerMonth(tier.id) : tier.monthly) * 100) / 100, lang);

  // Les deux bénéfices les plus concrets de Pro, en tête de liste. Texte déjà
  // utilisé partout (PAGE_VALUE), pas de promesse nouvelle. Liste courte,
  // vérifiable, chiffrée — c'est ce qui rend l'offre irrésistible.
  const proHighlights = [
    {
      fr: "Le prix en euros de chaque erreur que tu répètes.",
      en: "The euro price of every mistake you keep repeating.",
    },
    {
      fr: "Ta probabilité de ruine sur 10 000 scénarios de ton edge.",
      en: "Your risk of ruin across 10,000 runs of your edge.",
    },
  ];
  // Les lignes `metered` (« 10 trades par mois », « Jarvis 20 fois par
  // jour », « 3 comptes ») sont reprises par le bandeau du bas : les garder
  // ici ferait lire le même chiffre deux fois, sous deux formes.
  const featured = tier.features.filter((f) => !f.metered);

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-3xl border p-6 transition",
        isPro
          ? "border-[rgb(var(--tv-accent-rgb)/0.4)] bg-[var(--tv-plate-2)] lg:-my-4 lg:py-12 shadow-[var(--tv-elev-3)]"
          : "border-white/[0.07] bg-white/[0.015]",
        isFree && "lg:bg-transparent lg:opacity-80",
      )}
    >
      {isPro && (
        <>
          {/* Liseré haut, le seul « chrome » — il oriente l'œil vers Pro. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--tv-accent)]/80 to-transparent" />
          <span className="tv-label absolute right-6 top-5 inline-flex items-center gap-1.5 rounded-full bg-emerald-400 px-2.5 py-1 text-[#041018]">
            <Sparkles className="h-3 w-3" />
            {fr ? "Recommandé" : "Recommended"}
          </span>
        </>
      )}

      {/* Le nom — aucune prière, juste ce qu'on achète. */}
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", isPro ? "text-[var(--tv-highlight)]" : "text-slate-500")} />
        <span
          className={cn(
            "tv-label inline-flex items-center",
            isPro ? "text-[var(--tv-highlight)]" : "text-slate-400",
          )}
        >
          {tr(tier.name)}
        </span>
        {current && (
          <span className="ml-1 rounded-full border border-white/[0.1] bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold text-slate-400">
            {fr ? "Offre en cours" : "Current"}
          </span>
        )}
      </div>

      {/* Prix — un seul chiffre à lire. */}
      <div className="mt-5 flex items-end gap-1.5">
        {/* Le chiffre roule au lieu de sauter : c'est le geste qui montre
            l'économie de l'annuel, et il ne se voyait pas. */}
        <PrixAnime
          valeur={price}
          className={cn("tv-figure text-white", isPro ? "text-5xl" : "text-4xl")}
        />
        <span className="mb-1.5 text-sm text-slate-400">
          {isFree ? (fr ? "/ pour toujours" : "/ forever") : fr ? "/mois" : "/month"}
        </span>
      </div>
      <p className="mt-1.5 min-h-[18px] text-[12px] text-slate-500">
        {isFree ? (
          <>&nbsp;</>
        ) : yearly ? (
          <>
            <span className="text-slate-500 line-through">{eur(tier.monthly, lang)}</span>
            <span className="mx-2 text-slate-600">·</span>
            {/* « /an » était écrit en dur, y compris dans la version anglaise :
                « billed €120/an » au milieu d'une page anglaise. */}
            {fr ? "facturé" : "billed"} {eur(tier.yearly, lang)}
            {fr ? "/an" : "/yr"}
            {!current && (
              <span className="ml-2 text-emerald-400">
                {monthsFree(tier.id)} {fr ? "mois offerts" : "mo. free"}
              </span>
            )}
          </>
        ) : (
          " "
        )}
      </p>

      <p
        className={cn(
          "mt-4 text-[13px] font-medium leading-5",
          isPro ? "text-white" : "text-slate-300",
        )}
      >
        {tr(tier.tagline)}
      </p>

      {/* Call to action — le point focal de la colonne. */}
      {isFree ? (
        <button
          onClick={onFree}
          disabled={!onFree || current}
          className="mt-6 w-full rounded-xl border border-white/[0.1] bg-transparent px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
        >
          {/* « Get Started », comme partout : c'est le MÊME acte que le
              bouton de l'en-tête, à quinze centimètres l'un de l'autre. Deux
              libellés pour une action se lisent comme deux portes. */}
          {fr ? "Commencer" : "Get Started"}
        </button>
      ) : (
        <>
          <button
            onClick={() => plan && onChoose && onChoose(plan)}
            disabled={busy != null || current}
            className={cn(
              "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold transition disabled:opacity-60",
              isPro
                ? "tv-accent-fill"
                : "border border-white/[0.12] bg-white/[0.04] text-white hover:bg-white/[0.08]",
            )}
          >
            {current ? (
              fr ? (
                "Offre en cours"
              ) : (
                "Current plan"
              )
            ) : busy === key ? (
              fr ? (
                "Ouverture…"
              ) : (
                "Opening…"
              )
            ) : (
              <>
                {fr ? (isPro ? "Passer à Pro" : "Passer à Elite") : isPro ? "Get Pro" : "Go Elite"}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          {isPro && (
            <p className="mt-2.5 text-center tv-row-label">
              {fr
                ? "Sans engagement · Annulation en 1 clic"
                : "No commitment · Cancel in one click"}
            </p>
          )}

          {onCrypto && !current && plan && (
            <button
              onClick={() => onCrypto(plan)}
              disabled={busy != null}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 text-[11px] font-medium text-slate-500 transition hover:text-slate-300 disabled:opacity-60"
            >
              <Bitcoin className="h-3 w-3" />
              {fr ? "ou payer en crypto" : "or pay with crypto"}
            </button>
          )}
        </>
      )}

      {/* Les trois colonnes ont la MÊME ossature : ce qui leur est propre en
          haut, puis la grille des neuf pages, puis les chiffres. C'est ce qui
          rend la comparaison horizontale possible — la même ligne, au même
          endroit, dans les trois colonnes. */}
      <div className="mt-7 space-y-3">
        {isPro ? (
          proHighlights.map((h) => (
            <div
              key={h.en}
              className="flex items-start gap-2.5 rounded-xl border border-[rgb(var(--tv-accent-rgb)/0.22)] bg-[rgb(var(--tv-accent-rgb)/0.06)] px-3.5 py-2.5"
            >
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--tv-highlight)]" />
              <span className="text-[13px] font-semibold leading-snug text-white">{h[lang]}</span>
            </div>
          ))
        ) : (
          <div className="space-y-2.5">
            {tier.id === "elite" && (
              <p className="tv-label text-[var(--tv-highlight)]/90">
                {fr ? "Tout Pro, sans limites, plus :" : "All of Pro without limits, plus:"}
              </p>
            )}
            {featured.map((f) => (
              <p key={f.en} className="flex items-start gap-2 text-[13px] text-slate-400">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/80" />
                <span className="text-slate-300">{tr(f)}</span>
              </p>
            ))}
          </div>
        )}

        <GrillePages tier={tier.id} lang={lang} />

        {isPro && (
          <p className="pt-1 text-[12px] text-slate-500">
            {fr
              ? "+ tout le plan gratuit, sans aucune limite."
              : "+ everything in Free, with no limits at all."}
          </p>
        )}
        {tier.id === "elite" && (
          <p className="pt-1 text-[12px] text-slate-500">
            {fr ? "Prends-la seulement si le Pro te limite." : "Only if Pro starts limiting you."}
          </p>
        )}
      </div>

      <BandeauLimites tier={tier.id} lang={lang} isPro={isPro} />
    </div>
  );
}

/**
 * LES NEUF PAGES D'ANALYSE, DANS LES TROIS COLONNES.
 *
 * La même liste, à la même hauteur, trois fois : fermée en gratuit, ouverte en
 * Pro, ouverte en Elite. Répéter les noms est ici l'INTÉRÊT et non un défaut —
 * c'est ce qui permet de lire la différence en balayant une ligne du regard,
 * sans tenir de tête ce qu'on vient de voir dans la colonne d'à côté.
 *
 * Seule la colonne Pro les met en vert. Elite affiche la même chose en gris :
 * elle n'ouvre AUCUNE page de plus, elle enlève des limites, et un second
 * bloc vert le laisserait croire. L'accent reste rare, et il désigne une
 * seule colonne.
 */
function GrillePages({ tier, lang }: { tier: Tier; lang: "fr" | "en" }) {
  const fr = lang === "fr";
  const pages = pagesOfTier("pro");
  const ferme = tier === "free";
  const vedette = tier === "pro";

  return (
    <div className="pt-2">
      <p
        className={cn(
          "mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.12em]",
          vedette ? "text-[var(--tv-highlight)]/90" : "text-slate-500",
        )}
      >
        {ferme && <Lock className="h-3 w-3" />}
        {ferme
          ? fr
            ? `${pages.length} pages fermées`
            : `${pages.length} pages locked`
          : vedette
            ? fr
              ? `${pages.length} pages Premium`
              : `${pages.length} Premium pages`
            : fr
              ? `Les mêmes ${pages.length} pages`
              : `The same ${pages.length} pages`}
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {pages.map((page) => {
          const v = PAGE_VALUE[page];
          if (!v) return null;
          return (
            <p
              key={page}
              className={cn(
                "flex items-start gap-2 text-[13px] leading-snug",
                ferme ? "text-slate-600" : vedette ? "text-slate-300" : "text-slate-400",
              )}
            >
              {ferme ? (
                <Lock className="mt-0.5 h-3 w-3 shrink-0 text-slate-700" />
              ) : (
                <Check
                  className={cn(
                    "mt-0.5 h-3.5 w-3.5 shrink-0",
                    vedette ? "text-emerald-400" : "text-slate-500",
                  )}
                />
              )}
              <span>{v.title[fr ? "fr" : "en"]}</span>
            </p>
          );
        })}
      </div>
    </div>
  );
}

/**
 * LES TROIS CHIFFRES QU'ON COMPARE AVANT DE PAYER.
 *
 * Trades par mois, Jarvis par jour, comptes de trading : c'est là, et
 * seulement là, que les trois offres diffèrent vraiment en usage. Ils étaient
 * dispersés en puces, dans trois colonnes de longueurs différentes, donc
 * impossibles à comparer d'un regard.
 *
 * Les valeurs viennent de `LIMITS` — la table que le produit applique
 * réellement. Une limite changée dans le code change ici au même commit ; il
 * n'y a pas de version « marketing » de ces chiffres.
 *
 * `mt-auto` colle le bandeau au bas de la carte : les colonnes s'étirant à la
 * même hauteur, c'est lui qui ferme celles qui ont moins à dire, au lieu du
 * vide qui s'y trouvait.
 */
function BandeauLimites({ tier, lang, isPro }: { tier: Tier; lang: "fr" | "en"; isPro: boolean }) {
  const fr = lang === "fr";
  const l = LIMITS[tier];
  const lignes: { label: string; valeur: number }[] = [
    { label: fr ? "Trades / mois" : "Trades / month", valeur: l.tradesPerMonth },
    { label: fr ? "Jarvis / jour" : "Jarvis / day", valeur: l.jarvisPerDay },
    { label: fr ? "Comptes" : "Accounts", valeur: l.accounts },
  ];

  return (
    <dl className="mt-auto space-y-2 border-t border-white/[0.07] pt-5">
      {lignes.map(({ label, valeur }) => (
        <div key={label} className="flex items-baseline justify-between gap-3">
          <dt className="text-[12px] text-slate-500">{label}</dt>
          <dd
            className={cn(
              "tv-figure text-[13px]",
              // Une limite levée mérite d'être vue : c'est ce qu'on achète.
              valeur === Infinity
                ? isPro
                  ? "text-[var(--tv-highlight)]"
                  : "text-slate-200"
                : "text-slate-400",
            )}
          >
            {valeur === Infinity ? (
              <Infini className="h-4 w-4" aria-label={fr ? "illimité" : "unlimited"} role="img" />
            ) : (
              valeur
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
