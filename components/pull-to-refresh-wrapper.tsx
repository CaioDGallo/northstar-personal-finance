'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePullToRefresh } from '@/lib/hooks/use-pull-to-refresh';
import { refreshUserData } from '@/lib/actions/refresh';
import { PullToRefreshIndicator } from '@/components/pull-to-refresh-indicator';
import { triggerHaptic, HapticPatterns } from '@/lib/utils/haptics';

type PullToRefreshWrapperProps = {
  children: React.ReactNode;
  disabled?: boolean;
};

export function PullToRefreshWrapper({
  children,
  disabled = false,
}: PullToRefreshWrapperProps) {
  const t = useTranslations('common');
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pullToRefresh = usePullToRefresh({
    disabled,
    onRefresh: async () => {
      triggerHaptic(HapticPatterns.light);
      await refreshUserData();
      router.refresh();
      await new Promise((resolve) => setTimeout(resolve, 300));
    },
  });

  useEffect(() => {
    pullToRefresh.setScrollableRef(containerRef.current);
  }, [pullToRefresh]);

  return (
    <div ref={containerRef} className="relative">
      <PullToRefreshIndicator
        isRefreshing={pullToRefresh.isRefreshing}
        pullDistance={pullToRefresh.pullDistance}
        label={t('pullToRefresh')}
        refreshingLabel={t('refreshing')}
      />
      {children}
    </div>
  );
}
