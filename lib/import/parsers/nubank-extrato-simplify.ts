/**
 * Simplifies Nubank extrato descriptions by extracting meaningful names/payees.
 * Patterns are case and accent insensitive.
 */

type SimplifyResult = {
  simplified: string;
  matched: boolean;
};

/**
 * Normalize text for pattern matching: lowercase + remove accents
 * Uses NFD decomposition to separate accents, then strips combining marks
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Extract first segment before " - " separator (name part)
 */
function extractFirstSegment(raw: string, prefixEnd: number): string {
  const remaining = raw.slice(prefixEnd);
  const dashIndex = remaining.indexOf(' - ');
  return dashIndex > 0 ? remaining.slice(0, dashIndex).trim() : remaining.trim();
}

/**
 * Pattern definitions with extraction logic
 */
const PATTERNS: Array<{
  prefix: string; // normalized prefix to match
  extract: (raw: string, prefixEnd: number) => string;
}> = [
  // Pix transfers (both directions)
  {
    prefix: 'transferencia enviada pelo pix - ',
    extract: (raw, prefixEnd) => extractFirstSegment(raw, prefixEnd),
  },
  {
    prefix: 'transferencia recebida pelo pix - ',
    extract: (raw, prefixEnd) => extractFirstSegment(raw, prefixEnd),
  },
  // Legacy transfers (non-Pix)
  {
    prefix: 'transferencia recebida - ',
    extract: (raw, prefixEnd) => extractFirstSegment(raw, prefixEnd),
  },
  // Boleto payment
  {
    prefix: 'pagamento de boleto efetuado - ',
    extract: (raw, prefixEnd) => raw.slice(prefixEnd).trim(),
  },
  // Credit card top-up (keep short form)
  {
    prefix: 'valor adicionado na conta por cartao de credito - ',
    extract: () => 'Pix no Credito', // Fixed simplification
  },
];

/**
 * Simplify a Nubank extrato description by extracting the meaningful part
 * @param raw Raw description from CSV
 * @returns Simplified description and whether a pattern matched
 */
export function simplifyDescription(raw: string): SimplifyResult {
  const normalized = normalize(raw);

  for (const pattern of PATTERNS) {
    if (normalized.startsWith(pattern.prefix)) {
      const prefixEnd = pattern.prefix.length;
      return {
        simplified: pattern.extract(raw, prefixEnd),
        matched: true,
      };
    }
  }

  // "Pagamento de fatura" - already simple, no change needed
  if (normalized === 'pagamento de fatura') {
    return { simplified: raw, matched: true };
  }

  // Unknown pattern - keep original
  return { simplified: raw, matched: false };
}
