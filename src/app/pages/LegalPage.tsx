import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Mail } from "lucide-react";
import type { Lang } from "../i18n/translations";
import { SUPPORT_EMAIL } from "../types";
import { legalChrome, type LegalDoc } from "./legal-content";
import { usePersistedLang } from "./usePersistedLang";

export default function LegalPage({ pick }: { pick: (lang: Lang) => LegalDoc }) {
  const lang = usePersistedLang();
  const doc = useMemo(() => pick(lang), [pick, lang]);
  const chrome = legalChrome(lang);
  const dir = lang === "ar" ? "rtl" : "ltr";

  return (
    <div
      dir={dir}
      className="relative min-h-dvh bg-[var(--tv-bg)] text-slate-300 overflow-x-clip selection:bg-cyan-400 selection:text-slate-950"
    >
      {/* Same ambient mesh as the landing — one visual identity site-wide. */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 60% -10%,rgba(6,182,212,.09),transparent 60%),radial-gradient(ellipse 55% 45% at 95% 55%,rgba(99,102,241,.07),transparent 55%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden"></div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-16 pb-[calc(env(safe-area-inset-bottom,0px)+3rem)]">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 h-10 px-3 -ml-1 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/[0.05] transition"
        >
          <ArrowLeft className="w-4 h-4" /> {chrome.back}
        </Link>

        <header className="mt-6 mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{doc.title}</h1>
          <p className="text-xs text-slate-500 mb-4">{doc.updated}</p>
          <p className="text-sm md:text-base text-slate-400 leading-relaxed max-w-2xl">
            {doc.intro}
          </p>
        </header>

        {/* Table of contents */}
        <nav className="glass rounded-2xl p-4 md:p-5 mb-8">
          <div className="tv-label text-cyan-400 mb-3">{chrome.toc}</div>
          <ol className="space-y-1.5">
            {doc.blocks.map((b, i) => (
              <li key={b.h}>
                <a
                  href={`#sec-${i}`}
                  className="text-sm text-slate-400 hover:text-white transition-colors inline-flex items-baseline gap-2"
                >
                  <span className="tv-figure text-cyan-500/70 text-xs">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {b.h}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-4">
          {doc.blocks.map((b, i) => (
            <section
              key={b.h}
              id={`sec-${i}`}
              className="glass-strong rounded-2xl p-4 md:p-5 scroll-mt-6"
            >
              <h2 className="text-base md:text-lg font-bold text-white mb-2.5 flex items-center gap-2.5">
                <span className="tv-figure w-6 h-6 rounded-lg bg-cyan-500/10 text-cyan-400 text-xs flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                {b.h}
              </h2>
              {b.p && <p className="text-sm text-slate-400 leading-relaxed">{b.p}</p>}
              {b.list && (
                <ul className="mt-1 space-y-1.5">
                  {b.list.map((li) => (
                    <li
                      key={li}
                      className="flex items-start gap-2.5 text-sm text-slate-400 leading-relaxed"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/60 mt-2 shrink-0" />
                      {li}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="mt-8 inline-flex items-center gap-2 h-11 px-5 rounded-xl text-sm font-bold tv-accent-fill transition"
        >
          <Mail className="w-4 h-4" /> {chrome.contactCta}
        </a>
      </div>
    </div>
  );
}
