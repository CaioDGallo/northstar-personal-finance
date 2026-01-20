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
    initialBalance = '0', // 0 cents = R$ 0,00
    creditLimit = '500000', // 500000 cents = R$ 5.000,00
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

test('edit account name', async ({ page }) => {
  await login(page);

  const ORIGINAL_NAME = 'Conta Original E2E';
  const NEW_NAME = 'Conta Editada E2E';

  await createAccount(page, ORIGINAL_NAME);

  // Find the account card and open dropdown
  const accountCard = page.getByRole('heading', { name: ORIGINAL_NAME }).locator('../..');
  await accountCard.getByRole('button').last().click(); // Three dots menu

  // Wait for dropdown menu and click Edit option
  const editMenuItem = page.getByRole('menuitem', { name: 'Editar Contas' });
  await expect(editMenuItem).toBeVisible();
  await editMenuItem.click();

  // Edit dialog should open
  const editDialog = page.getByRole('alertdialog');
  await expect(editDialog).toBeVisible();
  await expect(editDialog.getByLabel('Nome')).toHaveValue(ORIGINAL_NAME);

  // Change name and save
  await editDialog.getByLabel('Nome').fill(NEW_NAME);
  await editDialog.getByRole('button', { name: 'Atualizar' }).click();
  await expect(editDialog).toBeHidden();

  // Verify new name appears
  await expect(page.getByRole('heading', { name: NEW_NAME }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: ORIGINAL_NAME })).toBeHidden();
});

test('delete account', async ({ page }) => {
  await login(page);

  const ACCOUNT_NAME = 'Conta Para Deletar E2E';

  await createAccount(page, ACCOUNT_NAME);

  // Find the account card and open dropdown
  const accountCard = page.getByRole('heading', { name: ACCOUNT_NAME }).locator('../..');
  await accountCard.getByRole('button').last().click();

  // Wait for dropdown menu and click Delete option
  const deleteMenuItem = page.getByRole('menuitem', { name: 'Excluir Contas' });
  await expect(deleteMenuItem).toBeVisible();
  await deleteMenuItem.click();

  // Confirmation dialog should appear
  const confirmDialog = page.getByRole('alertdialog');
  await expect(confirmDialog).toBeVisible();
  await expect(confirmDialog.getByText('Esta ação não pode ser desfeita.')).toBeVisible();

  // Confirm deletion
  await confirmDialog.getByRole('button', { name: 'Excluir' }).click();
  await expect(confirmDialog).toBeHidden();

  // Verify account is gone
  await expect(page.getByRole('heading', { name: ACCOUNT_NAME })).toBeHidden();
});

test('edit category name', async ({ page }) => {
  await login(page);

  const ORIGINAL_NAME = 'Categoria Original E2E';
  const NEW_NAME = 'Categoria Editada E2E';

  await createCategory(page, 'Categorias de Despesa', ORIGINAL_NAME);

  // Find the category card and open dropdown
  const categoryCard = page.getByRole('heading', { name: ORIGINAL_NAME }).locator('../../..');
  await categoryCard.getByRole('button').last().click();

  // Wait for dropdown menu to appear and click Edit option
  const editMenuItem = page.getByRole('menuitem', { name: 'Editar Categorias' });
  await expect(editMenuItem).toBeVisible();
  await editMenuItem.click();

  // Edit dialog should open
  const editDialog = page.getByRole('alertdialog');
  await expect(editDialog).toBeVisible();
  await expect(editDialog.getByLabel('Nome')).toHaveValue(ORIGINAL_NAME);

  // Change name and save
  await editDialog.getByLabel('Nome').fill(NEW_NAME);
  await editDialog.getByRole('button', { name: 'Atualizar' }).click();
  await expect(editDialog).toBeHidden();

  // Verify new name appears
  await expect(page.getByRole('heading', { name: NEW_NAME }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: ORIGINAL_NAME })).toBeHidden();
});

test('delete category', async ({ page }) => {
  await login(page);

  const CATEGORY_NAME = 'Categoria Para Deletar E2E';

  await createCategory(page, 'Categorias de Despesa', CATEGORY_NAME);

  // Find the category card and open dropdown
  const categoryCard = page.getByRole('heading', { name: CATEGORY_NAME }).locator('../../..');
  await categoryCard.getByRole('button').last().click();

  // Wait for dropdown menu to appear and click Delete option
  const deleteMenuItem = page.getByRole('menuitem', { name: 'Excluir Categorias' });
  await expect(deleteMenuItem).toBeVisible();
  await deleteMenuItem.click();

  // Confirmation dialog should appear
  const confirmDialog = page.getByRole('alertdialog');
  await expect(confirmDialog).toBeVisible();
  await expect(confirmDialog.getByText('Esta ação não pode ser desfeita.')).toBeVisible();

  // Confirm deletion
  await confirmDialog.getByRole('button', { name: 'Excluir' }).click();
  await expect(confirmDialog).toBeHidden();

  // Verify category is gone
  await expect(page.getByRole('heading', { name: CATEGORY_NAME })).toBeHidden();
});

test('edit expense', async ({ page }) => {
  await login(page);

  const ACCOUNT_NAME = 'Conta E2E';
  const CATEGORY_NAME = 'Alimentação E2E';
  const ORIGINAL_DESC = 'Mercado Original E2E';
  const NEW_DESC = 'Mercado Editado E2E';

  // Setup
  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Despesa', CATEGORY_NAME);

  // Create expense
  await page.goto('/expenses');
  await page.getByRole('button', { name: 'Despesa' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Adicionar Despesa' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Valor').pressSequentially('15000'); // 15000 cents = R$ 150,00
  await dialog.getByLabel('Descrição').fill(ORIGINAL_DESC);
  await dialog.getByLabel('Categoria').click();
  await page.getByRole('option', { name: CATEGORY_NAME }).first().click();
  await dialog.getByLabel('Conta').click();
  await page.getByRole('option', { name: ACCOUNT_NAME }).first().click();
  await page.waitForTimeout(300);
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  // Find the expense card and tap to open detail sheet
  const expenseCard = page.locator('h3', { hasText: ORIGINAL_DESC }).first().locator('../../..');
  await expenseCard.click();

  // Detail sheet should open
  const sheet = page.locator('[role="dialog"]');
  await expect(sheet).toBeVisible();

  // Click the Edit button
  await sheet.getByRole('button', { name: 'Editar' }).click();

  // Edit dialog should open
  const editDialog = page.getByRole('alertdialog');
  await expect(editDialog).toBeVisible();
  await expect(editDialog.getByLabel('Descrição')).toHaveValue(ORIGINAL_DESC);

  // Change description and save
  await editDialog.getByLabel('Descrição').fill(NEW_DESC);
  await editDialog.getByRole('button', { name: 'Atualizar' }).click();
  await expect(editDialog).toBeHidden();

  // Verify new description appears
  await expect(page.locator('h3', { hasText: NEW_DESC }).first()).toBeVisible();
  await expect(page.locator('h3', { hasText: ORIGINAL_DESC })).toBeHidden();
});

test('delete expense', async ({ page }) => {
  await login(page);

  const ACCOUNT_NAME = 'Conta E2E';
  const CATEGORY_NAME = 'Alimentação E2E';
  const DESCRIPTION = 'Mercado Para Deletar E2E';

  // Setup
  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Despesa', CATEGORY_NAME);

  // Create expense
  await page.goto('/expenses');
  await page.getByRole('button', { name: 'Despesa' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Adicionar Despesa' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Valor').pressSequentially('10000'); // 10000 cents = R$ 100,00
  await dialog.getByLabel('Descrição').fill(DESCRIPTION);
  await dialog.getByLabel('Categoria').click();
  await page.getByRole('option', { name: CATEGORY_NAME }).first().click();
  await dialog.getByLabel('Conta').click();
  await page.getByRole('option', { name: ACCOUNT_NAME }).first().click();
  await page.waitForTimeout(300);
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  // Find the expense card and use the context menu
  const expenseCard = page.locator('h3', { hasText: DESCRIPTION }).first().locator('../../..');
  await expenseCard.getByRole('button', { name: 'Abrir menu de ações' }).click();
  await page.getByRole('menuitem', { name: 'Excluir Transação' }).click();

  // Confirmation dialog should appear
  const confirmDialog = page.getByRole('alertdialog');
  await expect(confirmDialog).toBeVisible();
  await expect(confirmDialog.getByText('Esta ação não pode ser desfeita.')).toBeVisible();

  // Confirm deletion
  await confirmDialog.getByRole('button', { name: 'Excluir' }).click();
  await expect(confirmDialog).toBeHidden();

  // Verify expense is gone
  await expect(page.locator('h3', { hasText: DESCRIPTION })).toBeHidden();
});

test('edit income', async ({ page }) => {
  await login(page);

  const ACCOUNT_NAME = 'Conta E2E';
  const CATEGORY_NAME = 'Salário E2E';
  const ORIGINAL_DESC = 'Receita Original E2E';
  const NEW_DESC = 'Receita Editada E2E';

  // Setup
  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Receita', CATEGORY_NAME);

  // Create income
  await page.goto('/income');
  await page.getByRole('button', { name: 'Receita' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Adicionar Receita' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Valor').pressSequentially('200000'); // 200000 cents = R$ 2.000,00
  await dialog.getByLabel('Descrição').fill(ORIGINAL_DESC);
  await dialog.getByLabel('Categoria').click();
  await page.getByRole('option', { name: CATEGORY_NAME }).first().click();
  await dialog.getByLabel('Conta').click();
  await page.getByRole('option', { name: ACCOUNT_NAME }).first().click();
  await page.waitForTimeout(300);
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  // Find the income card and tap to open detail sheet
  const incomeCard = page.locator('h3', { hasText: ORIGINAL_DESC }).first().locator('../../..');
  await incomeCard.click();

  // Detail sheet should open
  const sheet = page.locator('[role="dialog"]');
  await expect(sheet).toBeVisible();

  // Click the Edit button
  await sheet.getByRole('button', { name: 'Editar' }).click();

  // Edit dialog should open
  const editDialog = page.getByRole('alertdialog', { name: 'Editar Receita' });
  await expect(editDialog).toBeVisible();
  await expect(editDialog.getByLabel('Descrição')).toHaveValue(ORIGINAL_DESC);

  // Change description and save
  await editDialog.getByLabel('Descrição').fill(NEW_DESC);
  await editDialog.getByRole('button', { name: 'Atualizar' }).click();
  await expect(editDialog).toBeHidden();

  // Verify new description appears
  await expect(page.locator('h3', { hasText: NEW_DESC }).first()).toBeVisible();
  await expect(page.locator('h3', { hasText: ORIGINAL_DESC })).toBeHidden();
});

test('delete income', async ({ page }) => {
  await login(page);

  const ACCOUNT_NAME = 'Conta E2E';
  const CATEGORY_NAME = 'Salário E2E';
  const DESCRIPTION = 'Receita Para Deletar E2E';

  // Setup
  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Receita', CATEGORY_NAME);

  // Create income
  await page.goto('/income');
  await page.getByRole('button', { name: 'Receita' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Adicionar Receita' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Valor').pressSequentially('150000'); // 150000 cents = R$ 1.500,00
  await dialog.getByLabel('Descrição').fill(DESCRIPTION);
  await dialog.getByLabel('Categoria').click();
  await page.getByRole('option', { name: CATEGORY_NAME }).first().click();
  await dialog.getByLabel('Conta').click();
  await page.getByRole('option', { name: ACCOUNT_NAME }).first().click();
  await page.waitForTimeout(300);
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  // Find the income card and use the context menu
  const incomeCard = page.locator('h3', { hasText: DESCRIPTION }).first().locator('../../..');
  await incomeCard.getByRole('button', { name: 'Abrir menu de ações' }).click();
  await page.getByRole('menuitem', { name: 'Excluir Receita' }).click();

  // Confirmation dialog should appear
  const confirmDialog = page.getByRole('alertdialog', { name: 'Excluir Receita' });
  await expect(confirmDialog).toBeVisible();
  await expect(confirmDialog.getByText('Esta ação não pode ser desfeita.')).toBeVisible();

  // Confirm deletion
  await confirmDialog.getByRole('button', { name: 'Excluir' }).click();
  await expect(confirmDialog).toBeHidden();

  // Verify income is gone
  await expect(page.locator('h3', { hasText: DESCRIPTION })).toBeHidden();
});

test('edit transfer', async ({ page }) => {
  await login(page);

  const ACCOUNT_NAME = 'Conta E2E';
  const ORIGINAL_DESC = 'Depósito Original E2E';
  const NEW_DESC = 'Depósito Editado E2E';

  // Setup
  await createAccount(page, ACCOUNT_NAME);

  // Create transfer
  await page.goto('/transfers');
  await page.getByRole('button', { name: 'Adicionar Transferência' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Adicionar Transferência' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Tipo').click();
  await page.getByRole('option', { name: 'Depósito' }).first().click();
  await dialog.getByLabel('Valor').pressSequentially('50000'); // 50000 cents = R$ 500,00
  await dialog.getByLabel('Descrição').fill(ORIGINAL_DESC);
  await dialog.getByLabel('Conta de destino').click();
  await page.getByRole('option', { name: ACCOUNT_NAME }).first().click();
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  // Find the transfer card and open dropdown
  const transferCard = page.locator('h3', { hasText: ORIGINAL_DESC }).first().locator('../../..');
  await transferCard.getByRole('button').last().click();

  // Wait for dropdown menu to appear and click Edit option
  const editMenuItem = page.getByRole('menuitem', { name: 'Editar' });
  await expect(editMenuItem).toBeVisible();
  await editMenuItem.click();

  // Edit dialog should open
  const editDialog = page.getByRole('alertdialog');
  await expect(editDialog).toBeVisible();
  await expect(editDialog.getByLabel('Descrição')).toHaveValue(ORIGINAL_DESC);

  // Change description and save
  await editDialog.getByLabel('Descrição').fill(NEW_DESC);
  await editDialog.getByRole('button', { name: 'Atualizar' }).click();
  await expect(editDialog).toBeHidden();

  // Verify new description appears
  await expect(page.locator('h3', { hasText: NEW_DESC }).first()).toBeVisible();
  await expect(page.locator('h3', { hasText: ORIGINAL_DESC })).toBeHidden();
});

test('delete transfer', async ({ page }) => {
  await login(page);

  const ACCOUNT_NAME = 'Conta E2E';
  const DESCRIPTION = 'Depósito Para Deletar E2E';

  // Setup
  await createAccount(page, ACCOUNT_NAME);

  // Create transfer
  await page.goto('/transfers');
  await page.getByRole('button', { name: 'Adicionar Transferência' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Adicionar Transferência' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Tipo').click();
  await page.getByRole('option', { name: 'Depósito' }).first().click();
  await dialog.getByLabel('Valor').pressSequentially('30000'); // 30000 cents = R$ 300,00
  await dialog.getByLabel('Descrição').fill(DESCRIPTION);
  await dialog.getByLabel('Conta de destino').click();
  await page.getByRole('option', { name: ACCOUNT_NAME }).first().click();
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  // Find the transfer card and open dropdown
  const transferCard = page.locator('h3', { hasText: DESCRIPTION }).first().locator('../../..');
  await transferCard.getByRole('button').last().click();

  // Wait for dropdown menu to appear and click Delete option
  const deleteMenuItem = page.getByRole('menuitem', { name: 'Excluir Transferência' });
  await expect(deleteMenuItem).toBeVisible();
  await deleteMenuItem.click();

  // Confirmation dialog should appear
  const confirmDialog = page.getByRole('alertdialog', { name: 'Excluir Transferência' });
  await expect(confirmDialog).toBeVisible();
  await expect(confirmDialog.getByText('Esta ação não pode ser desfeita.')).toBeVisible();

  // Confirm deletion
  await confirmDialog.getByRole('button', { name: 'Excluir' }).click();
  await expect(confirmDialog).toBeHidden();

  // Verify transfer is gone
  await expect(page.locator('h3', { hasText: DESCRIPTION })).toBeHidden();
});
