import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import { mockAuth } from '@/test/auth-utils';
import * as schema from '@/lib/schema';
import { testCategories, testAccounts, TEST_USER_ID, createTestTransaction, createTestEntry, createTestIncome } from '@/test/fixtures';

type DashboardActions = typeof import('@/lib/actions/dashboard');

describe('Dashboard Actions - getDashboardData', () => {
  let db: ReturnType<typeof getTestDb>;
  let categoryId1: number;
  let categoryId2: number;
  let incomeCategory: number;
  let accountId1: number;
  let accountId2: number;

  // Dynamic imports after mocking
  let getDashboardData: DashboardActions['getDashboardData'];

  beforeAll(async () => {
    db = await setupTestDb();

    // Mock the db module to use test database
    vi.doMock('@/lib/db', () => ({
      db,
    }));

    // Mock auth to prevent Next.js cookies() calls
    mockAuth();

    // Import actions after mocking
    const actions = await import('@/lib/actions/dashboard');
    getDashboardData = actions.getDashboardData;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();

    // Seed test data
    const [category1] = await db
      .insert(schema.categories)
      .values(testCategories.expense)
      .returning();

    const [category2] = await db
      .insert(schema.categories)
      .values({
        userId: TEST_USER_ID,
        name: 'Entertainment',
        color: '#3b82f6',
        type: 'expense',
      })
      .returning();

    const [incomeCat] = await db
      .insert(schema.categories)
      .values(testCategories.income)
      .returning();

    const [account1] = await db
      .insert(schema.accounts)
      .values(testAccounts.creditCard)
      .returning();

    const [account2] = await db
      .insert(schema.accounts)
      .values(testAccounts.checking)
      .returning();

    categoryId1 = category1.id;
    categoryId2 = category2.id;
    incomeCategory = incomeCat.id;
    accountId1 = account1.id;
    accountId2 = account2.id;
  });

  describe('Happy Path Tests', () => {
    it('returns empty state for month with no data', async () => {
      const result = await getDashboardData('2025-01');

      expect(result).toEqual({
        totalSpent: 0,
        totalReplenished: 0,
        totalBudget: 0,
        totalIncome: 0,
        netBalance: 0,
        totalTransfersIn: 0,
        totalTransfersOut: 0,
        cashFlowNet: 0,
        categoryBreakdown: [],
        recentExpenses: [],
        recentIncome: [],
      });
    });

    it('calculates expenses only correctly', async () => {
      // Create transactions and entries for Jan 2025
      const [txn1] = await db
        .insert(schema.transactions)
        .values(createTestTransaction({
          description: 'Restaurant',
          totalAmount: 5000,
          categoryId: categoryId1,
        }))
        .returning();

      const [txn2] = await db
        .insert(schema.transactions)
        .values(createTestTransaction({
          description: 'Movie',
          totalAmount: 3000,
          categoryId: categoryId2,
        }))
        .returning();

      await db.insert(schema.entries).values([
        createTestEntry({
          transactionId: txn1.id,
          accountId: accountId1,
          amount: 5000,
          purchaseDate: '2025-01-15',
          faturaMonth: '2025-01',
          dueDate: '2025-02-05',
        }),
        createTestEntry({
          transactionId: txn2.id,
          accountId: accountId2,
          amount: 3000,
          purchaseDate: '2025-01-20',
          faturaMonth: '2025-01',
          dueDate: '2025-02-05',
        }),
      ]);

      const result = await getDashboardData('2025-01');

      expect(result.totalSpent).toBe(8000);
      expect(result.totalBudget).toBe(0);
      expect(result.totalIncome).toBe(0);
      expect(result.netBalance).toBe(-8000);
      expect(result.recentExpenses).toHaveLength(2);
      expect(result.recentIncome).toHaveLength(0);
      expect(result.categoryBreakdown).toHaveLength(0); // No budgets set
    });

    it('calculates income only correctly', async () => {
      await db.insert(schema.income).values([
        createTestIncome({
          description: 'Salary',
          amount: 100000,
          categoryId: incomeCategory,
          accountId: accountId1,
          receivedDate: '2025-01-05',
        }),
        createTestIncome({
          description: 'Bonus',
          amount: 20000,
          categoryId: incomeCategory,
          accountId: accountId1,
          receivedDate: '2025-01-15',
        }),
      ]);

      const result = await getDashboardData('2025-01');

      expect(result.totalIncome).toBe(120000);
      expect(result.totalSpent).toBe(0);
      expect(result.netBalance).toBe(120000);
      expect(result.recentIncome).toHaveLength(2);
      expect(result.recentExpenses).toHaveLength(0);
    });

    it('includes transfers in cash flow totals', async () => {
      await db.insert(schema.transfers).values([
        {
          userId: TEST_USER_ID,
          fromAccountId: accountId2,
          toAccountId: accountId1,
          amount: 15000,
          date: '2025-01-10',
          type: 'internal_transfer',
        },
        {
          userId: TEST_USER_ID,
          fromAccountId: accountId2,
          toAccountId: null,
          amount: 5000,
          date: '2025-01-12',
          type: 'withdrawal',
        },
        {
          userId: TEST_USER_ID,
          fromAccountId: null,
          toAccountId: accountId1,
          amount: 3000,
          date: '2025-01-15',
          type: 'deposit',
        },
      ]);

      const result = await getDashboardData('2025-01');

      // Internal transfer (15000) should be excluded from cash flow
      expect(result.totalTransfersIn).toBe(3000); // Only deposit
      expect(result.totalTransfersOut).toBe(5000); // Only withdrawal
      expect(result.cashFlowNet).toBe(-2000); // 0 income + 3000 in - 0 spent - 5000 out
    });

    it('handles budgets without spending', async () => {
      // Create budgets for both categories
      await db.insert(schema.budgets).values([
        {
          userId: TEST_USER_ID,
          categoryId: categoryId1,
          yearMonth: '2025-01',
          amount: 50000,
        },
        {
          userId: TEST_USER_ID,
          categoryId: categoryId2,
          yearMonth: '2025-01',
          amount: 30000,
        },
      ]);

      const result = await getDashboardData('2025-01');

      expect(result.totalBudget).toBe(80000);
      expect(result.totalSpent).toBe(0);
      expect(result.categoryBreakdown).toHaveLength(2);

      const cat1 = result.categoryBreakdown.find(c => c.categoryId === categoryId1);
      expect(cat1).toMatchObject({
        budget: 50000,
        spent: 0,
      });

      const cat2 = result.categoryBreakdown.find(c => c.categoryId === categoryId2);
      expect(cat2).toMatchObject({
        budget: 30000,
        spent: 0,
      });
    });

    it('handles partial budgets (some categories with budgets, some without)', async () => {
      // Only set budget for category1
      await db.insert(schema.budgets).values({
        userId: TEST_USER_ID,
        categoryId: categoryId1,
        yearMonth: '2025-01',
        amount: 50000,
      });

      // Create spending in both categories
      const [txn1] = await db
        .insert(schema.transactions)
        .values(createTestTransaction({
          categoryId: categoryId1,
          totalAmount: 30000,
        }))
        .returning();

      const [txn2] = await db
        .insert(schema.transactions)
        .values(createTestTransaction({
          categoryId: categoryId2,
          totalAmount: 20000,
        }))
        .returning();

      await db.insert(schema.entries).values([
        createTestEntry({
          transactionId: txn1.id,
          accountId: accountId1,
          amount: 30000,
          purchaseDate: '2025-01-10',
          faturaMonth: '2025-01',
          dueDate: '2025-02-05',
        }),
        createTestEntry({
          transactionId: txn2.id,
          accountId: accountId1,
          amount: 20000,
          purchaseDate: '2025-01-15',
          faturaMonth: '2025-01',
          dueDate: '2025-02-05',
        }),
      ]);

      const result = await getDashboardData('2025-01');

      // Only budgeted categories appear in categoryBreakdown
      expect(result.categoryBreakdown).toHaveLength(1);
      expect(result.categoryBreakdown[0]).toMatchObject({
        categoryId: categoryId1,
        budget: 50000,
        spent: 30000,
      });

      // Total spent includes all categories (even without budgets)
      expect(result.totalSpent).toBe(50000);
      expect(result.totalBudget).toBe(50000);
    });

    it('calculates complete scenario (expenses, income, budgets)', async () => {
      // Create budgets
      await db.insert(schema.budgets).values([
        {
          userId: TEST_USER_ID,
          categoryId: categoryId1,
          yearMonth: '2025-01',
          amount: 50000,
        },
        {
          userId: TEST_USER_ID,
          categoryId: categoryId2,
          yearMonth: '2025-01',
          amount: 30000,
        },
      ]);

      // Create expenses
      const [txn1] = await db
        .insert(schema.transactions)
        .values(createTestTransaction({
          categoryId: categoryId1,
          totalAmount: 40000,
        }))
        .returning();

      const [txn2] = await db
        .insert(schema.transactions)
        .values(createTestTransaction({
          categoryId: categoryId2,
          totalAmount: 25000,
        }))
        .returning();

      await db.insert(schema.entries).values([
        createTestEntry({
          transactionId: txn1.id,
          accountId: accountId1,
          amount: 40000,
          purchaseDate: '2025-01-10',
          faturaMonth: '2025-01',
          dueDate: '2025-02-05',
        }),
        createTestEntry({
          transactionId: txn2.id,
          accountId: accountId1,
          amount: 25000,
          purchaseDate: '2025-01-15',
          faturaMonth: '2025-01',
          dueDate: '2025-02-05',
        }),
      ]);

      // Create income
      await db.insert(schema.income).values({
        userId: TEST_USER_ID,
        description: 'Salary',
        amount: 100000,
        categoryId: incomeCategory,
        accountId: accountId1,
        receivedDate: '2025-01-05',
        receivedAt: null,
      });

      const result = await getDashboardData('2025-01');

      expect(result.totalSpent).toBe(65000);
      expect(result.totalBudget).toBe(80000);
      expect(result.totalIncome).toBe(100000);
      expect(result.netBalance).toBe(35000); // 100000 - 65000
      expect(result.categoryBreakdown).toHaveLength(2);
      expect(result.recentExpenses).toHaveLength(2);
      expect(result.recentIncome).toHaveLength(1);
    });
  });

  describe('Edge Case Tests', () => {
    it('handles month boundary dates correctly', async () => {
      const [txn] = await db
        .insert(schema.transactions)
        .values(createTestTransaction({
          categoryId: categoryId1,
          totalAmount: 10000,
        }))
        .returning();

      // First day of month
      await db.insert(schema.entries).values(
        createTestEntry({
          transactionId: txn.id,
          accountId: accountId1,
          amount: 5000,
          purchaseDate: '2025-01-01',
          faturaMonth: '2025-01',
          dueDate: '2025-02-01',
        })
      );

      // Last day of month (31st for January)
      await db.insert(schema.entries).values(
        createTestEntry({
          transactionId: txn.id,
          accountId: accountId1,
          amount: 5000,
          purchaseDate: '2025-01-31',
          faturaMonth: '2025-01',
          dueDate: '2025-02-01',
          installmentNumber: 2,
        })
      );

      const result = await getDashboardData('2025-01');

      expect(result.totalSpent).toBe(10000);
      expect(result.recentExpenses).toHaveLength(2);
    });

    it('filters expenses by purchaseDate, not dueDate', async () => {
      const [txn] = await db
        .insert(schema.transactions)
        .values(createTestTransaction({
          categoryId: categoryId1,
          totalAmount: 10000,
        }))
        .returning();

      // Purchase in Jan, due in Feb
      await db.insert(schema.entries).values(
        createTestEntry({
          transactionId: txn.id,
          accountId: accountId1,
          amount: 10000,
          purchaseDate: '2025-01-15',
          faturaMonth: '2025-02', // Different fatura month
          dueDate: '2025-02-05',
        })
      );

      const janResult = await getDashboardData('2025-01');
      const febResult = await getDashboardData('2025-02');

      // Should appear in Jan (by purchaseDate), not Feb
      expect(janResult.totalSpent).toBe(10000);
      expect(febResult.totalSpent).toBe(0);
    });

    it('handles installment expenses correctly', async () => {
      const [txn] = await db
        .insert(schema.transactions)
        .values(createTestTransaction({
          description: '3x installments',
          categoryId: categoryId1,
          totalAmount: 30000,
          totalInstallments: 3,
        }))
        .returning();

      // Create 3 installments across different months
      await db.insert(schema.entries).values([
        createTestEntry({
          transactionId: txn.id,
          accountId: accountId1,
          amount: 10000,
          purchaseDate: '2025-01-15',
          faturaMonth: '2025-01',
          dueDate: '2025-02-05',
          installmentNumber: 1,
        }),
        createTestEntry({
          transactionId: txn.id,
          accountId: accountId1,
          amount: 10000,
          purchaseDate: '2025-02-15',
          faturaMonth: '2025-02',
          dueDate: '2025-03-05',
          installmentNumber: 2,
        }),
        createTestEntry({
          transactionId: txn.id,
          accountId: accountId1,
          amount: 10000,
          purchaseDate: '2025-03-15',
          faturaMonth: '2025-03',
          dueDate: '2025-04-05',
          installmentNumber: 3,
        }),
      ]);

      const jan = await getDashboardData('2025-01');
      const feb = await getDashboardData('2025-02');
      const mar = await getDashboardData('2025-03');

      // Each month should only count its installment
      expect(jan.totalSpent).toBe(10000);
      expect(feb.totalSpent).toBe(10000);
      expect(mar.totalSpent).toBe(10000);
    });

    it('handles multiple accounts correctly', async () => {
      const [txn1] = await db
        .insert(schema.transactions)
        .values(createTestTransaction({
          description: 'Credit Card Purchase',
          categoryId: categoryId1,
          totalAmount: 5000,
        }))
        .returning();

      const [txn2] = await db
        .insert(schema.transactions)
        .values(createTestTransaction({
          description: 'Cash Purchase',
          categoryId: categoryId1,
          totalAmount: 3000,
        }))
        .returning();

      await db.insert(schema.entries).values([
        createTestEntry({
          transactionId: txn1.id,
          accountId: accountId1, // Credit card
          amount: 5000,
          purchaseDate: '2025-01-10',
          faturaMonth: '2025-01',
          dueDate: '2025-02-05',
        }),
        createTestEntry({
          transactionId: txn2.id,
          accountId: accountId2, // Checking
          amount: 3000,
          purchaseDate: '2025-01-15',
          faturaMonth: '2025-01',
          dueDate: '2025-01-15',
        }),
      ]);

      const result = await getDashboardData('2025-01');

      expect(result.totalSpent).toBe(8000);
      expect(result.recentExpenses).toHaveLength(2);

      const accounts = result.recentExpenses.map(e => e.accountName);
      expect(accounts).toContain('Test Credit Card');
      expect(accounts).toContain('Test Checking');
    });

    it('limits recent expenses to 5 items', async () => {
      const [txn] = await db
        .insert(schema.transactions)
        .values(createTestTransaction({
          categoryId: categoryId1,
          totalAmount: 7000,
        }))
        .returning();

      // Create 7 entries
      const entries = Array.from({ length: 7 }, (_, i) =>
        createTestEntry({
          transactionId: txn.id,
          accountId: accountId1,
          amount: 1000,
          purchaseDate: '2025-01-15',
          faturaMonth: '2025-01',
          dueDate: '2025-02-05',
          installmentNumber: i + 1,
        })
      );

      await db.insert(schema.entries).values(entries);

      const result = await getDashboardData('2025-01');

      expect(result.recentExpenses).toHaveLength(5);
      expect(result.totalSpent).toBe(7000); // All counted in total
    });

    it('orders recent expenses by createdAt DESC', async () => {
      const [txn] = await db
        .insert(schema.transactions)
        .values(createTestTransaction({
          categoryId: categoryId1,
          totalAmount: 30000,
        }))
        .returning();

      // Insert with delays to ensure different createdAt timestamps
      const [entry1] = await db.insert(schema.entries).values(
        createTestEntry({
          transactionId: txn.id,
          accountId: accountId1,
          amount: 10000,
          purchaseDate: '2025-01-01',
          faturaMonth: '2025-01',
          dueDate: '2025-02-05',
        })
      ).returning();

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 10));

      const [entry2] = await db.insert(schema.entries).values(
        createTestEntry({
          transactionId: txn.id,
          accountId: accountId1,
          amount: 10000,
          purchaseDate: '2025-01-15',
          faturaMonth: '2025-01',
          dueDate: '2025-02-05',
          installmentNumber: 2,
        })
      ).returning();

      await new Promise(resolve => setTimeout(resolve, 10));

      const [entry3] = await db.insert(schema.entries).values(
        createTestEntry({
          transactionId: txn.id,
          accountId: accountId1,
          amount: 10000,
          purchaseDate: '2025-01-31',
          faturaMonth: '2025-01',
          dueDate: '2025-02-05',
          installmentNumber: 3,
        })
      ).returning();

      const result = await getDashboardData('2025-01');

      // Most recent first
      expect(result.recentExpenses[0].entryId).toBe(entry3.id);
      expect(result.recentExpenses[1].entryId).toBe(entry2.id);
      expect(result.recentExpenses[2].entryId).toBe(entry1.id);
    });

    it('orders recent income by createdAt DESC', async () => {
      // Insert with delays
      const [inc1] = await db.insert(schema.income).values(
        createTestIncome({
          description: 'First',
          amount: 10000,
          categoryId: incomeCategory,
          accountId: accountId1,
          receivedDate: '2025-01-01',
        })
      ).returning();

      await new Promise(resolve => setTimeout(resolve, 10));

      const [inc2] = await db.insert(schema.income).values(
        createTestIncome({
          description: 'Second',
          amount: 20000,
          categoryId: incomeCategory,
          accountId: accountId1,
          receivedDate: '2025-01-15',
        })
      ).returning();

      await new Promise(resolve => setTimeout(resolve, 10));

      const [inc3] = await db.insert(schema.income).values(
        createTestIncome({
          description: 'Third',
          amount: 30000,
          categoryId: incomeCategory,
          accountId: accountId1,
          receivedDate: '2025-01-31',
        })
      ).returning();

      const result = await getDashboardData('2025-01');

      expect(result.recentIncome[0].incomeId).toBe(inc3.id);
      expect(result.recentIncome[1].incomeId).toBe(inc2.id);
      expect(result.recentIncome[2].incomeId).toBe(inc1.id);
    });

    it('handles large amounts correctly', async () => {
      const largeAmount = 999999999; // ~10 million reais

      const [txn] = await db
        .insert(schema.transactions)
        .values(createTestTransaction({
          categoryId: categoryId1,
          totalAmount: largeAmount,
        }))
        .returning();

      await db.insert(schema.entries).values(
        createTestEntry({
          transactionId: txn.id,
          accountId: accountId1,
          amount: largeAmount,
          purchaseDate: '2025-01-15',
          faturaMonth: '2025-01',
          dueDate: '2025-02-05',
        })
      );

      const result = await getDashboardData('2025-01');

      expect(result.totalSpent).toBe(largeAmount);
    });
  });

  describe('Integration Tests', () => {
    it('filters data by month correctly (no leakage)', async () => {
      // Create data for Jan
      const [txnJan] = await db
        .insert(schema.transactions)
        .values(createTestTransaction({
          categoryId: categoryId1,
          totalAmount: 10000,
        }))
        .returning();

      await db.insert(schema.entries).values(
        createTestEntry({
          transactionId: txnJan.id,
          accountId: accountId1,
          amount: 10000,
          purchaseDate: '2025-01-15',
          faturaMonth: '2025-01',
          dueDate: '2025-02-05',
        })
      );

      await db.insert(schema.income).values(
        createTestIncome({
          categoryId: incomeCategory,
          accountId: accountId1,
          amount: 50000,
          receivedDate: '2025-01-10',
        })
      );

      // Create data for Feb
      const [txnFeb] = await db
        .insert(schema.transactions)
        .values(createTestTransaction({
          categoryId: categoryId1,
          totalAmount: 20000,
        }))
        .returning();

      await db.insert(schema.entries).values(
        createTestEntry({
          transactionId: txnFeb.id,
          accountId: accountId1,
          amount: 20000,
          purchaseDate: '2025-02-15',
          faturaMonth: '2025-02',
          dueDate: '2025-03-05',
        })
      );

      await db.insert(schema.income).values(
        createTestIncome({
          categoryId: incomeCategory,
          accountId: accountId1,
          amount: 60000,
          receivedDate: '2025-02-10',
        })
      );

      const janResult = await getDashboardData('2025-01');
      const febResult = await getDashboardData('2025-02');

      expect(janResult.totalSpent).toBe(10000);
      expect(janResult.totalIncome).toBe(50000);

      expect(febResult.totalSpent).toBe(20000);
      expect(febResult.totalIncome).toBe(60000);
    });

    it('isolates users correctly (no data leakage)', async () => {
      const otherUserId = 'other-user-id';

      // Create categories and accounts for both users
      const [cat1] = await db
        .insert(schema.categories)
        .values({
          userId: TEST_USER_ID,
          name: 'User1 Category',
          color: '#ff0000',
          type: 'expense',
        })
        .returning();

      const [cat2] = await db
        .insert(schema.categories)
        .values({
          userId: otherUserId,
          name: 'User2 Category',
          color: '#00ff00',
          type: 'expense',
        })
        .returning();

      const [acc1] = await db
        .insert(schema.accounts)
        .values({
          userId: TEST_USER_ID,
          name: 'User1 Account',
          type: 'checking',
        })
        .returning();

      const [acc2] = await db
        .insert(schema.accounts)
        .values({
          userId: otherUserId,
          name: 'User2 Account',
          type: 'checking',
        })
        .returning();

      // Create transactions for both users
      const [txn1] = await db
        .insert(schema.transactions)
        .values({
          userId: TEST_USER_ID,
          description: 'User1 Transaction',
          totalAmount: 10000,
          totalInstallments: 1,
          categoryId: cat1.id,
        })
        .returning();

      const [txn2] = await db
        .insert(schema.transactions)
        .values({
          userId: otherUserId,
          description: 'User2 Transaction',
          totalAmount: 20000,
          totalInstallments: 1,
          categoryId: cat2.id,
        })
        .returning();

      await db.insert(schema.entries).values([
        {
          userId: TEST_USER_ID,
          transactionId: txn1.id,
          accountId: acc1.id,
          amount: 10000,
          purchaseDate: '2025-01-15',
          faturaMonth: '2025-01',
          dueDate: '2025-02-05',
          installmentNumber: 1,
          paidAt: null,
        },
        {
          userId: otherUserId,
          transactionId: txn2.id,
          accountId: acc2.id,
          amount: 20000,
          purchaseDate: '2025-01-15',
          faturaMonth: '2025-01',
          dueDate: '2025-02-05',
          installmentNumber: 1,
          paidAt: null,
        },
      ]);

      // Query as TEST_USER (default mock)
      const result = await getDashboardData('2025-01');

      // Should only see User1's data
      expect(result.totalSpent).toBe(10000);
      expect(result.recentExpenses).toHaveLength(1);
      expect(result.recentExpenses[0].description).toBe('User1 Transaction');
    });

    it('returns correct data structure with all fields', async () => {
      // Create budget
      await db.insert(schema.budgets).values({
        userId: TEST_USER_ID,
        categoryId: categoryId1,
        yearMonth: '2025-01',
        amount: 50000,
      });

      // Create expense
      const [txn] = await db
        .insert(schema.transactions)
        .values(createTestTransaction({
          description: 'Test Expense',
          categoryId: categoryId1,
          totalAmount: 10000,
        }))
        .returning();

      await db.insert(schema.entries).values(
        createTestEntry({
          transactionId: txn.id,
          accountId: accountId1,
          amount: 10000,
          purchaseDate: '2025-01-15',
          faturaMonth: '2025-01',
          dueDate: '2025-02-05',
        })
      );

      // Create income
      await db.insert(schema.income).values(
        createTestIncome({
          description: 'Test Income',
          categoryId: incomeCategory,
          accountId: accountId1,
          amount: 50000,
          receivedDate: '2025-01-10',
        })
      );

      const result = await getDashboardData('2025-01');

      // Verify structure
      expect(result).toHaveProperty('totalSpent');
      expect(result).toHaveProperty('totalBudget');
      expect(result).toHaveProperty('totalIncome');
      expect(result).toHaveProperty('netBalance');
      expect(result).toHaveProperty('totalTransfersIn');
      expect(result).toHaveProperty('totalTransfersOut');
      expect(result).toHaveProperty('cashFlowNet');
      expect(result).toHaveProperty('categoryBreakdown');
      expect(result).toHaveProperty('recentExpenses');
      expect(result).toHaveProperty('recentIncome');

      // Verify categoryBreakdown fields
      expect(result.categoryBreakdown[0]).toHaveProperty('categoryId');
      expect(result.categoryBreakdown[0]).toHaveProperty('categoryName');
      expect(result.categoryBreakdown[0]).toHaveProperty('categoryColor');
      expect(result.categoryBreakdown[0]).toHaveProperty('categoryIcon');
      expect(result.categoryBreakdown[0]).toHaveProperty('spent');
      expect(result.categoryBreakdown[0]).toHaveProperty('budget');

      // Verify recentExpenses fields
      expect(result.recentExpenses[0]).toHaveProperty('entryId');
      expect(result.recentExpenses[0]).toHaveProperty('description');
      expect(result.recentExpenses[0]).toHaveProperty('amount');
      expect(result.recentExpenses[0]).toHaveProperty('purchaseDate');
      expect(result.recentExpenses[0]).toHaveProperty('dueDate');
      expect(result.recentExpenses[0]).toHaveProperty('categoryName');
      expect(result.recentExpenses[0]).toHaveProperty('categoryColor');
      expect(result.recentExpenses[0]).toHaveProperty('categoryIcon');
      expect(result.recentExpenses[0]).toHaveProperty('accountName');

      // Verify recentIncome fields
      expect(result.recentIncome[0]).toHaveProperty('incomeId');
      expect(result.recentIncome[0]).toHaveProperty('description');
      expect(result.recentIncome[0]).toHaveProperty('amount');
      expect(result.recentIncome[0]).toHaveProperty('receivedDate');
      expect(result.recentIncome[0]).toHaveProperty('categoryName');
      expect(result.recentIncome[0]).toHaveProperty('categoryColor');
      expect(result.recentIncome[0]).toHaveProperty('categoryIcon');
      expect(result.recentIncome[0]).toHaveProperty('accountName');
    });

    it('handles February with 28 days correctly', async () => {
      const [txn] = await db
        .insert(schema.transactions)
        .values(createTestTransaction({
          categoryId: categoryId1,
          totalAmount: 10000,
        }))
        .returning();

      await db.insert(schema.entries).values(
        createTestEntry({
          transactionId: txn.id,
          accountId: accountId1,
          amount: 10000,
          purchaseDate: '2025-02-28',
          faturaMonth: '2025-02',
          dueDate: '2025-03-05',
        })
      );

      const result = await getDashboardData('2025-02');

      expect(result.totalSpent).toBe(10000);
      expect(result.recentExpenses[0].purchaseDate).toBe('2025-02-28');
    });

    it('excludes entries outside month range', async () => {
      const [txn] = await db
        .insert(schema.transactions)
        .values(createTestTransaction({
          categoryId: categoryId1,
          totalAmount: 30000,
        }))
        .returning();

      await db.insert(schema.entries).values([
        createTestEntry({
          transactionId: txn.id,
          accountId: accountId1,
          amount: 10000,
          purchaseDate: '2024-12-31', // Previous month
          faturaMonth: '2024-12',
          dueDate: '2025-01-05',
        }),
        createTestEntry({
          transactionId: txn.id,
          accountId: accountId1,
          amount: 10000,
          purchaseDate: '2025-01-15', // Current month
          faturaMonth: '2025-01',
          dueDate: '2025-02-05',
          installmentNumber: 2,
        }),
        createTestEntry({
          transactionId: txn.id,
          accountId: accountId1,
          amount: 10000,
          purchaseDate: '2025-02-01', // Next month
          faturaMonth: '2025-02',
          dueDate: '2025-03-05',
          installmentNumber: 3,
        }),
      ]);

      const result = await getDashboardData('2025-01');

      expect(result.totalSpent).toBe(10000); // Only January entry
      expect(result.recentExpenses).toHaveLength(1);
    });
  });

  describe('Transfer Type Tests', () => {
    it('counts only deposits (external in) in transfersIn', async () => {
      // Deposit: toAccountId set, fromAccountId null
      await db.insert(schema.transfers).values({
        userId: TEST_USER_ID,
        fromAccountId: null,
        toAccountId: accountId1,
        amount: 50000,
        date: '2025-01-10',
        type: 'deposit',
      });

      const result = await getDashboardData('2025-01');

      expect(result.totalTransfersIn).toBe(50000);
      expect(result.totalTransfersOut).toBe(0);
      expect(result.cashFlowNet).toBe(50000); // 0 income + 50000 transfersIn - 0 spent - 0 transfersOut
    });

    it('counts only withdrawals (external out) in transfersOut', async () => {
      // Withdrawal: fromAccountId set, toAccountId null
      await db.insert(schema.transfers).values({
        userId: TEST_USER_ID,
        fromAccountId: accountId1,
        toAccountId: null,
        amount: 30000,
        date: '2025-01-15',
        type: 'withdrawal',
      });

      const result = await getDashboardData('2025-01');

      expect(result.totalTransfersIn).toBe(0);
      expect(result.totalTransfersOut).toBe(30000);
      expect(result.cashFlowNet).toBe(-30000); // 0 income + 0 transfersIn - 0 spent - 30000 transfersOut
    });

    it('excludes internal transfers (both accounts set) from cash flow', async () => {
      // Internal transfer: both fromAccountId and toAccountId set
      await db.insert(schema.transfers).values({
        userId: TEST_USER_ID,
        fromAccountId: accountId1,
        toAccountId: accountId2,
        amount: 100000,
        date: '2025-01-20',
        type: 'internal_transfer',
      });

      const result = await getDashboardData('2025-01');

      // Internal transfers should NOT appear in either transfersIn or transfersOut
      expect(result.totalTransfersIn).toBe(0);
      expect(result.totalTransfersOut).toBe(0);
      expect(result.cashFlowNet).toBe(0); // No impact on cash flow
    });

    it('handles mixed transfer types correctly', async () => {
      // Deposit
      await db.insert(schema.transfers).values({
        userId: TEST_USER_ID,
        fromAccountId: null,
        toAccountId: accountId1,
        amount: 50000,
        date: '2025-01-05',
        type: 'deposit',
      });

      // Withdrawal
      await db.insert(schema.transfers).values({
        userId: TEST_USER_ID,
        fromAccountId: accountId1,
        toAccountId: null,
        amount: 20000,
        date: '2025-01-10',
        type: 'withdrawal',
      });

      // Internal transfer (should be excluded)
      await db.insert(schema.transfers).values({
        userId: TEST_USER_ID,
        fromAccountId: accountId1,
        toAccountId: accountId2,
        amount: 100000,
        date: '2025-01-15',
        type: 'internal_transfer',
      });

      const result = await getDashboardData('2025-01');

      expect(result.totalTransfersIn).toBe(50000); // Only deposit
      expect(result.totalTransfersOut).toBe(20000); // Only withdrawal
      expect(result.cashFlowNet).toBe(30000); // 0 income + 50000 in - 0 spent - 20000 out
    });
  });
});
