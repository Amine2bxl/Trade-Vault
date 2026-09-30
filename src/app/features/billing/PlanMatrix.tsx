import { Fragment, type ReactNode } from "react";
import { Check, Crown, Infinity as InfinityIcon, Minus, Sparkles } from "lucide-react";
import { LIMITS, TIERS, TIER_RANK, yearlyPerMonth, type Tier } from "@/domain/plans";
import { useT } from "@/app/i18n/LanguageContext";
import { useSubscription } from "@/app/hooks/useSubscription";
import { eur } from "@/app/utils/pricing";
import { cn } from "@/shared/ui/cn";

/**
 * LE TABLEAU DE COMPARAISON — un vrai tableau, qui montre la différence.
 *
 * ══ CE QUI N'ALLAIT PAS ══
 *
 *   • LES DIFFÉRENCES QUI COMPTENT ÉTAIENT NOYÉES. « 10 trades par mois »,
 *     « Jarvis 3 fois par jour », « 1 compte » étaient des lignes de texte
 *     parmi d'autres, cochées dans une seule colonne : pour comparer 10 et
 *     illimité, il fallait lire trois groupes et recoller les morceaux.
 *   • DES COCHES DE 18 PX, en gris sur gris, sans une ligne pour guider l'œil
 *     d'une colonne à l'autre : un tableau qui se lisait comme une liste.
 *   • UN SEUL BOUTON, et il proposait « Passer Pro » même à un abonné Pro.
 *
 * ══ CE QU'IL EST ══
 *
 *   1. LES LIMITES D'ABORD, en chiffres, côte à côte : trades par mois,
 *      analyses Jarvis par jour, comptes. Elles viennent de `LIMITS` — la
 *      table que le serveur applique — donc le tableau ne peut pas mentir.
 *   2. PUIS LES FONCTIONNALITÉS, groupées par l'offre qui les apporte, cochées
 *      dans chaque colonne qui les contient.
 *   3. UNE COLONNE PRO qui se lit d'un trait (bande lumineuse continue), un
 *      bouton par offre selon l'abonnement courant : « Ton offre » sur la
 *      sienne, rien sur celles d'en dessous, l'achat sur celles d'au-dessus.
 */

type Cell = boolean | number;

interface Row {
  id: string;
  label: string;
  values: Cell[];
}

export default function PlanMatrix() {
  const { t, lang } = useT();
  const { tier: current, loading } = useSubscription();
  const tr = (b: { fr: string; en: string }) => (lang === "fr" ? b.fr : b.en);
  const ids = TIERS.map((x) => x.id) as Tier[];

  // 1 · Les limites, en chiffres.
  const limits: Row[] = [
    { id: "trades", label: t("matrix.trades"), values: ids.map((i) => LIMITS[i].tradesPerMonth) },
    { id: "jarvis", label: t("matrix.jarvis"), values: ids.map((i) => LIMITS[i].jarvisPerDay) },
    { id: "accounts", label: t("matrix.accounts"), values: ids.map((i) => LIMITS[i].accounts) },
  ];

  // 2 · Les fonctionnalités : chaque palier hérite de ceux d'en dessous. Les
  // puces « mesurées » sont déjà dites en chiffres au-dessus.
  const groups = TIERS.map((tierDef, rank) => ({
    id: tierDef.id,
    title: t(`matrix.group.${tierDef.id}`),
    rows: tierDef.features
      .filter((f) => !f.metered)
      .map<Row>((f) => ({
        id: `${tierDef.id}-${f.en}`,
        label: tr(f),
        values: ids.map((_, i) => i >= rank),
      })),
  })).filter((g) => g.rows.length > 0);

  const cta = (id: Tier): ReactNode => {
    if (loading) return <span className="plan-cmp-cta-slot" />;
    if (id === current) return <span className="plan-cmp-current">{t("matrix.yourPlan")}</span>;
    if (TIER_RANK[id] < TIER_RANK[current]) return <span className="plan-cmp-cta-slot" />;
    return (
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent("tv:upgrade"))}
        className={cn("plan-cmp-cta", id === "pro" && "plan-cmp-cta-hot")}
      >
        {id === "pro" ? t("matrix.goPro") : t("matrix.goElite")}
      </button>
    );
  };

  const col = (i: number) =>
    cn("plan-cmp-col", ids[i] === "pro" && "is-pro", ids[i] === "free" && "is-free");

  const renderCell = (v: Cell, i: number) => {
    if (typeof v === "number") {
      return Number.isFinite(v) ? (
        <span className="plan-cmp-num">{v}</span>
      ) : (
        <span className="plan-cmp-num plan-cmp-unlimited">
          <InfinityIcon className="h-4 w-4" aria-hidden />
          <span className="sr-only">{t("matrix.unlimited")}</span>
        </span>
      );
    }
    return v ? (
      <span className={cn("plan-cmp-check", ids[i] === "free" && "is-muted")}>
        <Check className="h-3 w-3" strokeWidth={3} aria-label={t("matrix.included")} />
      </span>
    ) : (
      <Minus className="mx-auto h-3.5 w-3.5 text-slate-700" aria-label={t("matrix.notIncluded")} />
    );
  };

  return (
    <div className="plan-cmp">
      <div className="plan-cmp-intro">
        <h3 className="tv-title">{t("matrix.title")}</h3>
        <p className="tv-prose text-slate-500">{t("matrix.subtitle")}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="plan-cmp-table">
          <thead>
            <tr>
              <th scope="col" className="plan-cmp-label" />
              {TIERS.map((x, i) => (
                <th key={x.id} scope="col" className={cn(col(i), "plan-cmp-head")}>
                  {x.id === "pro" && (
                    <span className="plan-cmp-ribbon">
                      <Sparkles className="h-3 w-3" aria-hidden /> {t("matrix.popular")}
                    </span>
                  )}
                  <span className="plan-cmp-name">
                    {x.id === "elite" && <Crown className="h-3.5 w-3.5" aria-hidden />}
                    {tr(x.name)}
                  </span>
                  <span className="plan-cmp-price">
                    {eur(x.monthly, lang)}
                    <span className="plan-cmp-per">{t("matrix.perMonth")}</span>
                  </span>
                  <span className="plan-cmp-yearly">
                    {x.monthly > 0
                      ? t("matrix.yearly").replace(
                          "{price}",
                          eur(Math.round(yearlyPerMonth(x.id) * 100) / 100, lang),
                        )
                      : t("matrix.forever")}
                  </span>
                  {cta(x.id)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="plan-cmp-group">
              <th scope="colgroup" className="plan-cmp-label">
                {t("matrix.group.limits")}
              </th>
              {ids.map((_, i) => (
                <td key={i} className={col(i)} />
              ))}
            </tr>
            {limits.map((row) => (
              <tr key={row.id} className="plan-cmp-row">
                <th scope="row" className="plan-cmp-label">
                  {row.label}
                </th>
                {row.values.map((v, i) => (
                  <td key={i} className={col(i)}>
                    {renderCell(v, i)}
                  </td>
                ))}
              </tr>
            ))}
            {groups.map((g) => (
              <Fragment key={g.id}>
                <tr className="plan-cmp-group">
                  <th scope="colgroup" className="plan-cmp-label">
                    {g.title}
                  </th>
                  {ids.map((_, i) => (
                    <td key={i} className={col(i)} />
                  ))}
                </tr>
                {g.rows.map((row) => (
                  <tr key={row.id} className="plan-cmp-row">
                    <th scope="row" className="plan-cmp-label">
                      {row.label}
                    </th>
                    {row.values.map((v, i) => (
                      <td key={i} className={col(i)}>
                        {renderCell(v, i)}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
            {/* La dernière rangée ferme la bande Pro par son arrondi. */}
            <tr className="plan-cmp-end">
              <th className="plan-cmp-label" />
              {ids.map((_, i) => (
                <td key={i} className={col(i)} />
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
