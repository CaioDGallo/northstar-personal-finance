export type InstallmentInfo = {
  current: number; // X from "Parcela X/Y"
  total: number; // Y from "Parcela X/Y"
  baseDescription: string; // Description without "- Parcela X/Y"
};

export type ValidatedImportRow = {
  date: string; // YYYY-MM-DD
  description: string;
  amountCents: number;
  rowIndex: number;
  externalId?: string; // UUID from bank statement for idempotency
  type?: 'expense' | 'income'; // Determined from amount sign
  installmentInfo?: InstallmentInfo; // Parsed installment data if present
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
};

export type ImportTemplate = {
  id: string;
  name: string;
  description: string;
  nameKey?: string;
  descriptionKey?: string;
  parse: (content: string) => ParseResult;
};

export type CategorySuggestion = {
  id: number;
  name: string;
  color: string;
};

export type ImportRowWithSuggestion = ValidatedImportRow & {
  suggestedCategory?: CategorySuggestion;
};
