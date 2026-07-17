import { cn } from "../utils/cn";
import { useT } from "../i18n/LanguageContext";
import type { Page } from "../types";

/** Shimmering placeholder block used while data loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  return (
    <div
      className="p-4 md:p-8 max-w-[1400px] mx-auto"
      aria-busy="true"
      aria-label={t("common.loading")}
    >
      <div className="mb-6 md:mb-8 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-52" />
      </div>
      {children}
    </div>
  );
}

/** Full-page skeleton matching the dashboard layout (hero + stat cards + list). */
export function PageSkeleton() {
  return (
    <Shell>
      <Skeleton className="h-64 md:h-80 w-full rounded-3xl mb-6" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    </Shell>
  );
}

/** Analytics: metric tiles + a tall chart with fake bars + two half charts. */
export function ChartSkeleton() {
  const bars = [42, 68, 35, 80, 55, 90, 48, 72, 60, 38, 84, 52];
  return (
    <Shell>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <div className="glass rounded-2xl p-4 md:p-6 mb-6">
        <Skeleton className="h-4 w-40 mb-5" />
        <div className="flex items-end gap-2 h-44 md:h-56">
          {bars.map((h, i) => (
            <div key={i} className="skeleton flex-1 rounded-t-lg" style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="flex justify-between mt-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-3 w-10" />
          ))}
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass rounded-2xl p-4 md:p-6">
          <Skeleton className="h-4 w-32 mb-5" />
          <div className="flex items-center justify-center py-4">
            <div className="skeleton w-36 h-36 rounded-full" />
          </div>
        </div>
        <div className="glass rounded-2xl p-4 md:p-6">
          <Skeleton className="h-4 w-32 mb-5" />
          <div className="space-y-3 pt-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-3 w-16" />
                <div
                  className="skeleton h-3 rounded-full flex-1"
                  style={{ width: `${80 - i * 15}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}

/** Journal / trade history: filter bar + table-like rows. */
export function ListSkeleton() {
  return (
    <Shell>
      <div className="flex gap-2 mb-5">
        <Skeleton className="h-10 flex-1 rounded-xl" />
        <Skeleton className="h-10 w-24 rounded-xl" />
        <Skeleton className="h-10 w-24 rounded-xl hidden md:block" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="glass rounded-xl p-3 flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-36" />
            </div>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-14 rounded-full hidden md:block" />
          </div>
        ))}
      </div>
    </Shell>
  );
}

/** Calendar: weekday header + 5×7 day-cell grid. */
export function CalendarSkeleton() {
  return (
    <Shell>
      <div className="glass rounded-2xl p-4 md:p-6">
        <div className="flex items-center justify-between mb-5">
          <Skeleton className="h-6 w-36" />
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
    <Shell>
      <div className="flex justify-center mb-6">
        <div className="skeleton w-32 h-32 rounded-full" />
      </div>
      <div className="space-y-2.5 max-w-2xl mx-auto">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="glass rounded-2xl p-4 flex items-center gap-3">
            <Skeleton className="h-6 w-6 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="h-3 w-64 hidden md:block" />
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/** Text-and-cards pages (insights, profile, settings…). */
export function CardsSkeleton() {
  return (
    <Shell>
      <div className="space-y-4 max-w-2xl mx-auto">
        <Skeleton className="h-32 rounded-3xl" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-44 rounded-3xl" />
        <Skeleton className="h-32 rounded-3xl" />
      </div>
    </Shell>
  );
}

/** Contextual skeleton for a lazily-loaded page — each mimics the real
 *  layout it stands in for, so the "loading" frame already looks like the
 *  destination instead of a generic spinner. */
export function SkeletonForPage({ page }: { page: Page }) {
  switch (page) {
    case "analytics":
    case "seasonality":
    case "reports":
      return <ChartSkeleton />;
    case "journal":
    case "missed":
    case "mistakes":
    case "news":
      return <ListSkeleton />;
    case "calendar":
      return <CalendarSkeleton />;
    case "checklist":
      return <ChecklistSkeleton />;
    case "insights":
    case "profile":
    case "settings":
    case "calculator":
    case "goals":
      return <CardsSkeleton />;
    default:
      return <PageSkeleton />;
  }
}
