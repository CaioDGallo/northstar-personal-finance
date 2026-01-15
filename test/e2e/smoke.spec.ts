import { type Page } from '@playwright/test';
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

async function createAccount(page: Page, name: string) {
  await page.goto('/settings/accounts');
  await page.getByRole('button', { name: 'Adicionar Conta' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Nome').fill(name);
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

async function setCategoryBudget(page: Page, categoryName: string, amount: string) {
  await page.goto('/settings/budgets');
  const row = page.getByText(categoryName, { exact: true }).locator('..').locator('..').first();
  const input = row.getByRole('spinbutton');
  await input.fill(amount);
  await input.blur();
  await expect(input).toHaveValue(amount);
  await page.waitForTimeout(300);
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
  await page.getByRole('button', { name: 'Adicionar Despesa' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Valor').fill('300');
  await dialog.getByLabel('Descrição').fill('Mercado E2E');
  await dialog.getByLabel('Categoria').click();
  await page.getByRole('option', { name: EXPENSE_CATEGORY }).first().click();
  await dialog.getByLabel('Conta').click();
  await page.getByRole('option', { name: ACCOUNT_NAME }).first().click();

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
  await page.getByRole('button', { name: 'Adicionar Receita' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Valor').fill('500');
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
  await dialog.getByLabel('Valor').fill('200');
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
  await page.getByRole('button', { name: 'Adicionar Despesa' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Valor').fill('250');
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

  // Go to expenses page and ignore the expense
  await page.goto('/expenses');
  const expenseCard = page.locator('div').filter({ hasText: 'Mercado Ignorar E2E' }).filter({ has: page.locator('h3') }).first();
  await expenseCard.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Ignorar nos cálculos' }).click();

  // Verify expense is still visible but dimmed
  await expect(page.getByRole('heading', { name: 'Mercado Ignorar E2E', level: 3 })).toBeVisible();

  // Verify expense is NOT in dashboard totals
  await page.goto(`/dashboard?month=${currentMonth}`);
  await expect(expensesBlock).toContainText(/R\$\s*0,00/);

  // Un-ignore the expense
  await page.goto('/expenses');
  await expenseCard.getByRole('button').last().click();
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
  await page.getByRole('button', { name: 'Adicionar Receita' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Valor').fill('800');
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

  // Ignore the income
  await page.goto('/income');
  const incomeCard = page.locator('div').filter({ hasText: 'Freelance Ignorar E2E' }).filter({ has: page.locator('h3') }).first();
  await incomeCard.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Ignorar nos cálculos' }).click();

  // Verify income is still visible but dimmed
  await expect(page.getByRole('heading', { name: 'Freelance Ignorar E2E', level: 3 })).toBeVisible();

  // Verify income is NOT in dashboard net balance
  await page.goto(`/dashboard?month=${currentMonth}`);
  await expect(netBlock).toContainText(/R\$\s*0,00/);

  // Un-ignore the income
  await page.goto('/income');
  await incomeCard.getByRole('button').last().click();
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
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Tipo').click();
  await page.getByRole('option', { name: 'Depósito' }).first().click();
  await dialog.getByLabel('Valor').fill('150');
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
