import { cn } from '../utils/cn';
import { useT } from '../i18n/LanguageContext';

/** Shimmering placeholder block used while data loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-xl', className)} />;
}

/** Full-page skeleton matching the dashboard layout (hero + stat cards + list). */
export function PageSkeleton() {
  const { t } = useT();
  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto" aria-busy="true" aria-label={t('common.loading')}>
      <div className="mb-6 md:mb-8 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-52" />
      </div>
      <Skeleton className="h-64 md:h-80 w-full rounded-3xl mb-6" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
      </div>
    </div>
  );
}
