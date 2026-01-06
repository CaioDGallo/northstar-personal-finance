export type ValidatedImportRow = {
  date: string; // YYYY-MM-DD
  description: string;
  amountCents: number;
  rowIndex: number;
  externalId?: string; // UUID from bank statement for idempotency
  type?: 'expense' | 'income'; // Determined from amount sign
};

export type ImportRowError = {
  rowIndex: number;
  field: 'date' | 'description' | 'amount' | 'identifier';
  message: string;
  rawValue: string;
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
  parse: (content: string) => ParseResult;
};
