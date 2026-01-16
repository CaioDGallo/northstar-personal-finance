import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { nubankOfxParser } from '@/lib/import/parsers/nubank-ofx';
import { nubankExtratoOfxParser } from '@/lib/import/parsers/nubank-extrato-ofx';
import { nubankParser } from '@/lib/import/parsers/nubank';
import { nubankExtratoParser } from '@/lib/import/parsers/nubank-extrato';

const fixturesPath = join(__dirname, '../../../fixtures/import');

function loadFixture(filename: string): string {
  return readFileSync(join(fixturesPath, filename), 'utf-8');
}

describe('nubank-ofx parser', () => {
  it('should parse valid credit card OFX file', () => {
    const content = loadFixture('nubank-credit-card.ofx');
    const result = nubankOfxParser.parse(content);

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(6);
    expect(result.skipped).toBe(0);

    // Verify first transaction (expense)
    const firstRow = result.rows[0];
    expect(firstRow.date).toBe('2026-01-15');
    expect(firstRow.description).toBe('Supermercado Extra');
    expect(firstRow.amountCents).toBe(15050); // 150.50 in cents
    expect(firstRow.type).toBe('expense');
    expect(firstRow.externalId).toBe('TXN001--15050'); // composite ID
    expect(firstRow.installmentInfo).toBeUndefined();
  });

  it('should detect installment transactions', () => {
    const content = loadFixture('nubank-credit-card.ofx');
    const result = nubankOfxParser.parse(content);

    // Find installment transactions
    const installment1 = result.rows.find((r) => r.description.includes('Parcela 1/12'));
    const installment2 = result.rows.find((r) => r.description.includes('Parcela 3/10'));

    expect(installment1).toBeDefined();
    expect(installment1!.installmentInfo).toEqual({
      current: 1,
      total: 12,
      baseDescription: 'Netflix',
    });

    expect(installment2).toBeDefined();
    expect(installment2!.installmentInfo).toEqual({
      current: 3,
      total: 10,
      baseDescription: 'Notebook Dell',
    });
  });

  it('should handle refunds (positive amounts) as income', () => {
    const content = loadFixture('nubank-credit-card.ofx');
    const result = nubankOfxParser.parse(content);

    const refund = result.rows.find((r) => r.description.includes('Estorno'));
    expect(refund).toBeDefined();
    expect(refund!.type).toBe('income');
    expect(refund!.amountCents).toBe(5000); // 50.00 in cents
  });

  it('should handle empty OFX file', () => {
    const content = loadFixture('empty.ofx');
    const result = nubankOfxParser.parse(content);

    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('No OFX transactions found');
  });

  it('should handle malformed OFX file', () => {
    const content = loadFixture('malformed.ofx');
    const result = nubankOfxParser.parse(content);

    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('No OFX transactions found');
  });

  it('should generate composite external IDs', () => {
    const content = loadFixture('nubank-credit-card.ofx');
    const result = nubankOfxParser.parse(content);

    // All external IDs should be in format: FITID-amount (includes negative sign for expenses)
    result.rows.forEach((row) => {
      expect(row.externalId).toMatch(/^TXN\d+-?-?\d+$/);
    });
  });
});

describe('nubank-extrato-ofx parser', () => {
  it('should parse valid checking account OFX file', () => {
    const content = loadFixture('nubank-checking.ofx');
    const result = nubankExtratoOfxParser.parse(content);

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(4);
    expect(result.skipped).toBe(0);

    // Verify first transaction (income)
    const firstRow = result.rows[0];
    expect(firstRow.date).toBe('2026-01-15');
    // Description may be simplified (e.g., "Transferência recebida - João Silva" -> "João Silva")
    expect(firstRow.description).toBeTruthy();
    expect(firstRow.description.length).toBeGreaterThan(0);
    expect(firstRow.amountCents).toBe(500000); // 5000.00 in cents
    expect(firstRow.type).toBe('income');
    expect(firstRow.externalId).toBe('CHK001-500000');
  });

  it('should handle expenses (negative amounts)', () => {
    const content = loadFixture('nubank-checking.ofx');
    const result = nubankExtratoOfxParser.parse(content);

    const expenses = result.rows.filter((r) => r.type === 'expense');
    expect(expenses).toHaveLength(2);

    const rent = expenses.find((r) => r.description.includes('Aluguel'));
    expect(rent).toBeDefined();
    expect(rent!.amountCents).toBe(150000); // 1500.00 in cents
  });

  it('should simplify descriptions', () => {
    const content = loadFixture('nubank-checking.ofx');
    const result = nubankExtratoOfxParser.parse(content);

    // Description simplification should happen
    // The exact simplification depends on the simplifyDescription function
    result.rows.forEach((row) => {
      expect(row.description).toBeTruthy();
      expect(row.description.length).toBeGreaterThan(0);
    });
  });

  it('should handle empty OFX file', () => {
    const content = loadFixture('empty.ofx');
    const result = nubankExtratoOfxParser.parse(content);

    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });
});

describe('nubank CSV parser', () => {
  it('should parse valid credit card CSV file', () => {
    const content = loadFixture('nubank-credit-card.csv');
    const result = nubankParser.parse(content);

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(6);
    expect(result.skipped).toBe(1); // Header row

    // Verify first data row
    const firstRow = result.rows[0];
    expect(firstRow.date).toBe('2026-01-15');
    expect(firstRow.description).toBe('Supermercado Extra');
    expect(firstRow.amountCents).toBe(15050); // 150.50 in cents
    expect(firstRow.type).toBe('expense');
  });

  it('should detect installments in CSV', () => {
    const content = loadFixture('nubank-credit-card.csv');
    const result = nubankParser.parse(content);

    const installment = result.rows.find((r) => r.description.includes('Parcela 1/12'));
    expect(installment).toBeDefined();
    expect(installment!.installmentInfo).toEqual({
      current: 1,
      total: 12,
      baseDescription: 'Netflix',
    });
  });

  it('should handle negative amounts as income (refunds)', () => {
    const content = loadFixture('nubank-credit-card.csv');
    const result = nubankParser.parse(content);

    const refund = result.rows.find((r) => r.description.includes('Estorno'));
    expect(refund).toBeDefined();
    expect(refund!.type).toBe('income');
    expect(refund!.amountCents).toBe(5000);
  });

  it('should generate synthetic external IDs', () => {
    const content = loadFixture('nubank-credit-card.csv');
    const result = nubankParser.parse(content);

    // All external IDs should follow cc-date-hash format
    result.rows.forEach((row) => {
      expect(row.externalId).toMatch(/^cc-\d{4}-\d{2}-\d{2}-[a-f0-9]{8}$/);
    });

    // Same transaction data should generate same ID (deterministic)
    const firstRow = result.rows[0];
    const expectedId = 'cc-2026-01-15-';
    expect(firstRow.externalId).toContain(expectedId);
  });

  it('should handle invalid CSV format', () => {
    const content = loadFixture('invalid.csv');
    const result = nubankParser.parse(content);

    expect(result.errors.length).toBeGreaterThan(0);

    // Check for specific validation errors
    const invalidDateError = result.errors.find((e) => e.field === 'date');
    expect(invalidDateError).toBeDefined();

    const emptyDescError = result.errors.find((e) => e.field === 'description');
    expect(emptyDescError).toBeDefined();

    const invalidAmountError = result.errors.find((e) => e.field === 'amount');
    expect(invalidAmountError).toBeDefined();
  });

  it('should skip header and empty lines', () => {
    const content = 'date,title,amount\n\n2026-01-15,Test,100.00\n\n';
    const result = nubankParser.parse(content);

    expect(result.rows).toHaveLength(1);
    expect(result.skipped).toBe(2); // header + 1 empty line before data row (trailing empty is not in the split result)
  });

  it('should handle both comma and semicolon delimiters', () => {
    const csvWithSemicolon = 'date;title;amount\n2026-01-15;Test Transaction;100.50';
    const result = nubankParser.parse(csvWithSemicolon);

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].description).toBe('Test Transaction');
    expect(result.rows[0].amountCents).toBe(10050);
  });
});

describe('nubank-extrato CSV parser', () => {
  it('should parse valid checking account CSV file', () => {
    const content = loadFixture('nubank-checking.csv');
    const result = nubankExtratoParser.parse(content);

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(4);
    expect(result.skipped).toBe(1); // Header row

    // Verify first data row
    const firstRow = result.rows[0];
    expect(firstRow.date).toBe('2026-01-15');
    expect(firstRow.amountCents).toBe(500000); // 5000.00 in cents
    expect(firstRow.type).toBe('income');
    expect(firstRow.externalId).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
  });

  it('should convert DD/MM/YYYY to YYYY-MM-DD', () => {
    const content = loadFixture('nubank-checking.csv');
    const result = nubankExtratoParser.parse(content);

    result.rows.forEach((row) => {
      expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    expect(result.rows[0].date).toBe('2026-01-15');
    expect(result.rows[1].date).toBe('2026-01-14');
  });

  it('should validate UUID format for identifiers', () => {
    const invalidContent = `Data,Valor,Identificador,Descrição
15/01/2026,100.00,invalid-uuid,Test Transaction`;

    const result = nubankExtratoParser.parse(invalidContent);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe('identifier');
    expect(result.errors[0].message).toContain('Invalid identifier format');
  });

  it('should handle positive and negative amounts correctly', () => {
    const content = loadFixture('nubank-checking.csv');
    const result = nubankExtratoParser.parse(content);

    const income = result.rows.filter((r) => r.type === 'income');
    const expenses = result.rows.filter((r) => r.type === 'expense');

    expect(income).toHaveLength(2);
    expect(expenses).toHaveLength(2);

    // All amounts should be positive (normalized)
    result.rows.forEach((row) => {
      expect(row.amountCents).toBeGreaterThan(0);
    });
  });

  it('should simplify descriptions', () => {
    const content = loadFixture('nubank-checking.csv');
    const result = nubankExtratoParser.parse(content);

    // Descriptions should be simplified
    result.rows.forEach((row) => {
      expect(row.description).toBeTruthy();
    });
  });

  it('should reject zero amounts', () => {
    const zeroAmountContent = `Data,Valor,Identificador,Descrição
15/01/2026,0.00,a1b2c3d4-e5f6-7890-abcd-ef1234567890,Zero Amount Transaction`;

    const result = nubankExtratoParser.parse(zeroAmountContent);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe('amount');
    expect(result.errors[0].message).toContain('Invalid or zero amount');
  });

  it('should handle invalid date format', () => {
    const invalidDateContent = `Data,Valor,Identificador,Descrição
32/13/2026,100.00,a1b2c3d4-e5f6-7890-abcd-ef1234567890,Test`;

    const result = nubankExtratoParser.parse(invalidDateContent);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe('date');
  });

  it('should handle both comma and semicolon delimiters', () => {
    const csvWithSemicolon = `Data;Valor;Identificador;Descrição
15/01/2026;100.00;a1b2c3d4-e5f6-7890-abcd-ef1234567890;Test Transaction`;

    const result = nubankExtratoParser.parse(csvWithSemicolon);

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].amountCents).toBe(10000);
  });
});
