import { describe, it, expect } from 'vitest';

/**
 * Tests for transaction ID deduplication logic in expense-list.tsx
 *
 * The handleBulkCategoryChange function in expense-list.tsx has complex logic:
 * 1. Maps entry IDs → transaction IDs
 * 2. Filters out optimistic items (negative IDs)
 * 3. Handles entries with invalid transaction IDs
 * 4. Deduplicates transaction IDs (multiple entries can share one transaction)
 *
 * These tests verify this logic works correctly.
 */

describe('Expense List - Transaction ID Deduplication Logic', () => {
  /**
   * Simulates the deduplication logic from expense-list.tsx handleBulkCategoryChange
   */
  function deduplicateTransactionIds(
    selectedIds: number[],
    expenses: Array<{ id: number; transactionId: number }>
  ): {
    uniqueTransactionIds: number[];
    skippedCount: { optimistic: number; notFound: number; invalid: number };
  } {
    const realTransactionIds: number[] = [];
    const skippedCount = { optimistic: 0, notFound: 0, invalid: 0 };

    selectedIds.forEach((id) => {
      if (id <= 0) {
        skippedCount.optimistic++;
        return;
      }

      const entry = expenses.find((e) => e.id === id);
      if (!entry) {
        skippedCount.notFound++;
        return;
      }

      if (!entry.transactionId || entry.transactionId <= 0) {
        skippedCount.invalid++;
        return;
      }

      realTransactionIds.push(entry.transactionId);
    });

    const uniqueTransactionIds = [...new Set(realTransactionIds)];

    return { uniqueTransactionIds, skippedCount };
  }

  describe('deduplication', () => {
    it('deduplicates transaction IDs when multiple entries share same transaction', () => {
      const expenses = [
        { id: 1, transactionId: 100 }, // Entry 1, transaction 100
        { id: 2, transactionId: 100 }, // Entry 2, same transaction
        { id: 3, transactionId: 101 }, // Entry 3, different transaction
      ];

      const result = deduplicateTransactionIds([1, 2, 3], expenses);

      expect(result.uniqueTransactionIds).toEqual([100, 101]);
      expect(result.skippedCount).toEqual({ optimistic: 0, notFound: 0, invalid: 0 });
    });

    it('handles installments correctly (3 entries, 1 transaction)', () => {
      const expenses = [
        { id: 1, transactionId: 200 }, // First installment
        { id: 2, transactionId: 200 }, // Second installment
        { id: 3, transactionId: 200 }, // Third installment
      ];

      const result = deduplicateTransactionIds([1, 2, 3], expenses);

      // Should result in single transaction update
      expect(result.uniqueTransactionIds).toEqual([200]);
      expect(result.uniqueTransactionIds.length).toBe(1);
    });
  });

  describe('optimistic item filtering', () => {
    it('filters out optimistic items (negative IDs)', () => {
      const expenses = [
        { id: -1, transactionId: -1 }, // Optimistic
        { id: -2, transactionId: -2 }, // Optimistic
        { id: 5, transactionId: 200 },  // Real
      ];

      const result = deduplicateTransactionIds([-1, -2, 5], expenses);

      expect(result.uniqueTransactionIds).toEqual([200]);
      expect(result.skippedCount.optimistic).toBe(2);
    });

    it('returns empty array when only optimistic items selected', () => {
      const expenses = [
        { id: -1, transactionId: -1 },
        { id: -2, transactionId: -2 },
      ];

      const result = deduplicateTransactionIds([-1, -2], expenses);

      expect(result.uniqueTransactionIds).toEqual([]);
      expect(result.skippedCount.optimistic).toBe(2);
    });
  });

  describe('entry not found handling', () => {
    it('tracks entries not found in expenses array', () => {
      const expenses = [
        { id: 1, transactionId: 100 },
        { id: 2, transactionId: 101 },
      ];

      // Select ID 3 which doesn't exist
      const result = deduplicateTransactionIds([1, 2, 3], expenses);

      expect(result.uniqueTransactionIds).toEqual([100, 101]);
      expect(result.skippedCount.notFound).toBe(1);
    });

    it('handles case where all selected entries are missing', () => {
      const expenses = [
        { id: 1, transactionId: 100 },
      ];

      const result = deduplicateTransactionIds([10, 20, 30], expenses);

      expect(result.uniqueTransactionIds).toEqual([]);
      expect(result.skippedCount.notFound).toBe(3);
    });
  });

  describe('invalid transaction ID handling', () => {
    it('skips entries with zero transaction ID', () => {
      const expenses = [
        { id: 1, transactionId: 0 },    // Invalid
        { id: 2, transactionId: 100 },  // Valid
      ];

      const result = deduplicateTransactionIds([1, 2], expenses);

      expect(result.uniqueTransactionIds).toEqual([100]);
      expect(result.skippedCount.invalid).toBe(1);
    });

    it('skips entries with negative transaction ID', () => {
      const expenses = [
        { id: 1, transactionId: -1 },   // Invalid
        { id: 2, transactionId: 100 },  // Valid
      ];

      const result = deduplicateTransactionIds([1, 2], expenses);

      expect(result.uniqueTransactionIds).toEqual([100]);
      expect(result.skippedCount.invalid).toBe(1);
    });
  });

  describe('complex scenarios', () => {
    it('handles mix of valid, optimistic, missing, and invalid entries', () => {
      const expenses = [
        { id: -1, transactionId: -1 },   // Optimistic
        { id: 1, transactionId: 100 },   // Valid
        { id: 2, transactionId: 100 },   // Valid, same transaction
        { id: 3, transactionId: 0 },     // Invalid
        { id: 5, transactionId: 200 },   // Valid
      ];

      const result = deduplicateTransactionIds([-1, 1, 2, 3, 4, 5], expenses);

      expect(result.uniqueTransactionIds).toEqual([100, 200]);
      expect(result.skippedCount).toEqual({
        optimistic: 1,
        notFound: 1,    // ID 4
        invalid: 1,      // ID 3
      });
    });

    it('preserves order while deduplicating', () => {
      const expenses = [
        { id: 1, transactionId: 100 },
        { id: 2, transactionId: 200 },
        { id: 3, transactionId: 100 }, // Duplicate of first
      ];

      const result = deduplicateTransactionIds([1, 2, 3], expenses);

      // Set deduplication should give us [100, 200]
      expect(result.uniqueTransactionIds).toEqual([100, 200]);
    });

    it('handles empty selection', () => {
      const expenses = [
        { id: 1, transactionId: 100 },
      ];

      const result = deduplicateTransactionIds([], expenses);

      expect(result.uniqueTransactionIds).toEqual([]);
      expect(result.skippedCount).toEqual({
        optimistic: 0,
        notFound: 0,
        invalid: 0,
      });
    });

    it('handles large installment sets (12 months)', () => {
      // Simulate a 12-month installment plan (one transaction, 12 entries)
      const expenses = Array.from({ length: 12 }, (_, i) => ({
        id: i + 1,
        transactionId: 1000,
      }));

      const selectedIds = expenses.map((e) => e.id);
      const result = deduplicateTransactionIds(selectedIds, expenses);

      // Should deduplicate to single transaction
      expect(result.uniqueTransactionIds).toEqual([1000]);
      expect(result.uniqueTransactionIds.length).toBe(1);
      expect(result.skippedCount).toEqual({
        optimistic: 0,
        notFound: 0,
        invalid: 0,
      });
    });
  });

  describe('edge cases', () => {
    it('handles zero entries in expenses array', () => {
      const expenses: Array<{ id: number; transactionId: number }> = [];

      const result = deduplicateTransactionIds([1, 2, 3], expenses);

      expect(result.uniqueTransactionIds).toEqual([]);
      expect(result.skippedCount.notFound).toBe(3);
    });

    it('handles single valid entry', () => {
      const expenses = [{ id: 1, transactionId: 100 }];

      const result = deduplicateTransactionIds([1], expenses);

      expect(result.uniqueTransactionIds).toEqual([100]);
      expect(result.skippedCount).toEqual({
        optimistic: 0,
        notFound: 0,
        invalid: 0,
      });
    });
  });
});
