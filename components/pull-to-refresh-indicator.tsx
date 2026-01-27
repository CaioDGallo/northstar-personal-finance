import { cn } from '@/lib/utils';

type PullToRefreshIndicatorProps = {
  isRefreshing: boolean;
  pullDistance: number;
  label: string;
  refreshingLabel: string;
};

export function PullToRefreshIndicator({
  isRefreshing,
  pullDistance,
  label,
  refreshingLabel,
}: PullToRefreshIndicatorProps) {
  if (!isRefreshing && pullDistance <= 0) {
    return null;
  }

  const cappedDistance = Math.min(pullDistance, 96);
  const progress = Math.min(pullDistance / 80, 1);
  const progressPercent = Math.max(0.15, progress) * 100;

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center pt-[env(safe-area-inset-top)]',
        isRefreshing
          ? 'transition-transform duration-300 ease-out motion-reduce:transition-none'
          : 'transition-none'
      )}
      style={{ transform: `translateY(${cappedDistance}px)` }}
    >
      <div className="mt-3 flex items-center gap-3 rounded-full border border-gray-200/80 bg-white/90 px-4 py-2 text-sm font-medium text-gray-900 shadow-lg shadow-gray-200/60 backdrop-blur">
        {isRefreshing ? (
          <span className="inline-flex size-4 items-center justify-center">
            <span className="size-3 rounded-full border-2 border-gray-300 border-t-gray-900 motion-safe:animate-spin motion-reduce:animate-none" />
          </span>
        ) : (
          <span className="h-1 w-10 overflow-hidden rounded-full bg-gray-200">
            <span
              className="block h-full bg-gray-900 transition-[width] duration-200 ease-out motion-reduce:transition-none"
              style={{ width: `${progressPercent}%` }}
            />
          </span>
        )}
        <span className="text-sm font-medium">
          {isRefreshing ? refreshingLabel : label}
        </span>
      </div>
    </div>
  );
}
