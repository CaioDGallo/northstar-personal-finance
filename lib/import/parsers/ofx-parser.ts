/**
 * OFX (Open Financial Exchange) parser utility
 * Parses OFX SGML format transactions
 */

export type OFXTransaction = {
  date: string; // YYYY-MM-DD
  amount: number; // In cents (signed: negative = expense, positive = income)
  description: string;
  externalId: string; // FITID from OFX
  trnType: 'DEBIT' | 'CREDIT';
};

/**
 * Parse OFX date format (YYYYMMDDHHMMSS[TZ]) to YYYY-MM-DD
 * Example: "20260116000000[-3:BRT]" -> "2026-01-16"
 */
function parseOFXDate(dateStr: string): string | null {
  // Extract YYYYMMDD from YYYYMMDDHHMMSS[TZ] format
  const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;

  const [, year, month, day] = match;
  return `${year}-${month}-${day}`;
}

/**
 * Parse OFX amount to cents
 * OFX amounts are in decimal format (e.g., "-204.11" or "4977.15")
 */
function parseOFXAmount(amountStr: string): number | null {
  const amount = parseFloat(amountStr);
  if (isNaN(amount)) return null;

  // Convert to cents (multiply by 100 and round to avoid floating point issues)
  return Math.round(amount * 100);
}

/**
 * Extract transactions from OFX SGML content
 * Returns array of parsed transactions
 */
export function parseOFXTransactions(content: string): OFXTransaction[] {
  const transactions: OFXTransaction[] = [];

  // Match all <STMTTRN>...</STMTTRN> blocks
  // OFX is SGML, not XML, so we use regex instead of XML parser
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
  const matches = content.matchAll(stmtTrnRegex);

  for (const match of matches) {
    const block = match[1];

    // Extract fields from the transaction block
    const trnTypeMatch = block.match(/<TRNTYPE>(.*?)<\/TRNTYPE>/);
    const dtPostedMatch = block.match(/<DTPOSTED>(.*?)<\/DTPOSTED>/);
    const trnAmtMatch = block.match(/<TRNAMT>(.*?)<\/TRNAMT>/);
    const fitIdMatch = block.match(/<FITID>(.*?)<\/FITID>/);
    const memoMatch = block.match(/<MEMO>(.*?)<\/MEMO>/);

    // Skip if missing required fields
    if (!dtPostedMatch || !trnAmtMatch || !fitIdMatch || !memoMatch) {
      continue;
    }

    const trnType = trnTypeMatch?.[1] as 'DEBIT' | 'CREDIT' | undefined;
    const date = parseOFXDate(dtPostedMatch[1]);
    const amountCents = parseOFXAmount(trnAmtMatch[1]);
    const externalId = fitIdMatch[1];
    const description = memoMatch[1].trim();

    // Validate parsed data
    if (!date || amountCents === null || !externalId || !description || !trnType) {
      continue;
    }

    // Create composite externalId to handle Nubank's FITID reuse issue
    // (IOF charges share FITIDs with their parent transactions)
    const compositeExternalId = `${externalId}-${amountCents}`;

    transactions.push({
      date,
      amount: amountCents,
      description,
      externalId: compositeExternalId,
      trnType,
    });
  }

  return transactions;
}
