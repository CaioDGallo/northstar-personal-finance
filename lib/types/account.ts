import type { Account } from '@/lib/schema';

/**
 * Type-safe account discriminated unions
 *
 * Credit cards have specific fields (closingDay, paymentDueDay, creditLimit)
 * that other account types don't have. These types enable type-safe handling.
 */

export type CheckingAccount = Account & {
  type: 'checking';
  closingDay: null;
  paymentDueDay: null;
  creditLimit: null;
};

export type SavingsAccount = Account & {
  type: 'savings';
  closingDay: null;
  paymentDueDay: null;
  creditLimit: null;
};

export type CashAccount = Account & {
  type: 'cash';
  closingDay: null;
  paymentDueDay: null;
  creditLimit: null;
};

export type CreditCardAccount = Account & {
  type: 'credit_card';
  closingDay: number | null;
  paymentDueDay: number | null;
  creditLimit: number | null;
};

/**
 * Union of all account types with proper type discrimination
 */
export type TypedAccount = CheckingAccount | SavingsAccount | CashAccount | CreditCardAccount;

/**
 * Type guard to check if an account is a credit card
 *
 * @example
 * if (isCreditCard(account)) {
 *   // TypeScript knows account.creditLimit exists here
 *   const available = account.creditLimit - Math.abs(account.currentBalance);
 * }
 */
export function isCreditCard(account: Account): account is CreditCardAccount {
  return account.type === 'credit_card';
}

/**
 * Type guard to check if an account is a checking account
 */
export function isCheckingAccount(account: Account): account is CheckingAccount {
  return account.type === 'checking';
}

/**
 * Type guard to check if an account is a savings account
 */
export function isSavingsAccount(account: Account): account is SavingsAccount {
  return account.type === 'savings';
}

/**
 * Type guard to check if an account is a cash account
 */
export function isCashAccount(account: Account): account is CashAccount {
  return account.type === 'cash';
}

/**
 * Helper to calculate available credit for credit cards
 * Returns null for non-credit-card accounts
 */
export function getAvailableCredit(account: Account): number | null {
  if (!isCreditCard(account) || account.creditLimit === null) {
    return null;
  }

  const debt = Math.abs(Math.min(account.currentBalance, 0));
  return account.creditLimit - debt;
}

/**
 * Helper to check if an account has billing configuration
 */
export function hasBillingConfig(account: Account): boolean {
  return isCreditCard(account) &&
         account.closingDay !== null &&
         account.paymentDueDay !== null;
}
