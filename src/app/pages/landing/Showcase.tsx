import { Quote, ShieldCheck, KeyRound, Download, Check } from "lucide-react";
import { useLandingT, type LandingKey } from "./i18n";

/**
 * Les bandes de la landing : plateformes, preuve, confiance.
 *
 * Le contenu est VÉRIFIABLE : pas de faux avis, pas d'allégation inventée.
 * La bande « comment tes trades entrent » ne prétend AUCUNE synchronisation
 * avec un broker (il n'y en a pas d'API) : elle nomme les vraies portes
 * d'entrée — import CSV universel, copier-coller, saisie rapide, démo.
 */

export function PlatformsStrip() {
  const { t } = useLandingT();
  const items: LandingKey[] = ["platforms.i1", "platforms.i2", "platforms.i3", "platforms.i4"];
  return (
    <div className="reveal rounded-2xl border border-white/[.07] bg-white/[.02] px-6 py-6 backdrop-blur-md">
      <p className="tv-label text-center text-slate-500">{t("platforms.label")}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
        {items.map((k) => (
          <span
            key={k}
            className="font-display text-base font-bold tracking-tight text-slate-300/90 sm:text-lg"
          >
            {t(k)}
          </span>
        ))}
      </div>
    </div>
  );
}

const FACTS: { v: string; l: LandingKey }[] = [
  { v: "20+", l: "proof.f1.l" },
  { v: "<10s", l: "proof.f2.l" },
  { v: "24/7", l: "proof.f3.l" },
];

const CTA_POINTS: LandingKey[] = ["proof.cta.p1", "proof.cta.p2", "proof.cta.p3", "proof.cta.p4"];

export function TraderProof({ onStart }: { onStart: () => void }) {
  const { t } = useLandingT();
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_.85fr_.85fr]">
      {/* ── Le pourquoi, et les chiffres qui le soutiennent ── */}
      <div className="reveal">
        <h2 className="font-display text-[clamp(1.7rem,3vw,2.3rem)] font-bold leading-[1.1] tracking-[-0.03em] text-white">
          {t("proof.title.a")}
          <br />
          {t("proof.title.b")}
        </h2>
        <p className="mt-4 max-w-[420px] text-[14.5px] leading-7 text-slate-400">
          {t("proof.body")}
        </p>
        <div className="mt-8 grid grid-cols-3 gap-4">
          {FACTS.map((f) => (
            <div key={f.v}>
              <p className="font-display text-[clamp(1.5rem,3vw,2rem)] font-bold text-cyan-300">
                {f.v}
              </p>
              <p className="mt-1 text-[11.5px] leading-5 text-slate-500">{t(f.l)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── La carte citation ── */}
      <div className="glass-card reveal flex flex-col justify-between px-6 py-7">
        <Quote className="h-7 w-7 text-cyan-400/40" aria-hidden="true" />
        <p className="mt-4 text-[14px] leading-7 text-slate-300">{t("proof.quote")}</p>
        <div className="mt-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full border border-cyan-400/25 bg-cyan-400/10 font-display text-sm font-bold text-cyan-300">
            TV
          </div>
          <div>
            <p className="text-[13px] font-bold text-white">{t("proof.author")}</p>
            <p className="text-[11.5px] text-slate-500">{t("proof.author.sub")}</p>
          </div>
        </div>
      </div>

      {/* ── La carte d'appel à l'action ── */}
      <div className="glass-card reveal flex flex-col px-6 py-7">
        <h3 className="font-display text-lg font-bold text-white">{t("proof.cta.t")}</h3>
        <p className="mt-2 text-[13px] leading-6 text-slate-400">{t("proof.cta.d")}</p>
        <ul className="mt-5 space-y-2.5">
          {CTA_POINTS.map((point) => (
            <li key={point} className="flex items-start gap-2 text-[12.5px] text-slate-300">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
              {t(point)}
            </li>
          ))}
        </ul>
        <button onClick={onStart} className="btn-primary mt-6 w-full px-5 py-2.5 text-[.9rem]">
          {t("proof.cta.btn")}
        </button>
      </div>
    </div>
  );
}

const TRUST = [
  { icon: ShieldCheck, t: "trust.t1", d: "trust.d1" },
  { icon: KeyRound, t: "trust.t2", d: "trust.d2" },
  { icon: Download, t: "trust.t3", d: "trust.d3" },
];

export function TrustStrip() {
  const { t } = useLandingT();
  return (
    <div className="reveal grid grid-cols-1 gap-6 rounded-2xl border border-white/[.07] bg-white/[.02] px-6 py-7 backdrop-blur-md sm:grid-cols-3">
      {TRUST.map(({ icon: Ico, t: titleKey, d: descKey }) => (
        <div key={titleKey} className="flex items-start gap-3">
          <Ico className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
          <div>
            <p className="text-[13px] font-bold text-white">{t(titleKey)}</p>
            <p className="mt-0.5 text-[11.5px] leading-5 text-slate-500">{t(descKey)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
