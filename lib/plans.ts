export const PLAN_KEYS = ['free', 'saver', 'founder', 'pro'] as const;
export const PLAN_INTERVALS = ['monthly', 'yearly'] as const;

export type PlanKey = typeof PLAN_KEYS[number];
export type PlanInterval = typeof PLAN_INTERVALS[number];

export type PlanLimits = {
  maxCategories: number;
  maxAccounts: number;
  maxCreditCards: number;
  importWeekly: number;
  budgetAlertThresholds: number[];
  customBudgetAlerts: boolean;
};

export type PlanDefinition = {
  key: PlanKey;
  name: string;
  limits: PlanLimits;
};

export const DEFAULT_PLAN_KEY: PlanKey = 'free';
export const DEFAULT_PLAN_INTERVAL: PlanInterval = 'monthly';

export const PLANS: Record<PlanKey, PlanDefinition> = {
  free: {
    key: 'free',
    name: 'Free',
    limits: {
      maxCategories: 6,
      maxAccounts: 3,
      maxCreditCards: 2,
      importWeekly: 3,
      budgetAlertThresholds: [100, 120],
      customBudgetAlerts: false,
    },
  },
  saver: {
    key: 'saver',
    name: 'Saver',
    limits: {
      maxCategories: 50,
      maxAccounts: 20,
      maxCreditCards: 20,
      importWeekly: 50,
      budgetAlertThresholds: [80, 100, 120],
      customBudgetAlerts: true,
    },
  },
  founder: {
    key: 'founder',
    name: 'Founder',
    limits: {
      maxCategories: 50,
      maxAccounts: 20,
      maxCreditCards: 20,
      importWeekly: 50,
      budgetAlertThresholds: [80, 100, 120],
      customBudgetAlerts: true,
    },
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    limits: {
      maxCategories: 50,
      maxAccounts: 20,
      maxCreditCards: 20,
      importWeekly: 50,
      budgetAlertThresholds: [80, 100, 120],
      customBudgetAlerts: true,
    },
  },
};

export function resolvePlanKey(value?: string | null): PlanKey {
  if (!value) return DEFAULT_PLAN_KEY;
  return PLAN_KEYS.includes(value as PlanKey) ? (value as PlanKey) : DEFAULT_PLAN_KEY;
}

export function resolvePlanInterval(value?: string | null): PlanInterval {
  if (!value) return DEFAULT_PLAN_INTERVAL;
  return PLAN_INTERVALS.includes(value as PlanInterval)
    ? (value as PlanInterval)
    : DEFAULT_PLAN_INTERVAL;
}

export function getPlanDefinition(value?: string | null): PlanDefinition {
  return PLANS[resolvePlanKey(value)];
}
