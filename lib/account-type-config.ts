import { CreditCardIcon, BankIcon, PiggyBankIcon, Money01Icon } from '@hugeicons/core-free-icons';

// Map account types to icons and colors
export const accountTypeConfig = {
  credit_card: {
    icon: CreditCardIcon,
    color: '#EF4444',
    label: 'Credit Card'
  },
  checking: {
    icon: BankIcon,
    color: '#3B82F6',
    label: 'Checking'
  },
  savings: {
    icon: PiggyBankIcon,
    color: '#22C55E',
    label: 'Savings'
  },
  cash: {
    icon: Money01Icon,
    color: '#F59E0B',
    label: 'Cash'
  },
};

export type AccountType = keyof typeof accountTypeConfig;
