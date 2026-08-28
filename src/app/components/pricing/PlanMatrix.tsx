import { Fragment } from "react";
import { Check } from "lucide-react";
import { TIERS, type Tier, type TierDef } from "@/domain/plans";
import { useT } from "../../i18n/LanguageContext";
import { cn } from "../../utils/cn";

/**
 * Matrice de comparaison — la valeur de chaque offre, sans la répéter.
 *
 * Trois colonnes, des lignes groupées par palier qui « ajoute » : chaque ligne
 * n'apparaît qu'une fois, dans le groupe de l'offre qui l'introduit, et la
 * coche se propage aux colonnes qui l'héritent. Lire « Pro ajoute X » et voir
 * ✓ dans Pro et Elite ne laisse aucune ambiguïté sur ce que contient chaque
 * abonnement. La colonne Pro est la plus mise en avant — c'est l'offre qu'on
 * veut voir choisir.
 */

interface MatrixRow {
  id: string;
  label: { fr: string; en: string };
  /** Colonnes qui contiennent cette fonctionnalité, dans l'ordre de TIERS. */
  in: boolean[];
}

function rowsFor(tier: TierDef, cumulativeFrom: number, all: Tier[]): MatrixRow[] {
  return tier.features.map((f) => ({
    id: `${tier.id}-${f.en}`,
    label: { fr: f.fr, en: f.en },
    in: all.map((_, i) => i >= cumulativeFrom),
  }));
}

export default function PlanMatrix() {
  const { lang } = useT();
  const fr = lang === "fr";
  const all = TIERS.map((t) => t.id) as Tier[];
  const groups: { tier: TierDef; rows: MatrixRow[] }[] = [
    { tier: TIERS[0], rows: rowsFor(TIERS[0], 0, all) },
    { tier: TIERS[1], rows: rowsFor(TIERS[1], 1, all) },
    { tier: TIERS[2], rows: rowsFor(TIERS[2], 2, all) },
  ];
  const tr = (b: { fr: string; en: string }) => (fr ? b.fr : b.en);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white">
          {fr ? "Tout ce que contient chaque offre" : "Everything each plan includes"}
        </h3>
      </div>

      {/* En-tête : trois colonnes, Pro mise en valeur. */}
      <div className="grid grid-cols-[minmax(0,1fr)_52px_64px_52px] items-stretch gap-1.5">
        <div />
        {TIERS.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex flex-col items-center justify-end rounded-xl px-2 pb-1.5 pt-2 text-center",
              t.id === "pro"
                ? "border border-cyan-400/30 bg-cyan-400/[0.06]"
                : "border border-transparent",
            )}
          >
            <span
              className={cn(
                "text-[11px] font-bold uppercase tracking-wider",
                t.id === "pro" ? "text-cyan-300" : "text-slate-400",
              )}
            >
              {tr(t.name)}
            </span>
            {t.id === "pro" && (
              <span className="mt-1 rounded-full bg-emerald-400 px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wide text-[#041018]">
                {fr ? "Le plus choisi" : "Most chosen"}
              </span>
            )}
          </div>
        ))}

        {/* Lignes, groupées par palier qui ajoute. */}
        {groups.map(({ tier: g, rows }) => (
          <Fragment key={g.id}>
            <div className="col-span-4 mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {fr
                ? `Dans l'offre ${g.name.fr.toLowerCase()}`
                : `Included in ${g.name.en.toLowerCase()}`}
            </div>
            {rows.map((row) => (
              <div
                key={row.id}
                className="col-span-4 grid grid-cols-[minmax(0,1fr)_52px_64px_52px] items-center gap-1.5"
              >
                <span className="text-[12.5px] text-slate-300">{tr(row.label)}</span>
                {row.in.map((has, i) =>
                  has ? (
                    <span
                      key={i}
                      className={cn(
                        "justify-self-center grid h-4.5 w-4.5 place-items-center rounded-full",
                        i === 1
                          ? "bg-cyan-400/15 text-cyan-300"
                          : "bg-emerald-400/10 text-emerald-400/90",
                      )}
                    >
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                  ) : (
                    <span key={i} className="justify-self-center text-[13px] text-slate-700">
                      —
                    </span>
                  ),
                )}
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
