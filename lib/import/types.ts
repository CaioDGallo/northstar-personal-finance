export type InstallmentInfo = {
  current: number; // X from "Parcela X/Y"
  total: number; // Y from "Parcela X/Y"
  baseDescription: string; // Description without "- Parcela X/Y"
};

export type RefundMatchInfo = {
  matchedTransactionId?: number; // ID of the original transaction being refunded
  matchedDescription?: string; // Description of matched transaction for display
  matchConfidence: 'high' | 'medium'; // High = FITID match, Medium = description match
  matchReason: string; // Human-readable explanation of match
};

export type ValidatedImportRow = {
  date: string; // YYYY-MM-DD
  description: string;
  amountCents: number;
  rowIndex: number;
  externalId?: string; // UUID from bank statement for idempotency
  rawFitId?: string; // Original FITID from OFX (for refund matching)
  type?: 'expense' | 'income' | 'payment'; // Determined from amount sign and description patterns
  installmentInfo?: InstallmentInfo; // Parsed installment data if present
  isRefundCandidate?: boolean; // True if description matches refund patterns
  refundMatchInfo?: RefundMatchInfo; // Information about matched refund transaction
};

export type ImportRowError = {
  rowIndex: number;
  field: 'date' | 'description' | 'amount' | 'identifier';
  message: string;
  rawValue: string;
  messageKey?: string;
};

export type ParseResult = {
  rows: ValidatedImportRow[];
  errors: ImportRowError[];
  skipped: number;
  metadata?: {
    statementStart?: string; // YYYY-MM-DD
    statementEnd?: string; // YYYY-MM-DD (closing date)
  };
};

export type ImportTemplate = {
  id: string;
  name: string;
  description: string;
  nameKey?: string;
  descriptionKey?: string;
  fileType: 'csv' | 'ofx';
  parse: (content: string) => ParseResult;
};

export type CategorySuggestion = {
  id: number;
  name: string;
  color: string;
};

export type ImportRowWithSuggestion = ValidatedImportRow & {
  suggestedCategory?: CategorySuggestion;
  isDuplicate?: boolean;
};
