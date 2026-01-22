/**
 * Refund Matcher
 *
 * Matches refund candidates from OFX import to original transactions.
 *
 * Two matching strategies:
 * 1. FITID match (high confidence) - Same raw FITID prefix in externalId
 * 2. Description match (medium) - Extract merchant from "Crédito de "X"", find similar transactions
 */

import { db } from '@/lib/db';
import { transactions, entries } from '@/lib/schema';
import { eq, and, like, desc, sql } from 'drizzle-orm';
import type { ValidatedImportRow, RefundMatchInfo } from './types';

// Pattern to extract merchant name from "Crédito de "Merchant"" format
const CREDITO_DE_PATTERN = /^cr[eé]dito\s+de\s+"([^"]+)"/i;

/**
 * Extract merchant name from refund description
 * Example: "Crédito de "MERCADO PAGO*UBER"" -> "MERCADO PAGO*UBER"
 */
function extractMerchantFromRefund(description: string): string | null {
  const match = description.match(CREDITO_DE_PATTERN);
  return match ? match[1].trim() : null;
}

/**
 * Normalize description for fuzzy matching
 * Removes common variations and normalizes to lowercase
 */
function normalizeDescription(description: string): string {
  return description
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find transactions matching a FITID prefix
 * Nubank reuses FITIDs for refunds - we match on the raw FITID part before the amount suffix
 */
async function findByFitId(
  userId: string,
  rawFitId: string,
  accountId: number
): Promise<{ id: number; description: string; totalAmount: number; categoryId: number } | null> {
  // Query transactions with externalId starting with rawFitId
  // externalId format: "FITID-AMOUNT" (e.g., "20250116000001-18892")
  const results = await db
    .select({
      id: transactions.id,
      description: transactions.description,
      totalAmount: transactions.totalAmount,
      categoryId: transactions.categoryId,
      externalId: transactions.externalId,
    })
    .from(transactions)
    .innerJoin(entries, eq(entries.transactionId, transactions.id))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(entries.accountId, accountId),
        like(transactions.externalId, `${rawFitId}-%`)
      )
    )
    .orderBy(desc(transactions.createdAt))
    .limit(1);

  return results.length > 0 ? results[0] : null;
}

/**
 * Find transactions matching a merchant name (fuzzy)
 * Searches for transactions with similar descriptions
 */
async function findByDescription(
  userId: string,
  merchantName: string,
  accountId: number,
  refundAmount: number
): Promise<{ id: number; description: string; totalAmount: number; categoryId: number } | null> {
  // Normalize merchant name for comparison
  const normalizedMerchant = normalizeDescription(merchantName);

  // Query recent transactions (last 180 days) from the same account
  // that might match this refund
  const results = await db
    .select({
      id: transactions.id,
      description: transactions.description,
      totalAmount: transactions.totalAmount,
      categoryId: transactions.categoryId,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .innerJoin(entries, eq(entries.transactionId, transactions.id))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(entries.accountId, accountId),
        sql`LOWER(${transactions.description}) LIKE ${`%${normalizedMerchant}%`}`
      )
    )
    .orderBy(desc(transactions.createdAt))
    .limit(10);

  // Score each result by description similarity and amount proximity
  let bestMatch: typeof results[0] | null = null;
  let bestScore = 0;

  for (const result of results) {
    const normalizedDesc = normalizeDescription(result.description);

    // Simple similarity: how much of the merchant name appears in the description
    const similarity = normalizedMerchant.length > 0
      ? normalizedDesc.includes(normalizedMerchant) ? 1.0 : 0.0
      : 0.0;

    // Amount proximity (closer amounts = higher score)
    // Allow for partial refunds
    const amountRatio = Math.min(refundAmount, result.totalAmount) / Math.max(refundAmount, result.totalAmount);

    // Combined score (60% similarity, 40% amount proximity)
    const score = similarity * 0.6 + amountRatio * 0.4;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = result;
    }
  }

  // Only return if score is reasonably high (> 0.5)
  return bestScore > 0.5 ? bestMatch : null;
}

/**
 * Find matching transaction for a refund candidate
 * Returns match info if found, null otherwise
 */
export async function findRefundMatch(
  userId: string,
  accountId: number,
  row: ValidatedImportRow
): Promise<RefundMatchInfo | null> {
  // Only process refund candidates
  if (!row.isRefundCandidate || row.type !== 'income') {
    return null;
  }

  // Strategy 1: FITID match (high confidence)
  if (row.rawFitId) {
    const fitIdMatch = await findByFitId(userId, row.rawFitId, accountId);
    if (fitIdMatch) {
      return {
        matchedTransactionId: fitIdMatch.id,
        matchedDescription: fitIdMatch.description,
        matchConfidence: 'high',
        matchReason: 'Mesmo FITID da transação original',
      };
    }
  }

  // Strategy 2: Description match (medium confidence)
  const merchantName = extractMerchantFromRefund(row.description);
  if (merchantName) {
    const descMatch = await findByDescription(userId, merchantName, accountId, row.amountCents);
    if (descMatch) {
      return {
        matchedTransactionId: descMatch.id,
        matchedDescription: descMatch.description,
        matchConfidence: 'medium',
        matchReason: `Estabelecimento semelhante: "${merchantName}"`,
      };
    }
  }

  return null;
}

/**
 * Find matches for multiple refund candidates in parallel
 */
export async function findRefundMatches(
  userId: string,
  accountId: number,
  rows: ValidatedImportRow[]
): Promise<Map<number, RefundMatchInfo>> {
  const matches = new Map<number, RefundMatchInfo>();

  // Process refund candidates in parallel
  const refundCandidates = rows.filter(row => row.isRefundCandidate && row.type === 'income');

  const matchResults = await Promise.all(
    refundCandidates.map(row => findRefundMatch(userId, accountId, row))
  );

  // Build map of rowIndex -> match info
  refundCandidates.forEach((row, index) => {
    const matchInfo = matchResults[index];
    if (matchInfo) {
      matches.set(row.rowIndex, matchInfo);
    }
  });

  return matches;
}
