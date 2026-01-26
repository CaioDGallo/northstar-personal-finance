type PushUrlOptions = {
  yearMonth: string;
  categoryId?: number;
};

export function buildDashboardUrl(yearMonth: string): string {
  const params = new URLSearchParams({ month: yearMonth });
  return `/dashboard?${params.toString()}`;
}

export function buildBudgetsUrl({ yearMonth, categoryId }: PushUrlOptions): string {
  const params = new URLSearchParams({ month: yearMonth });
  if (categoryId) {
    params.set('category', String(categoryId));
  }
  return `/budgets?${params.toString()}`;
}

export function buildBudgetsSettingsUrl(yearMonth: string): string {
  const params = new URLSearchParams({ month: yearMonth });
  return `/settings/budgets?${params.toString()}`;
}
