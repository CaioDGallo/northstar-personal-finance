import { type Page } from '@playwright/test';
import { test, expect } from '@/test/fixtures';

const TEST_EMAIL = 'e2e@example.com';
const TEST_PASSWORD = 'Password123';

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
    await dialog.getByLabel('Limite de Crédito').fill(creditLimit);
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

test('mark expense as paid', async ({ page }) => {
  await login(page);

  const ACCOUNT_NAME = 'Conta E2E';
  const CATEGORY_NAME = 'Alimentação E2E';
  const DESCRIPTION = 'Mercado E2E';

  // Setup
  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Despesa', CATEGORY_NAME);

  // Create expense (not paid by default)
  await page.goto('/expenses');
  await page.getByRole('button', { name: 'Despesa' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Adicionar Despesa' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Valor').click();
  await dialog.getByLabel('Valor').fill('100');
  await dialog.getByLabel('Descrição').fill(DESCRIPTION);
  await dialog.getByLabel('Categoria').click();
  await page.getByRole('option', { name: CATEGORY_NAME }).first().click();
  await dialog.getByLabel('Conta').click();
  await page.getByRole('option', { name: ACCOUNT_NAME }).first().click();
  await page.waitForTimeout(300);
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  // Find the expense card and use the desktop context menu
  const expenseCard = page.locator('h3', { hasText: DESCRIPTION }).first().locator('../../..');
  await expenseCard.getByRole('button', { name: 'Abrir menu de ações' }).click();
  await page.getByRole('menuitem', { name: 'Marcar como Pago' }).click();

  // Wait for the status update to process
  await page.waitForTimeout(500);

  // Verify: The pending option is now available
  await expenseCard.getByRole('button', { name: 'Abrir menu de ações' }).click();
  await expect(page.getByRole('menuitem', { name: 'Marcar como Pendente' })).toBeVisible();
});

test('mark expense as pending (unpay)', async ({ page }) => {
  await login(page);

  const ACCOUNT_NAME = 'Conta E2E';
  const CATEGORY_NAME = 'Alimentação E2E';
  const DESCRIPTION = 'Mercado E2E';

  // Setup
  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Despesa', CATEGORY_NAME);

  // Create expense
  await page.goto('/expenses');
  await page.getByRole('button', { name: 'Despesa' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Adicionar Despesa' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Valor').fill('100');
  await dialog.getByLabel('Descrição').fill(DESCRIPTION);
  await dialog.getByLabel('Categoria').click();
  await page.getByRole('option', { name: CATEGORY_NAME }).first().click();
  await dialog.getByLabel('Conta').click();
  await page.getByRole('option', { name: ACCOUNT_NAME }).first().click();
  await page.waitForTimeout(300);
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  // Find the expense card
  const expenseCard = page.locator('h3', { hasText: DESCRIPTION }).first().locator('../../..');

  // First mark as paid
  await expenseCard.getByRole('button', { name: 'Abrir menu de ações' }).click();
  await page.getByRole('menuitem', { name: 'Marcar como Pago' }).click();
  await page.waitForTimeout(500);

  // Then mark as pending (unpay) using the menu
  await expenseCard.getByRole('button', { name: 'Abrir menu de ações' }).click();
  await page.getByRole('menuitem', { name: 'Marcar como Pendente' }).click();
  await page.waitForTimeout(500);

  // Verify: The paid option is available again
  await expenseCard.getByRole('button', { name: 'Abrir menu de ações' }).click();
  await expect(page.getByRole('menuitem', { name: 'Marcar como Pago' })).toBeVisible();
});

test('mark income as received', async ({ page }) => {
  await login(page);

  const ACCOUNT_NAME = 'Conta E2E';
  const CATEGORY_NAME = 'Salário E2E';
  const DESCRIPTION = 'Pagamento E2E';

  // Setup
  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Receita', CATEGORY_NAME);

  // Create income (not received by default)
  await page.goto('/income');
  await page.getByRole('button', { name: 'Receita' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Adicionar Receita' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Valor').fill('2000');
  await dialog.getByLabel('Descrição').fill(DESCRIPTION);
  await dialog.getByLabel('Categoria').click();
  await page.getByRole('option', { name: CATEGORY_NAME }).first().click();
  await dialog.getByLabel('Conta').click();
  await page.getByRole('option', { name: ACCOUNT_NAME }).first().click();
  await page.waitForTimeout(300);
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  // Find the income card and use the desktop context menu
  const incomeCard = page.locator('h3', { hasText: DESCRIPTION }).first().locator('../../..');
  await incomeCard.getByRole('button', { name: 'Abrir menu de ações' }).click();
  await page.getByRole('menuitem', { name: 'Marcar como Recebido' }).click();

  // Wait for the status update to process
  await page.waitForTimeout(500);

  // Verify: The pending option is now available
  await incomeCard.getByRole('button', { name: 'Abrir menu de ações' }).click();
  await expect(page.getByRole('menuitem', { name: 'Marcar como Pendente' })).toBeVisible();
});

test('mark income as pending (unreceive)', async ({ page }) => {
  await login(page);

  const ACCOUNT_NAME = 'Conta E2E';
  const CATEGORY_NAME = 'Salário E2E';
  const DESCRIPTION = 'Pagamento E2E';

  // Setup
  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Receita', CATEGORY_NAME);

  // Create income
  await page.goto('/income');
  await page.getByRole('button', { name: 'Receita' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Adicionar Receita' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Valor').fill('1500');
  await dialog.getByLabel('Descrição').fill(DESCRIPTION);
  await dialog.getByLabel('Categoria').click();
  await page.getByRole('option', { name: CATEGORY_NAME }).first().click();
  await dialog.getByLabel('Conta').click();
  await page.getByRole('option', { name: ACCOUNT_NAME }).first().click();
  await page.waitForTimeout(300);
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  // Find the income card
  const incomeCard = page.locator('h3', { hasText: DESCRIPTION }).first().locator('../../..');

  // First mark as received
  await incomeCard.getByRole('button', { name: 'Abrir menu de ações' }).click();
  await page.getByRole('menuitem', { name: 'Marcar como Recebido' }).click();
  await page.waitForTimeout(500);

  // Then mark as pending (unreceive) using the menu
  await incomeCard.getByRole('button', { name: 'Abrir menu de ações' }).click();
  await page.getByRole('menuitem', { name: 'Marcar como Pendente' }).click();
  await page.waitForTimeout(500);

  // Verify: The received option is available again
  await incomeCard.getByRole('button', { name: 'Abrir menu de ações' }).click();
  await expect(page.getByRole('menuitem', { name: 'Marcar como Recebido' })).toBeVisible();
});
