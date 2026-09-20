import { Check } from "lucide-react";
import { useLandingT, type LandingKey } from "./i18n";

/**
 * LES QUATRE BÉNÉFICES, EN LISTE À PUCES.
 *
 * ── POURQUOI UNE LISTE, ET PAS UNE GRILLE DE CARTES DE PLUS ───────────────
 *
 * La page montre déjà cinq écrans du produit. Ce qu'elle ne fait nulle part,
 * c'est RÉSUMER : dire en quatre lignes ce qu'on emporte. Une liste à puces
 * se lit en diagonale, une carte demande qu'on s'arrête - et ici on veut
 * précisément qu'on lise vite.
 *
 * Quatre, pas six. Au-delà, une liste cesse d'être lue et devient une
 * texture qu'on saute ; c'est le même seuil que pour les onglets d'une barre
 * de navigation.
 *
 * ── CE QU'ELLES ONT LE DROIT DE DIRE ──────────────────────────────────────
 *
 * Chaque puce est vérifiable dans le produit. Aucune ne promet un gain,
 * aucune n'annonce une fonctionnalité non livrée. Et chacune répond à une
 * objection DIFFÉRENTE - « ça sert à quoi », « comment c'est mesuré »,
 * « combien de travail pour moi », « et si je pars ». Deux puces qui
 * répondent à la même objection, c'est une puce de trop.
 */

interface Puce {
  t: LandingKey;
  d: LandingKey;
}

const PUCES: Puce[] = [
  { t: "v2.bul.1.t", d: "v2.bul.1.d" },
  { t: "v2.bul.2.t", d: "v2.bul.2.d" },
  { t: "v2.bul.3.t", d: "v2.bul.3.d" },
  { t: "v2.bul.4.t", d: "v2.bul.4.d" },
];

export function Benefices() {
  const { t } = useLandingT();
  return (
    <section id="benefits" className="section-divider relative py-10 sm:py-14 lg:py-20">
      <div className="lp-container">
        <h2 className="reveal mx-auto max-w-2xl text-center font-display text-[clamp(1.6rem,3vw,2.3rem)] font-semibold leading-[1.12] tracking-[-0.03em] text-white">
          {t("v2.bul.title")}
        </h2>

        <ul className="reveal mx-auto mt-10 grid max-w-[960px] gap-3 sm:grid-cols-2 lg:mt-14 lg:gap-4">
          {PUCES.map((p) => (
            <li key={p.t} className="lp-card flex gap-3.5 p-5">
              {/* La pastille est la PUCE. Un rond plein à l'accent, à la même
                  place sur les quatre lignes : c'est cet alignement qui fait
                  qu'on lit une liste et non quatre encarts. */}
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[rgb(var(--tv-accent-rgb)/0.16)] text-[var(--tv-highlight)]">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold leading-snug text-white">{t(p.t)}</p>
                <p className="mt-1.5 text-[14px] leading-6 text-slate-400">{t(p.d)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
