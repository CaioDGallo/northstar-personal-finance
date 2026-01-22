# Fatura Total Discrepancy - Root Cause Analysis

## Problem Summary

December and January fatura totals in the app didn't match OFX LEDGERBAL:

| Month | App Total | OFX LEDGERBAL | Discrepancy |
|-------|-----------|---------------|-------------|
| December 2025 | 7491.22 | 7691.23 | **-200.01** |
| January 2026 | 4803.94 | 4977.14 | **-173.20** |

## Root Causes

### 1. Account `closingDay` vs Actual OFX Closing Dates

**The Issue:**

- Account configured with `closingDay = 2` (billing closes on the 2nd of each month)
- Actual OFX files close on **different dates**:
  - November: closes on `2025-11-01` (not Nov 2)
  - December: closes on `2025-12-01` (not Dec 2)
  - January: closes on `2026-01-01` (not Jan 2)

**Why This Happens:**
Banks adjust closing dates for weekends, holidays, or other reasons. The account's `closingDay` is a default/preference, but the **actual OFX closing date** should take precedence.

**Impact:**
When the import logic uses `getFaturaMonth(date, closingDay)` with `closingDay = 2`, transactions dated on the 1st are assigned to the PREVIOUS month's fatura. But the OFX file that closes on the 1st includes those transactions, creating a mismatch.

### 2. Fatura `startDate` Overlap

**The Issue:**

- December fatura: `startDate = 2025-11-01`, `closingDate = 2025-12-01`
- January fatura: `startDate = 2025-12-01`, `closingDate = 2026-01-01`

The startDate should be the day **after** the previous fatura's closing date:

- ❌ December closes 12/1, January starts 12/1 (overlap!)
- ✅ December closes 12/1, January starts 12/2 (correct)

**Impact:**
Transactions on `2025-12-01` could ambiguously belong to either December or January.

### 3. Out-of-Range Entries

Entries were imported with dates outside the OFX billing period:

- November OFX: `2025-10-12` to `2025-11-01`
- Database November entries: `2025-10-03` to `2025-11-02` (includes 9 extra days!)

**Why This Happened:**
Likely from a previous import that used the account's `closingDay` instead of the actual OFX dates, or from manual entry/testing.

## How the System Should Work

### OFX Import Flow (Correct Behavior)

```
1. User uploads OFX file
2. Parser extracts:
   - Transactions
   - DTSTART (statement start date)
   - DTEND (statement end date / closing date)

3. UI component (import-modal.tsx):
   - Reads parseResult.metadata.statementEnd
   - Sets closingDate state
   - Passes faturaOverrides: { closingDate } to import action

4. Import action (import.ts):
   - Uses getFaturaMonthFromClosingDate(date, closingDate) when faturaOverrides.closingDate exists
   - Otherwise falls back to getFaturaMonth(date, account.closingDay)

5. Fatura creation:
   - ensureFaturaExists() called with closingDate override
   - Fatura record stores actual OFX closing date
   - startDate calculated as prevFatura.closingDate + 1 day
```

### Key Functions

**`getFaturaMonth(purchaseDate, closingDay)`**

- Simple rule: `day <= closingDay` → current month, else next month
- Used when no OFX closing date available
- **Problem:** Doesn't account for actual bank closing date variations

**`getFaturaMonthFromClosingDate(purchaseDate, closingDate)`**

- Compares purchase date to actual OFX closing date
- `purchaseDate <= closingDate` → this fatura, else next fatura
- **Correct:** Uses actual billing period from bank

## Why Current Data Has Issues

The existing test data was likely imported via:

1. Manual API testing without faturaOverrides
2. Early imports before the OFX metadata handling was fully implemented
3. Testing with account defaults instead of actual OFX dates

### 📝 Recommended Improvements

1. **Make OFX closing date required for credit card imports**:

   ```typescript
   // In import-modal.tsx handleImport()
   if (account.type === 'credit_card' && !closingDate) {
     toast.error('OFX closing date required for credit card imports');
     return;
   }
   ```

2. **Add validation to prevent out-of-range entries**:

   ```typescript
   // In import action
   if (faturaOverrides?.closingDate && faturaOverrides?.startDate) {
     const inRange = purchaseDate >= startDate && purchaseDate <= closingDate;
     if (!inRange) {
       // Skip or warn about out-of-range transaction
     }
   }
   ```

3. **Audit fatura startDate consistency**:
   - Add migration to ensure `startDate = prevFatura.closingDate + 1 day`
   - Add database constraint or check function

4. **UI improvements**:
   - Show warning if user tries to override closing date
   - Display OFX date range in import preview
   - Highlight transactions outside the OFX date range

## Verification Steps

After importing new OFX files, verify:

```sql
-- 1. Check fatura totals match OFX LEDGERBAL
SELECT year_month, total_amount / 100.0 as total
FROM faturas
WHERE year_month IN ('2025-12', '2026-01');

-- 2. Check no entries outside OFX date range
SELECT f.year_month, MIN(e.purchase_date), MAX(e.purchase_date),
       f.start_date, f.closing_date
FROM faturas f
JOIN entries e ON e.fatura_month = f.year_month AND e.account_id = f.account_id
WHERE f.year_month IN ('2025-12', '2026-01')
GROUP BY f.year_month, f.start_date, f.closing_date;

-- 3. Check no overlapping startDate/closingDate
SELECT year_month, start_date, closing_date,
       LAG(closing_date) OVER (ORDER BY year_month) as prev_closing
FROM faturas
ORDER BY year_month;
```

## Future Prevention

### For Developers

1. **Always** use the OFX closing date when importing credit card transactions
2. **Never** manually adjust fatura months without checking OFX date ranges
3. **Test** imports with real OFX files, not manually created data

### For Users

1. **Always** import complete OFX files (don't manually filter transactions)
2. **Review** the date range shown in import preview
3. **Report** any discrepancies between app totals and bank statements immediately

## Related Files

- `/lib/import/parsers/ofx-parser.ts` - OFX parsing with metadata extraction
- `/lib/actions/import.ts` - Import logic with faturaOverrides support
- `/components/import/import-modal.tsx` - UI with OFX metadata handling
- `/lib/fatura-utils.ts` - Fatura month calculation functions
- `/lib/actions/faturas.ts` - Fatura CRUD operations
