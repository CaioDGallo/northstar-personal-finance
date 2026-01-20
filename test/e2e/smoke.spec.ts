import { type Page, type Locator } from '@playwright/test';
import { test, expect } from '@/test/fixtures';

const TEST_EMAIL = 'e2e@example.com';
const TEST_PASSWORD = 'Password123';

const ACCOUNT_NAME = 'Conta E2E';
const EXPENSE_CATEGORY = 'Alimentação E2E';
const INCOME_CATEGORY = 'Salário E2E';

function getYearMonth(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function addMonths(yearMonth: string, offset: number): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  date.setMonth(date.getMonth() + offset);
  return getYearMonth(date);
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(TEST_EMAIL);
  await page.getByLabel('Senha').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Visão Geral' })).toBeVisible();
}

async function createAccount(
  page: Page,
  name: string,
  options: {
    type?: 'credit_card' | 'checking' | 'savings' | 'cash';
    initialBalance?: string;
    creditLimit?: string;
    closingDay?: string;
    paymentDueDay?: string;
  } = {}
) {
  const {
    type = 'checking',
    initialBalance = '0',
    creditLimit = '5000',
    closingDay = '1',
    paymentDueDay = '10',
  } = options;

  await page.goto('/settings/accounts');
  await page.getByRole('button', { name: 'Adicionar Conta' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Nome').fill(name);

  // Select account type if not default
  if (type !== 'checking') {
    await dialog.getByLabel('Tipo').click();
    const typeMap = {
      credit_card: 'Cartão de crédito',
      checking: 'Conta corrente',
      savings: 'Poupança',
      cash: 'Dinheiro',
    };
    await page.getByRole('option', { name: typeMap[type] }).first().click();
  }

  // Fill initial balance (required for all account types)
  await dialog.getByLabel('Saldo Inicial').fill(initialBalance);

  // Fill credit card specific fields if type is credit_card
  if (type === 'credit_card') {
    await expect(dialog.getByLabel('Dia do Fechamento (1-28)')).toBeVisible();
    await dialog.getByLabel('Dia do Fechamento (1-28)').click();
    await page.getByRole('option', { name: closingDay }).first().click();
    await dialog.getByLabel('Dia do Vencimento (1-28)').click();
    await page.getByRole('option', { name: paymentDueDay }).first().click();
    await dialog.getByLabel('Limite de Crédito').pressSequentially(creditLimit);
  }

  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name }).first()).toBeVisible();
}

async function createCategory(page: Page, heading: string, name: string) {
  await page.goto('/settings/categories');
  const section = page.getByRole('heading', { name: heading }).locator('..');
  await section.getByRole('button', { name: 'Adicionar' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Nome').fill(name);
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name }).first()).toBeVisible();
}

async function clearCurrencyInput(input: Locator) {
  await input.click();
  while ((await input.inputValue()) !== 'R$ 0,00') {
    await input.press('Backspace');
  }
}

async function fillCurrencyInput(input: Locator, amount: string) {
  await clearCurrencyInput(input);
  const numericAmount = Number(amount);
  const cents = String(Math.round(numericAmount * 100));
  await input.pressSequentially(cents);
}

async function expectCurrencyValue(input: Locator, amount: string) {
  const numericAmount = Number(amount);
  const formatted = `R$ ${numericAmount.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  await expect(input).toHaveValue(formatted);
}

async function setCategoryBudget(page: Page, categoryName: string, amount: string) {
  await page.goto('/settings/budgets');
  const row = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText(categoryName, { exact: true }) })
    .first();
  const input = row.locator('input[data-slot="input"]');

  await fillCurrencyInput(input, amount);
  await input.blur();
  await expectCurrencyValue(input, amount);
}

test('login redirects to dashboard', async ({ page }) => {
  await login(page);
});

test('create account, category, and expense installments', async ({ page }) => {
  await login(page);

  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Despesa', EXPENSE_CATEGORY);
  await setCategoryBudget(page, EXPENSE_CATEGORY, '1000');

  await page.goto('/expenses');
  await page.getByRole('button', { name: 'Despesa' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await fillCurrencyInput(dialog.getByLabel('Valor'), '300');
  await dialog.getByLabel('Descrição').fill('Mercado E2E');
  await dialog.getByLabel('Categoria').click();
  await page.getByRole('option', { name: EXPENSE_CATEGORY }).first().click();
  await dialog.getByLabel('Conta').click();
  await page.getByRole('option', { name: ACCOUNT_NAME }).first().click();
  await page.waitForTimeout(300);

  const slider = dialog.getByRole('slider');
  await slider.focus();
  await slider.press('ArrowRight');
  await slider.press('ArrowRight');

  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  const currentMonth = getYearMonth();
  const months = [currentMonth, addMonths(currentMonth, 1), addMonths(currentMonth, 2)];

  for (const month of months) {
    await page.goto(`/expenses?month=${month}`);
    await expect(page.locator('h3', { hasText: 'Mercado E2E' }).first()).toBeVisible();
  }

  await page.goto(`/dashboard?month=${currentMonth}`);
  const expensesBlock = page
    .locator('[data-slot="balance-summary"]')
    .locator('div', { hasText: 'Total de Despesas' })
    .first();
  await expect(expensesBlock).toContainText(/R\$\s*100,00/);
});

test('create income updates dashboard net balance', async ({ page }) => {
  await login(page);

  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Despesa', EXPENSE_CATEGORY);
  await createCategory(page, 'Categorias de Receita', INCOME_CATEGORY);
  await setCategoryBudget(page, EXPENSE_CATEGORY, '2000');

  await page.goto('/income');
  await page.getByRole('button', { name: 'Receita' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await fillCurrencyInput(dialog.getByLabel('Valor'), '500');
  await dialog.getByLabel('Descrição').fill('Salário E2E');
  await dialog.getByLabel('Categoria').click();
  await page.getByRole('option', { name: INCOME_CATEGORY }).first().click();
  await dialog.getByLabel('Conta').click();
  await page.getByRole('option', { name: ACCOUNT_NAME }).first().click();
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  const currentMonth = getYearMonth();
  await page.goto(`/dashboard?month=${currentMonth}`);
  const netBlock = page
    .locator('[data-slot="balance-summary"]')
    .locator('div', { hasText: 'Saldo Líquido' })
    .first();
  await expect(netBlock).toContainText(/R\$\s*500,00/);
});

test('create transfer updates cash flow report', async ({ page }) => {
  await login(page);

  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Despesa', EXPENSE_CATEGORY);
  await setCategoryBudget(page, EXPENSE_CATEGORY, '1500');

  await page.goto('/transfers');
  await page.getByRole('button', { name: 'Adicionar Transferência' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();

  await dialog.getByLabel('Tipo').click();
  await page.getByRole('option', { name: 'Depósito' }).first().click();
  await fillCurrencyInput(dialog.getByLabel('Valor'), '200');
  await dialog.getByLabel('Descrição').fill('Depósito E2E');
  await dialog.getByLabel('Conta de destino').click();
  await page.getByRole('option', { name: ACCOUNT_NAME }).first().click();
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByText('Depósito E2E').first()).toBeVisible();

  const currentMonth = getYearMonth();
  await page.goto(`/dashboard?month=${currentMonth}`);
  const transfersBlock = page
    .locator('[data-slot="cash-flow-report"]')
    .locator('div', { hasText: 'Transferências de entrada' })
    .first();
  await expect(transfersBlock).toContainText(/R\$\s*200,00/);
});

test('ignore expense removes it from totals', async ({ page }) => {
  await login(page);

  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Despesa', EXPENSE_CATEGORY);
  await setCategoryBudget(page, EXPENSE_CATEGORY, '1000');

  // Create an expense
  await page.goto('/expenses');
  await page.getByRole('button', { name: 'Despesa' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Adicionar Despesa' });
  await expect(dialog).toBeVisible();
  await fillCurrencyInput(dialog.getByLabel('Valor'), '250');
  await dialog.getByLabel('Descrição').fill('Mercado Ignorar E2E');
  await dialog.getByLabel('Categoria').click();
  await page.getByRole('option', { name: EXPENSE_CATEGORY }).first().click();
  await dialog.getByLabel('Conta').click();
  await page.getByRole('option', { name: ACCOUNT_NAME }).first().click();
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  // Verify expense appears in dashboard totals
  const currentMonth = getYearMonth();
  await page.goto(`/dashboard?month=${currentMonth}`);
  const expensesBlock = page
    .locator('[data-slot="balance-summary"]')
    .locator('div', { hasText: 'Total de Despesas' })
    .first();
  await expect(expensesBlock).toContainText(/R\$\s*250,00/);

  // Go to expenses page and ignore via context menu
  await page.goto('/expenses');
  const expenseCard = page.locator('div').filter({ hasText: 'Mercado Ignorar E2E' }).filter({ has: page.locator('h3') }).first();
  await expenseCard.getByRole('button', { name: 'Abrir menu de ações' }).click();
  await page.getByRole('menuitem', { name: 'Ignorar nos cálculos' }).click();

  // Verify expense is still visible but dimmed
  await expect(page.getByRole('heading', { name: 'Mercado Ignorar E2E', level: 3 })).toBeVisible();

  // Verify expense is NOT in dashboard totals
  await page.goto(`/dashboard?month=${currentMonth}`);
  await expect(expensesBlock).toContainText(/R\$\s*0,00/);

  // Un-ignore the expense via context menu
  await page.goto('/expenses');
  await expenseCard.getByRole('button', { name: 'Abrir menu de ações' }).click();
  await page.getByRole('menuitem', { name: 'Incluir nos cálculos' }).click();
  await page.waitForTimeout(300);

  // Verify expense is back in totals
  await page.goto(`/dashboard?month=${currentMonth}`);
  await expect(expensesBlock).toContainText(/R\$\s*250,00/);
});

test('ignore income removes it from totals', async ({ page }) => {
  await login(page);

  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Despesa', EXPENSE_CATEGORY);
  await createCategory(page, 'Categorias de Receita', INCOME_CATEGORY);
  await setCategoryBudget(page, EXPENSE_CATEGORY, '1000');

  // Create an income
  await page.goto('/income');
  await page.getByRole('button', { name: 'Receita' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Adicionar Receita' });
  await expect(dialog).toBeVisible();
  await fillCurrencyInput(dialog.getByLabel('Valor'), '800');
  await dialog.getByLabel('Descrição').fill('Freelance Ignorar E2E');
  await dialog.getByLabel('Categoria').click();
  await page.getByRole('option', { name: INCOME_CATEGORY }).first().click();
  await dialog.getByLabel('Conta').click();
  await page.getByRole('option', { name: ACCOUNT_NAME }).first().click();
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  // Verify income appears in dashboard net balance
  const currentMonth = getYearMonth();
  await page.goto(`/dashboard?month=${currentMonth}`);
  const netBlock = page
    .locator('[data-slot="balance-summary"]')
    .locator('div', { hasText: 'Saldo Líquido' })
    .first();
  await expect(netBlock).toContainText(/R\$\s*800,00/);

  // Ignore via context menu
  await page.goto('/income');
  const incomeCard = page.locator('div').filter({ hasText: 'Freelance Ignorar E2E' }).filter({ has: page.locator('h3') }).first();
  await incomeCard.getByRole('button', { name: 'Abrir menu de ações' }).click();
  await page.getByRole('menuitem', { name: 'Ignorar nos cálculos' }).click();

  // Verify income is still visible but dimmed
  await expect(page.getByRole('heading', { name: 'Freelance Ignorar E2E', level: 3 })).toBeVisible();

  // Verify income is NOT in dashboard net balance
  await page.goto(`/dashboard?month=${currentMonth}`);
  await expect(netBlock).toContainText(/R\$\s*0,00/);

  // Un-ignore the income via context menu
  await page.goto('/income');
  await incomeCard.getByRole('button', { name: 'Abrir menu de ações' }).click();
  await page.getByRole('menuitem', { name: 'Incluir nos cálculos' }).click();

  // Verify income is back in net balance
  await page.goto(`/dashboard?month=${currentMonth}`);
  await expect(netBlock).toContainText(/R\$\s*800,00/);
});

test('ignore transfer removes it from cash flow', async ({ page }) => {
  await login(page);

  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Despesa', EXPENSE_CATEGORY);
  await setCategoryBudget(page, EXPENSE_CATEGORY, '1000');

  // Create a transfer
  await page.goto('/transfers');
  await page.getByRole('button', { name: 'Adicionar Transferência' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Adicionar Transferência' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Tipo').click();
  await page.getByRole('option', { name: 'Depósito' }).first().click();
  await fillCurrencyInput(dialog.getByLabel('Valor'), '150');
  await dialog.getByLabel('Descrição').fill('Depósito Ignorar E2E');
  await dialog.getByLabel('Conta de destino').click();
  await page.getByRole('option', { name: ACCOUNT_NAME }).first().click();
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  // Verify transfer appears in dashboard cash flow
  const currentMonth = getYearMonth();
  await page.goto(`/dashboard?month=${currentMonth}`);
  const transfersBlock = page
    .locator('[data-slot="cash-flow-report"]')
    .locator('div', { hasText: 'Transferências de entrada' })
    .first();
  await expect(transfersBlock).toContainText(/R\$\s*150,00/);

  // Ignore the transfer
  await page.goto('/transfers');
  const transferCard = page.locator('div').filter({ hasText: 'Depósito Ignorar E2E' }).filter({ has: page.locator('h3') }).first();
  await transferCard.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Ignorar nos cálculos' }).click();

  // Verify transfer is still visible but dimmed
  await expect(page.getByRole('heading', { name: 'Depósito Ignorar E2E', level: 3 })).toBeVisible();

  // Verify transfer is NOT in dashboard cash flow
  await page.goto(`/dashboard?month=${currentMonth}`);
  await expect(transfersBlock).toContainText(/R\$\s*0,00/);

  // Un-ignore the transfer
  await page.goto('/transfers');
  await transferCard.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Incluir nos cálculos' }).click();

  // Verify transfer is back in cash flow
  await page.goto(`/dashboard?month=${currentMonth}`);
  await expect(transfersBlock).toContainText(/R\$\s*150,00/);
});

test('view fatura details and pay it', async ({ page }) => {
  await login(page);

  // Create credit card account
  await page.goto('/settings/accounts');
  await page.getByRole('button', { name: 'Adicionar Conta' }).click();
  const accountDialog = page.getByRole('alertdialog', { name: 'Adicionar Conta' });
  await expect(accountDialog).toBeVisible();
  await accountDialog.getByLabel('Nome').fill('Cartão E2E');
  await accountDialog.getByLabel('Tipo').click();
  await page.getByRole('option', { name: 'Cartão de crédito' }).first().click();

  // Wait for billing config fields to appear and set them
  await expect(accountDialog.getByLabel('Saldo Inicial')).toBeVisible();
  await accountDialog.getByLabel('Saldo Inicial').fill('0');
  await expect(accountDialog.getByLabel('Dia do Fechamento (1-28)')).toBeVisible();
  await accountDialog.getByLabel('Dia do Fechamento (1-28)').click();
  await page.getByRole('option', { name: '1' }).first().click();
  await accountDialog.getByLabel('Dia do Vencimento (1-28)').click();
  await page.getByRole('option', { name: '10' }).first().click();
  await accountDialog.getByLabel('Limite de Crédito').pressSequentially('5000');

  await accountDialog.getByRole('button', { name: 'Criar' }).click();
  await expect(accountDialog).toBeHidden();

  // Create checking account for payment
  await page.getByRole('button', { name: 'Adicionar Conta' }).click();
  await expect(accountDialog).toBeVisible();
  await accountDialog.getByLabel('Nome').fill('Conta Corrente E2E');
  await accountDialog.getByLabel('Tipo').click();
  await page.getByRole('option', { name: 'Conta corrente' }).first().click();
  await accountDialog.getByLabel('Saldo Inicial').fill('0');
  await accountDialog.getByRole('button', { name: 'Criar' }).click();
  await expect(accountDialog).toBeHidden();

  // Create expense category
  await createCategory(page, 'Categorias de Despesa', EXPENSE_CATEGORY);

  // Create expense on credit card to generate fatura
  await page.goto('/expenses');
  await page.getByRole('button', { name: 'Despesa' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Adicionar Despesa' });
  await expect(dialog).toBeVisible();
  await fillCurrencyInput(dialog.getByLabel('Valor'), '500');
  await dialog.getByLabel('Descrição').fill('Compra E2E');
  await dialog.getByLabel('Categoria').click();
  await page.getByRole('option', { name: EXPENSE_CATEGORY }).first().click();
  await dialog.getByLabel('Conta').click();
  await page.getByRole('option', { name: 'Cartão E2E' }).first().click();
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  // Go to faturas page for next month (purchases after closingDay go to next month's fatura)
  const currentMonth = getYearMonth();
  const faturaMonth = addMonths(currentMonth, 1);
  await page.goto(`/faturas?month=${faturaMonth}`);
  await expect(page.getByRole('heading', { name: 'Faturas' })).toBeVisible();

  // Wait for fatura to load and be visible
  await page.waitForTimeout(500);

  // Verify fatura card shows with the amount
  const faturaCard = page.getByRole('heading', { name: /fevereiro de 2026/i }).locator('..').locator('..').locator('..');
  await expect(faturaCard).toBeVisible();
  await expect(faturaCard).toContainText('R$ 500,00');

  // Click on fatura to view details
  await faturaCard.click();

  // Verify detail sheet opens
  const sheet = page.locator('[role="dialog"]');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('heading', { name: /Cartão E2E/i })).toBeVisible();
  await expect(sheet).toContainText(/R\$\s*500,00/);
  await expect(sheet).toContainText('Compra E2E');

  // Pay the fatura
  await sheet.getByRole('button', { name: 'Pagar fatura' }).click();
  const payDialog = page.getByRole('alertdialog', { name: 'Pagar Fatura' });
  await expect(payDialog).toBeVisible();
  await payDialog.getByLabel('Pagar com conta:').click();
  await page.getByRole('option', { name: 'Conta Corrente E2E' }).first().click();
  await payDialog.getByRole('button', { name: 'Confirmar Pagamento' }).click();
  await expect(payDialog).toBeHidden();

  // Verify fatura is now paid
  await expect(sheet.getByText('Pago em')).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Reverter pagamento' })).toBeVisible();
});

test('revert fatura payment', async ({ page }) => {
  await login(page);

  // Create credit card account
  await page.goto('/settings/accounts');
  await page.getByRole('button', { name: 'Adicionar Conta' }).click();
  const accountDialog = page.getByRole('alertdialog', { name: 'Adicionar Conta' });
  await expect(accountDialog).toBeVisible();
  await accountDialog.getByLabel('Nome').fill('Cartão E2E');
  await accountDialog.getByLabel('Tipo').click();
  await page.getByRole('option', { name: 'Cartão de crédito' }).first().click();

  // Wait for billing config fields to appear and set them
  await expect(accountDialog.getByLabel('Saldo Inicial')).toBeVisible();
  await accountDialog.getByLabel('Saldo Inicial').fill('0');
  await expect(accountDialog.getByLabel('Dia do Fechamento (1-28)')).toBeVisible();
  await accountDialog.getByLabel('Dia do Fechamento (1-28)').click();
  await page.getByRole('option', { name: '1' }).first().click();
  await accountDialog.getByLabel('Dia do Vencimento (1-28)').click();
  await page.getByRole('option', { name: '10' }).first().click();
  await accountDialog.getByLabel('Limite de Crédito').pressSequentially('5000');

  await accountDialog.getByRole('button', { name: 'Criar' }).click();
  await expect(accountDialog).toBeHidden();

  // Create checking account for payment
  await page.getByRole('button', { name: 'Adicionar Conta' }).click();
  await expect(accountDialog).toBeVisible();
  await accountDialog.getByLabel('Nome').fill('Conta Corrente E2E');
  await accountDialog.getByLabel('Tipo').click();
  await page.getByRole('option', { name: 'Conta corrente' }).first().click();
  await accountDialog.getByLabel('Saldo Inicial').fill('0');
  await accountDialog.getByRole('button', { name: 'Criar' }).click();
  await expect(accountDialog).toBeHidden();

  // Create expense category
  await createCategory(page, 'Categorias de Despesa', EXPENSE_CATEGORY);

  // Create expense on credit card
  await page.goto('/expenses');
  await page.getByRole('button', { name: 'Despesa' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Adicionar Despesa' });
  await expect(dialog).toBeVisible();
  await fillCurrencyInput(dialog.getByLabel('Valor'), '300');
  await dialog.getByLabel('Descrição').fill('Compra Revert E2E');
  await dialog.getByLabel('Categoria').click();
  await page.getByRole('option', { name: EXPENSE_CATEGORY }).first().click();
  await dialog.getByLabel('Conta').click();
  await page.getByRole('option', { name: 'Cartão E2E' }).first().click();
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  // Go to faturas for next month and pay it
  const currentMonth = getYearMonth();
  const faturaMonth = addMonths(currentMonth, 1);
  await page.goto(`/faturas?month=${faturaMonth}`);

  // Wait for fatura to load
  await page.waitForTimeout(500);

  // Find and click fatura card
  const faturaCard = page.getByRole('heading', { name: /fevereiro de 2026/i }).locator('..').locator('..').locator('..');
  await faturaCard.click();

  const sheet = page.locator('[role="dialog"]');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Pagar fatura' }).click();
  const payDialog2 = page.getByRole('alertdialog', { name: 'Pagar Fatura' });
  await expect(payDialog2).toBeVisible();
  await payDialog2.getByLabel('Pagar com conta:').click();
  await page.getByRole('option', { name: 'Conta Corrente E2E' }).first().click();
  await payDialog2.getByRole('button', { name: 'Confirmar pagamento' }).click();
  await expect(payDialog2).toBeHidden();

  // Verify it's paid
  await expect(sheet.getByText('Pago em')).toBeVisible();

  // Now revert the payment
  await sheet.getByRole('button', { name: 'Reverter pagamento' }).click();
  await page.waitForTimeout(300);

  // Verify payment is reverted
  await expect(sheet.getByRole('button', { name: 'Pagar fatura' })).toBeVisible();
  await expect(sheet.getByText('Pago em')).not.toBeVisible();

  // Close sheet and verify fatura is pending
  await page.keyboard.press('Escape');
  await page.goto(`/faturas?month=${faturaMonth}`);

  // Wait for page to reload
  await page.waitForTimeout(300);

  // Verify fatura shows as pending
  const reloadedCard = page.getByRole('heading', { name: /fevereiro de 2026/i }).locator('..').locator('..').locator('..');
  await expect(reloadedCard).toContainText('Pendente');
});

test('convert expense to fatura payment', async ({ page }) => {
  await login(page);

  // Create credit card account
  await page.goto('/settings/accounts');
  await page.getByRole('button', { name: 'Adicionar Conta' }).click();
  const accountDialog = page.getByRole('alertdialog', { name: 'Adicionar Conta' });
  await expect(accountDialog).toBeVisible();
  await accountDialog.getByLabel('Nome').fill('Cartão Convert E2E');
  await accountDialog.getByLabel('Tipo').click();
  await page.getByRole('option', { name: 'Cartão de crédito' }).first().click();

  // Wait for billing config fields to appear and set them
  await expect(accountDialog.getByLabel('Saldo Inicial')).toBeVisible();
  await accountDialog.getByLabel('Saldo Inicial').fill('0');
  await expect(accountDialog.getByLabel('Dia do Fechamento (1-28)')).toBeVisible();
  await accountDialog.getByLabel('Dia do Fechamento (1-28)').click();
  await page.getByRole('option', { name: '1' }).first().click();
  await accountDialog.getByLabel('Dia do Vencimento (1-28)').click();
  await page.getByRole('option', { name: '10' }).first().click();
  await accountDialog.getByLabel('Limite de Crédito').pressSequentially('5000');

  await accountDialog.getByRole('button', { name: 'Criar' }).click();
  await expect(accountDialog).toBeHidden();

  // Create checking account
  await page.getByRole('button', { name: 'Adicionar Conta' }).click();
  await expect(accountDialog).toBeVisible();
  await accountDialog.getByLabel('Nome').fill('Corrente Convert E2E');
  await accountDialog.getByLabel('Tipo').click();
  await page.getByRole('option', { name: 'Conta corrente' }).first().click();
  await accountDialog.getByLabel('Saldo Inicial').fill('0');
  await accountDialog.getByRole('button', { name: 'Criar' }).click();
  await expect(accountDialog).toBeHidden();

  // Create expense category
  await createCategory(page, 'Categorias de Despesa', EXPENSE_CATEGORY);

  // Create expense on credit card to generate fatura
  await page.goto('/expenses');
  await page.getByRole('button', { name: 'Despesa' }).click();
  const expenseDialog = page.getByRole('alertdialog', { name: 'Adicionar Despesa' });
  await expect(expenseDialog).toBeVisible();
  await fillCurrencyInput(expenseDialog.getByLabel('Valor'), '500');
  await expenseDialog.getByLabel('Descrição').fill('Compra Cartão E2E');
  await expenseDialog.getByLabel('Categoria').click();
  await page.getByRole('option', { name: EXPENSE_CATEGORY }).first().click();
  await expenseDialog.getByLabel('Conta').click();
  await page.getByRole('option', { name: 'Cartão Convert E2E' }).first().click();
  await expenseDialog.getByRole('button', { name: 'Criar' }).click();
  await expect(expenseDialog).toBeHidden();

  // Create expense on checking account (same amount as fatura)
  await page.getByRole('button', { name: 'Despesa' }).click();
  await expect(expenseDialog).toBeVisible();
  await fillCurrencyInput(expenseDialog.getByLabel('Valor'), '500');
  await expenseDialog.getByLabel('Descrição').fill('Pagamento Fatura Manual');
  await expenseDialog.getByLabel('Categoria').click();
  await page.getByRole('option', { name: EXPENSE_CATEGORY }).first().click();
  await expenseDialog.getByLabel('Conta').click();
  await page.getByRole('option', { name: 'Corrente Convert E2E' }).first().click();
  await expenseDialog.getByRole('button', { name: 'Criar' }).click();
  await expect(expenseDialog).toBeHidden();

  // Wait for expenses to load
  await page.waitForTimeout(500);

  // Find the checking account expense card and tap to open detail sheet
  const checkingExpenseCard = page.locator('h3', { hasText: 'Pagamento Fatura Manual' }).locator('..').locator('..').locator('..');
  await expect(checkingExpenseCard).toBeVisible();
  await checkingExpenseCard.click();

  // Detail sheet should open
  const sheet = page.locator('[role="dialog"]');
  await expect(sheet).toBeVisible();

  // Click "Converter em pagamento de fatura"
  await sheet.getByRole('button', { name: 'Converter em pagamento de fatura' }).click();

  // Convert dialog should open
  const convertDialog = page.getByRole('alertdialog', { name: 'Converter em pagamento de fatura' });
  await expect(convertDialog).toBeVisible();
  await expect(convertDialog.getByRole('heading', { name: 'Converter em pagamento de fatura' })).toBeVisible();

  // Select fatura from dropdown (should auto-select matching amount)
  // Just click the convert button as it should have a default selection
  await convertDialog.getByRole('button', { name: 'Converter' }).click();

  // Verify success toast
  await expect(page.getByText('Gasto convertido em pagamento de fatura')).toBeVisible();
  await expect(convertDialog).toBeHidden();

  // Navigate to faturas page for next month
  const currentMonth = getYearMonth();
  const faturaMonth = addMonths(currentMonth, 1);
  await page.goto(`/faturas?month=${faturaMonth}`);
  await expect(page.getByRole('heading', { name: 'Faturas' })).toBeVisible();

  // Wait for fatura to load
  await page.waitForTimeout(500);

  // Find fatura card and verify it shows as paid
  const faturaCard = page.getByRole('heading', { name: /fevereiro de 2026/i }).locator('..').locator('..').locator('..');
  await expect(faturaCard).toBeVisible();
  await expect(faturaCard).toContainText('R$ 500,00');
  await expect(faturaCard).toContainText('Paga');
});

test('create calendar event', async ({ page }) => {
  await login(page);

  await page.goto('/calendar');
  await expect(page.getByRole('heading', { name: 'Calendário' })).toBeVisible();

  // Click add event button
  await page.getByRole('button', { name: 'Adicionar Evento' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Adicionar Evento' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Adicionar Evento' })).toBeVisible();

  // Fill event form
  await dialog.getByLabel('Título').fill('Reunião E2E');
  await dialog.getByLabel('Descrição').fill('Reunião de teste E2E');
  await dialog.getByLabel('Local').fill('Sala 101');

  // Set priority
  await dialog.getByLabel('Prioridade').click();
  await page.getByRole('option', { name: 'Alta' }).first().click();

  // Create event
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  // Wait for calendar to reload
  await page.waitForTimeout(500);

  // Verify event appears in calendar (check for title in page)
  await expect(page.getByText('Reunião E2E')).toBeVisible();
});

test('create calendar task', async ({ page }) => {
  await login(page);

  await page.goto('/calendar');
  await expect(page.getByRole('heading', { name: 'Calendário' })).toBeVisible();

  // Click add task button
  await page.getByRole('button', { name: 'Adicionar Tarefa' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Adicionar Tarefa' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Adicionar Tarefa' })).toBeVisible();

  // Fill task form
  await dialog.getByLabel('Título').fill('Tarefa E2E');
  await dialog.getByLabel('Descrição').fill('Tarefa de teste E2E');
  await dialog.getByLabel('Local').fill('Escritório');

  // Set priority
  await dialog.getByLabel('Prioridade').click();
  await page.getByRole('option', { name: 'Média' }).first().click();

  // Set status
  await dialog.getByLabel('Status').click();
  await page.getByRole('option', { name: 'Pendente' }).first().click();

  // Create task
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  // Wait for calendar to reload
  await page.waitForTimeout(500);

  // Verify task appears in calendar
  await expect(page.getByText('Tarefa E2E')).toBeVisible();
});

test('edit calendar event', async ({ page }) => {
  await login(page);

  await page.goto('/calendar');
  await expect(page.getByRole('heading', { name: 'Calendário' })).toBeVisible();

  // Create an event first
  await page.getByRole('button', { name: 'Adicionar Evento' }).click();
  const createDialog = page.getByRole('alertdialog', { name: 'Adicionar Evento' });
  await expect(createDialog).toBeVisible();
  await createDialog.getByLabel('Título').fill('Evento Original E2E');
  await createDialog.getByLabel('Descrição').fill('Descrição original');
  await createDialog.getByLabel('Local').fill('Local Original');
  await createDialog.getByLabel('Prioridade').click();
  await page.getByRole('option', { name: 'Baixa' }).first().click();
  await createDialog.getByRole('button', { name: 'Criar' }).click();
  await expect(createDialog).toBeHidden();
  await page.waitForTimeout(500);

  // Click on the event to open detail sheet
  await page.getByText('Evento Original E2E').first().click();
  await page.waitForTimeout(300);

  // Find the detail sheet and click edit
  const sheet = page.locator('[role="dialog"]').filter({ hasText: 'Evento Original E2E' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Editar' }).click();

  // Edit dialog should open
  const editDialog = page.getByRole('alertdialog', { name: 'Editar Evento' });
  await expect(editDialog).toBeVisible();

  // Modify event details
  await editDialog.getByLabel('Título').fill('Evento Editado E2E');
  await editDialog.getByLabel('Descrição').fill('Descrição editada');
  await editDialog.getByLabel('Local').fill('Local Editado');
  await editDialog.getByLabel('Prioridade').click();
  await page.getByRole('option', { name: 'Alta' }).first().click();

  // Save changes
  await editDialog.getByRole('button', { name: 'Atualizar' }).click();
  await expect(editDialog).toBeHidden();
  await page.waitForTimeout(500);

  // Verify edited event appears in calendar
  await expect(page.getByText('Evento Editado E2E')).toBeVisible();
  await expect(page.getByText('Evento Original E2E')).not.toBeVisible();
});
