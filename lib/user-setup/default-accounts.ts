/**
 * Default accounts for new users
 * Shared between setup flow and future account initialization
 */

export interface DefaultAccount {
  name: string;
  type: 'cash' | 'checking' | 'savings' | 'credit_card';
  currentBalance: number; // cents
}

export const DEFAULT_ACCOUNTS: DefaultAccount[] = [
  {
    name: 'Carteira',
    type: 'cash',
    currentBalance: 0,
  },
];
