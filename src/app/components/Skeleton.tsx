import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";
import type { Page } from "../types";

/**
 * Skeletons — a low-fidelity render of the page that is about to appear.
 *
 * The rule every loader here follows: mirror the real layout. Same page
 * padding, same max width, same card radii, same row heights, same column
 * counts. When the data lands, blocks fill in where they already were instead
 * of the page reflowing — which is the difference between a product that feels
 * fast and one that just animates while you wait.
 */

/** Shimmering placeholder block. `style` carries the odd computed width that
 *  would otherwise need a one-off Tailwind class per skeleton row. */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={cn("skeleton rounded-xl", className)} style={style} />;
}

/**
 * Page frame. `width` and `pad` mirror the real page's container so the
 * skeleton occupies the exact same box — the most common reason a loader feels
 * cheap is that the content lands somewhere else.
 */
function Shell({
  children,
  width = "max-w-[1400px]",
  pad = "p-4 md:p-6",
  header = true,
}: {
  children: React.ReactNode;
  width?: string;
  pad?: string;
  header?: boolean;
}) {
  const { t } = useT();
  return (
    <div className={cn(pad, width, "mx-auto")} aria-busy="true" aria-label={t("common.loading")}>
      {header && (
        <div className="mb-4 md:mb-5 space-y-2">
          <Skeleton className="h-7 md:h-8 w-48 rounded-lg" />
          <Skeleton className="h-3.5 w-32 rounded" />
        </div>
      )}
      {children}
    </div>
  );
}

/** A row of equal tiles — the summary strips used by Journal and Missed Setups. */
function TileRow({ n, cols }: { n: number; cols: string }) {
  return (
    <div className={cn("grid gap-2 mb-2.5", cols)}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <Skeleton className="h-2.5 w-14 rounded" />
          <Skeleton className="mt-2 h-4 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}

/** Dashboard: command bar, equity hero with a plotted-looking area, KPIs, list. */
export function PageSkeleton() {
  return (
    <Shell pad="p-4 md:p-8">
      {/* Command bar — three cells, exactly as the real one */}
      <div className="grid gap-2.5 md:grid-cols-3 mb-4 md:mb-5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3"
          >
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-2.5 w-16 rounded" />
              <Skeleton className="h-4 w-24 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Equity hero */}
      <div className="glass rounded-3xl p-4 md:p-6 mb-4 md:mb-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="space-y-2">
            <Skeleton className="h-2.5 w-24 rounded" />
            <Skeleton className="h-9 w-40 rounded-lg" />
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-7 w-11 rounded-lg" />
            ))}
          </div>
        </div>
        <CurveGhost className="h-56 md:h-80" />
        <div className="mt-3 pt-3 border-t border-white/[0.05] grid grid-cols-3 gap-2 md:gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-2.5 w-16 rounded" />
              <Skeleton className="h-4 w-14 rounded" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-xl md:rounded-2xl p-3 md:p-3.5 space-y-2">
            <Skeleton className="h-2.5 w-16 rounded" />
            <Skeleton className="h-5 w-20 rounded" />
          </div>
        ))}
      </div>

      <div className="glass rounded-2xl divide-y divide-white/[0.04]">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5">
            <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-20 rounded" />
              <Skeleton className="h-2.5 w-32 rounded" />
            </div>
            <Skeleton className="h-4 w-16 rounded" />
          </div>
        ))}
      </div>
    </Shell>
  );
}

/**
 * The plotted area of a chart, suggested rather than shimmering flat: a
 * silhouette that rises like an equity curve reads as "a chart is coming",
 * where a plain rectangle reads as "something is broken".
 */
function CurveGhost({ className }: { className?: string }) {
  return (
    <div className={cn("relative w-full overflow-hidden rounded-xl", className)}>
      <div className="absolute inset-0 flex flex-col justify-between py-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-px w-full bg-white/[0.04]" />
        ))}
      </div>
      <svg
        viewBox="0 0 400 120"
        preserveAspectRatio="none"
        className="skeleton absolute inset-0 h-full w-full opacity-70"
        style={{
          WebkitMaskImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 120' preserveAspectRatio='none'><path d='M0 96 L50 84 L100 90 L150 62 L200 72 L250 44 L300 54 L350 26 L400 34 L400 120 L0 120 Z' fill='black'/></svg>\")",
          maskImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 120' preserveAspectRatio='none'><path d='M0 96 L50 84 L100 90 L150 62 L200 72 L250 44 L300 54 L350 26 L400 34 L400 120 L0 120 Z' fill='black'/></svg>\")",
          WebkitMaskSize: "100% 100%",
          maskSize: "100% 100%",
        }}
      />
    </div>
  );
}

/** Analytics / reports: metric tiles, a tall chart, then two half charts. */
export function ChartSkeleton() {
  const bars = [42, 68, 35, 80, 55, 90, 48, 72, 60, 38, 84, 52];
  return (
    <Shell pad="p-4 md:p-8">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="glass rounded-2xl p-3 space-y-2">
            <Skeleton className="h-2.5 w-14 rounded" />
            <Skeleton className="h-5 w-16 rounded" />
          </div>
        ))}
      </div>
      <div className="glass rounded-3xl p-4 md:p-6 mb-6">
        <Skeleton className="h-3.5 w-40 mb-5 rounded" />
        <CurveGhost className="h-56 md:h-80" />
      </div>
      <div className="glass rounded-2xl p-4 md:p-6 mb-6">
        <Skeleton className="h-3.5 w-32 mb-5 rounded" />
        <div className="flex items-end gap-2 h-40 md:h-52">
          {bars.map((h, i) => (
            <div key={i} className="skeleton flex-1 rounded-t-lg" style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="flex justify-between mt-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-2.5 w-10 rounded" />
          ))}
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass rounded-2xl p-4 md:p-6">
          <Skeleton className="h-3.5 w-32 mb-5 rounded" />
          <div className="flex items-center justify-center py-4">
            <div className="skeleton w-36 h-36 rounded-full" />
          </div>
        </div>
        <div className="glass rounded-2xl p-4 md:p-6">
          <Skeleton className="h-3.5 w-32 mb-5 rounded" />
          <div className="space-y-3 pt-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-2.5 w-16 rounded" />
                <div className="skeleton h-2.5 rounded-full" style={{ width: `${80 - i * 15}%` }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}

/** Journal: summary strip, filter pills, then the compact table. */
export function JournalSkeleton() {
  return (
    <Shell>
      <TileRow n={4} cols="grid-cols-2 md:grid-cols-4" />
      <div className="flex items-center gap-1.5 mb-2.5 md:mb-3">
        <Skeleton className="h-9 flex-1 md:flex-none md:w-72 rounded-xl" />
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>
      <div className="glass rounded-2xl overflow-hidden">
        <div className="flex items-center gap-4 border-b border-white/[0.06] px-4 py-2">
          {[64, 48, 72, 40, 40, 32, 32].map((w, i) => (
            <Skeleton key={i} className="h-2.5 rounded" style={{ width: w }} />
          ))}
        </div>
        <div className="divide-y divide-white/[0.04]">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-2">
              <Skeleton className="h-3.5 w-16 rounded" />
              <Skeleton className="h-3.5 w-12 rounded" />
              <Skeleton className="h-3.5 w-20 rounded" />
              <Skeleton className="h-3.5 w-14 rounded" />
              <Skeleton className="h-3.5 w-10 rounded" />
              <Skeleton className="ml-auto h-5 w-12 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

/** Missed setups: 3 tiles then the collapsed one-line rows. */
export function MissedSkeleton() {
  return (
    <Shell width="max-w-[1100px]">
      <TileRow n={3} cols="grid-cols-3" />
      <div className="space-y-1.5">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="glass rounded-2xl flex items-center gap-2 px-3 py-2.5">
            <Skeleton className="h-4 w-4 rounded shrink-0" />
            <Skeleton className="h-3.5 w-12 rounded" />
            <Skeleton className="h-2.5 w-16 rounded" />
            <Skeleton className="h-5 w-20 rounded-lg" />
            <div className="ml-auto flex gap-1">
              {[0, 1, 2].map((k) => (
                <Skeleton key={k} className="h-7 w-7 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/** Economic news: week navigator, impact tiles, search, then day groups. */
export function NewsSkeleton() {
  return (
    <Shell width="max-w-[1100px]" pad="p-4 md:p-8">
      <div className="glass rounded-2xl p-2.5 mb-3 flex items-center justify-between">
        <Skeleton className="h-9 w-9 rounded-xl" />
        <Skeleton className="h-4 w-36 rounded" />
        <Skeleton className="h-9 w-9 rounded-xl" />
      </div>
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <Skeleton className="h-2.5 w-16 rounded" />
            <Skeleton className="mt-1.5 h-4 w-8 rounded" />
          </div>
        ))}
      </div>
      <div className="flex gap-2 mb-3">
        <Skeleton className="h-11 flex-1 rounded-xl" />
        <Skeleton className="h-11 w-24 rounded-xl" />
      </div>
      {[0, 1].map((g) => (
        <div key={g} className="mb-4">
          <div className="flex items-center gap-2 mb-2 px-1">
            <Skeleton className="h-3 w-32 rounded" />
            <div className="flex-1 h-px bg-white/[0.05]" />
          </div>
          <div className="glass rounded-2xl divide-y divide-white/[0.04]">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 px-3.5 py-3.5">
                <Skeleton className="h-10 w-1 rounded-full shrink-0" />
                <Skeleton className="h-4 w-11 rounded" />
                <Skeleton className="h-6 w-16 rounded-md" />
                <Skeleton className="h-3.5 flex-1 max-w-[220px] rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </Shell>
  );
}

/** Lot calculator: mode toggle, inputs card, result card beside it. */
export function CalculatorSkeleton() {
  return (
    <Shell width="max-w-[860px]" pad="p-4 md:p-8">
      <Skeleton className="h-11 w-56 rounded-2xl mb-5" />
      <div className="grid md:grid-cols-[1fr_320px] gap-5 items-start">
        <div className="glass-strong rounded-3xl p-5 md:p-6 space-y-4">
          <Skeleton className="h-2.5 w-40 rounded" />
          <div className="grid grid-cols-2 gap-3">
            {[0, 1].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-2.5 w-20 rounded" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            ))}
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-14 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-2.5 w-44 rounded" />
          <div className="grid grid-cols-2 gap-3">
            {[0, 1].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-2.5 w-20 rounded" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            ))}
          </div>
        </div>
        <div className="glass-strong rounded-3xl p-5 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-8 w-8 rounded-xl" />
            <Skeleton className="h-3.5 w-28 rounded" />
          </div>
          <div className="flex flex-col items-center py-3 gap-2">
            <Skeleton className="h-11 w-28 rounded-lg" />
            <Skeleton className="h-2.5 w-24 rounded" />
          </div>
          <div className="space-y-1 mt-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between h-9 px-3">
                <Skeleton className="h-2.5 w-20 rounded" />
                <Skeleton className="h-3.5 w-14 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}

/** Jarvis: briefing card, KPI strip, the two read cards, the conversation. */
export function JarvisSkeleton() {
  return (
    <Shell width="max-w-4xl" pad="p-4 md:p-8">
      <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.05] p-4 md:p-5 mb-4 flex items-start gap-3.5">
        <Skeleton className="h-11 w-11 rounded-2xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-2.5 w-28 rounded" />
          <Skeleton className="h-4 w-full max-w-md rounded" />
          <Skeleton className="h-4 w-2/3 rounded" />
        </div>
        <Skeleton className="h-9 w-24 rounded-xl shrink-0" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-xl md:rounded-2xl p-3 md:p-3.5 space-y-2">
            <Skeleton className="h-2.5 w-16 rounded" />
            <Skeleton className="h-5 w-20 rounded" />
          </div>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        {[0, 1].map((i) => (
          <div key={i} className="glass rounded-2xl p-4 space-y-2.5">
            <Skeleton className="h-3.5 w-28 rounded" />
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-3/4 rounded" />
          </div>
        ))}
      </div>
      <div className="glass-strong rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <Skeleton className="h-3.5 w-32 rounded" />
        </div>
        <div className="px-4 py-4 space-y-3">
          <Skeleton className="h-14 w-3/4 rounded-2xl" />
          <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
        </div>
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {[28, 36, 24, 32].map((w, i) => (
            <Skeleton key={i} className="h-7 rounded-xl" style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className="p-3 border-t border-white/[0.06] flex gap-2">
          <Skeleton className="h-10 flex-1 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
        </div>
      </div>
    </Shell>
  );
}

/** Subscription: status hero with its facts grid, features, then the plans. */
export function SubscriptionSkeleton() {
  return (
    <Shell width="max-w-3xl" pad="p-4 md:p-8">
      <div className="rounded-3xl border border-cyan-500/15 bg-cyan-500/[0.04] p-6 md:p-7 mb-4">
        <div className="flex items-start gap-4">
          <Skeleton className="h-14 w-14 rounded-2xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-40 rounded-lg" />
            <Skeleton className="h-3 w-56 rounded" />
          </div>
          <Skeleton className="h-9 w-24 rounded-lg shrink-0" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5"
            >
              <Skeleton className="h-2.5 w-16 rounded" />
              <Skeleton className="mt-1.5 h-3.5 w-20 rounded" />
            </div>
          ))}
        </div>
      </div>
      <div className="glass rounded-2xl p-4 mb-4">
        <Skeleton className="h-3 w-40 mb-3 rounded" />
        <div className="grid md:grid-cols-3 gap-2.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
      <div className="glass-strong rounded-3xl p-6 space-y-5">
        <Skeleton className="h-3.5 w-32 rounded" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="grid sm:grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))}
        </div>
      </div>
    </Shell>
  );
}

/** Calendar: weekday header + 5×7 day-cell grid. */
export function CalendarSkeleton() {
  return (
    <Shell pad="p-4 md:p-8">
      <div className="glass rounded-2xl p-4 md:p-6">
        <div className="flex items-center justify-between mb-5">
          <Skeleton className="h-6 w-36 rounded-lg" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5 md:gap-2 mb-2">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-3 rounded" />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5 md:gap-2">
          {Array.from({ length: 35 }, (_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg md:rounded-xl" />
          ))}
        </div>
      </div>
    </Shell>
  );
}

/** Checklist: progress ring + tickable rows. */
export function ChecklistSkeleton() {
  return (
    <Shell pad="p-4 md:p-8">
      <div className="flex justify-center mb-6">
        <div className="skeleton w-32 h-32 rounded-full" />
      </div>
      <div className="space-y-2.5 max-w-2xl mx-auto">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="glass rounded-2xl p-4 flex items-center gap-3">
            <Skeleton className="h-6 w-6 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-48 rounded" />
              <Skeleton className="h-3 w-64 hidden md:block rounded" />
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/** Generic list page (mistakes) — filter bar over uniform rows. */
export function ListSkeleton() {
  return (
    <Shell>
      <div className="flex gap-2 mb-4">
        <Skeleton className="h-10 flex-1 rounded-xl" />
        <Skeleton className="h-10 w-24 rounded-xl" />
        <Skeleton className="h-10 w-24 rounded-xl hidden md:block" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="glass rounded-xl p-3 flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-3 w-36 rounded" />
            </div>
            <Skeleton className="h-4 w-16 rounded" />
            <Skeleton className="h-6 w-14 rounded-full hidden md:block" />
          </div>
        ))}
      </div>
    </Shell>
  );
}

/** Text-and-cards pages (profile, settings, goals, trading plan, appearance). */
export function CardsSkeleton() {
  return (
    <Shell width="max-w-2xl" pad="p-4 md:p-8">
      <Skeleton className="h-32 rounded-3xl mb-4" />
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-44 rounded-3xl mb-4" />
      <Skeleton className="h-32 rounded-3xl" />
    </Shell>
  );
}

/** Contextual skeleton for a lazily-loaded page — each mirrors the real layout
 *  it stands in for, so the loading frame already looks like the destination. */
export function SkeletonForPage({ page }: { page: Page }) {
  switch (page) {
    case "analytics":
    case "seasonality":
    case "reports":
      return <ChartSkeleton />;
    case "journal":
      return <JournalSkeleton />;
    case "missed":
      return <MissedSkeleton />;
    case "news":
      return <NewsSkeleton />;
    case "calculator":
      return <CalculatorSkeleton />;
    case "insights":
      return <JarvisSkeleton />;
    case "subscription":
      return <SubscriptionSkeleton />;
    case "mistakes":
      return <ListSkeleton />;
    case "calendar":
      return <CalendarSkeleton />;
    case "checklist":
      return <ChecklistSkeleton />;
    case "profile":
    case "settings":
    case "goals":
    case "tradingplan":
    case "appearance":
      return <CardsSkeleton />;
    default:
      return <PageSkeleton />;
  }
}
