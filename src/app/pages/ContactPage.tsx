import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Mail, Shield, Receipt, Bug, Clock } from "lucide-react";
import { SUPPORT_EMAIL } from "../types";
import { getContactDoc, type ContactChannel } from "./contact-content";
import { usePersistedLang } from "./usePersistedLang";

/**
 * /contact — the public support surface.
 *
 * Shares the exact visual chrome of the legal routes (ambient mesh, glass
 * panels, back link) so the three public pages read as one site. Like them, it
 * renders outside the app tree and reads the persisted language directly.
 */

const ICONS: Record<ContactChannel["icon"], typeof Mail> = {
  mail: Mail,
  shield: Shield,
  receipt: Receipt,
  bug: Bug,
};

function mailto(subject?: string): string {
  return subject
    ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`
    : `mailto:${SUPPORT_EMAIL}`;
}

export default function ContactPage() {
  const lang = usePersistedLang();
  const doc = useMemo(() => getContactDoc(lang), [lang]);
  const dir = lang === "ar" ? "rtl" : "ltr";

  return (
    <div
      dir={dir}
      className="relative min-h-dvh bg-[var(--tv-bg)] text-slate-300 overflow-x-clip selection:bg-cyan-400 selection:text-slate-950"
    >
      {/* Same ambient mesh as the landing and the legal pages. */}
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
          <ArrowLeft className="w-4 h-4" /> {doc.back}
        </Link>

        <header className="mt-6 mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">{doc.title}</h1>
          <p className="text-sm md:text-base text-slate-400 leading-relaxed max-w-2xl">
            {doc.intro}
          </p>
        </header>

        {/* Primary action — one address, impossible to miss. */}
        <div className="glass-strong rounded-2xl p-5 md:p-6 mb-4">
          <a
            href={mailto()}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-xl text-sm font-bold tv-accent-fill transition"
          >
            <Mail className="w-4 h-4" /> {doc.emailLabel}
          </a>
          <p className="mt-3 text-sm text-slate-400 break-all">
            <a href={mailto()} className="text-cyan-300 hover:text-cyan-200 transition-colors">
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>

        {/* Response time */}
        <div className="glass rounded-2xl p-4 md:p-5 mb-8 flex items-start gap-3">
          <span className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </span>
          <div>
            <h2 className="tv-title mb-1">{doc.responseTitle}</h2>
            <p className="text-sm text-slate-400 leading-relaxed">{doc.responseBody}</p>
          </div>
        </div>

        <h2 className="text-base md:text-lg font-bold text-white mb-3">{doc.channelsTitle}</h2>
        <div className="grid gap-3 sm:grid-cols-2 mb-8">
          {doc.channels.map((c) => {
            const Icon = ICONS[c.icon];
            return (
              <a
                key={c.title}
                href={mailto(c.subject)}
                className="glass-strong rounded-2xl p-4 md:p-5 group hover:border-cyan-400/30 transition-colors"
              >
                <span className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3">
                  <Icon className="w-4 h-4" />
                </span>
                <h3 className="tv-title mb-1.5 group-hover:text-cyan-200 transition-colors">
                  {c.title}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">{c.body}</p>
              </a>
            );
          })}
        </div>

        <section className="glass rounded-2xl p-4 md:p-5 mb-8">
          <h2 className="tv-title mb-3">{doc.includeTitle}</h2>
          <ul className="space-y-1.5">
            {doc.include.map((li) => (
              <li
                key={li}
                className="flex items-start gap-2.5 text-sm text-slate-400 leading-relaxed"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/60 mt-2 shrink-0" />
                {li}
              </li>
            ))}
          </ul>
        </section>

        <p className="tv-prose text-slate-600">{doc.legalNote}</p>

        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-500">
          <a href="/privacy" className="hover:text-slate-300 transition-colors">
            Privacy
          </a>
          <a href="/terms" className="hover:text-slate-300 transition-colors">
            Terms
          </a>
        </div>
      </div>
    </div>
  );
}
