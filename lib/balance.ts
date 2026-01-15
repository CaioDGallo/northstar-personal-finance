/**
 * Pure balance computation function
 *
 * This function encapsulates the core balance formula used throughout the app.
 * Having it as a pure function makes it trivially testable and enables
 * balance projections/simulations without database access.
 *
 * Formula: balance = totalIncome + transfersIn - transfersOut - expenses
 *
 * Note: totalReceivedIncome should only include income with receivedAt IS NOT NULL
 */
export function computeBalance(data: {
  totalExpenses: number;
  totalReceivedIncome: number;
  totalTransfersIn: number;
  totalTransfersOut: number;
}): number {
  return (
    data.totalReceivedIncome + data.totalTransfersIn - data.totalTransfersOut - data.totalExpenses
  );
}
