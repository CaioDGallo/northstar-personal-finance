import { type Page } from '@playwright/test';
import { test, expect } from '@/test/fixtures';

const TEST_EMAIL = 'e2e@example.com';
const TEST_PASSWORD = 'Password123';

// Configure mobile viewport for feedback tests (bottom tab bar is mobile-only)
test.use({
  viewport: { width: 375, height: 667 }, // iPhone SE dimensions
});

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(TEST_EMAIL);
  await page.getByLabel('Senha').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Visão Geral' })).toBeVisible();
}

async function openFeedbackFromMore(page: Page) {
  // Go to dashboard
  await page.goto('/dashboard');

  // Wait for page to be fully loaded
  await page.waitForLoadState('networkidle');

  // Find and click the "Mais" button in bottom tab bar
  const maisButton = page.locator('button:has-text("Mais")').first();
  await expect(maisButton).toBeVisible({ timeout: 10000 });
  await maisButton.click();

  // Wait for More sheet to open
  await page.waitForTimeout(500);

  // Click Feedback in More menu
  const feedbackButton = page.locator('button', { hasText: 'Feedback' }).first();
  await expect(feedbackButton).toBeVisible({ timeout: 10000 });
  await feedbackButton.click();

  // Wait for Feedback sheet to open
  await page.waitForTimeout(500);
  const feedbackSheet = page.locator('[role="dialog"]').filter({ hasText: 'Enviar Feedback' });
  await expect(feedbackSheet).toBeVisible({ timeout: 10000 });

  return feedbackSheet;
}

test('submit bug feedback successfully', async ({ page }) => {
  await login(page);
  const feedbackSheet = await openFeedbackFromMore(page);

  // Select Bug type
  const typeSelect = feedbackSheet.locator('[id^="radix"]').filter({ hasText: 'Tipo' }).locator('..').locator('button').first();
  await typeSelect.click();
  await page.locator('[role="option"]', { hasText: 'Bug' }).first().click();

  // Fill message
  const messageTextarea = feedbackSheet.getByPlaceholder('Descreva o problema ou sugestão...');
  await messageTextarea.fill('Encontrei um bug crítico no sistema de exportação E2E');

  // Submit
  await feedbackSheet.getByRole('button', { name: 'Enviar' }).click();

  // Verify success toast appears
  await expect(page.getByText('Feedback enviado! Obrigado.')).toBeVisible({ timeout: 5000 });
});

test('submit suggestion feedback successfully', async ({ page }) => {
  await login(page);
  const feedbackSheet = await openFeedbackFromMore(page);

  // Default type is "Sugestão" - just fill message
  const messageTextarea = feedbackSheet.getByPlaceholder('Descreva o problema ou sugestão...');
  await messageTextarea.fill('Sugestão: adicionar gráficos mensais de tendências E2E');

  // Submit
  await feedbackSheet.getByRole('button', { name: 'Enviar' }).click();

  // Verify success
  await expect(page.getByText('Feedback enviado! Obrigado.')).toBeVisible({ timeout: 5000 });
});

test('submit button disabled with empty message', async ({ page }) => {
  await login(page);
  const feedbackSheet = await openFeedbackFromMore(page);

  // Submit button should be disabled when message is empty
  const submitButton = feedbackSheet.getByRole('button', { name: 'Enviar' });
  await expect(submitButton).toBeDisabled();

  // Type something
  const messageTextarea = feedbackSheet.getByPlaceholder('Descreva o problema ou sugestão...');
  await messageTextarea.fill('Algum feedback importante');

  // Submit button should now be enabled
  await expect(submitButton).toBeEnabled();
});

test('feedback form has correct placeholder and types', async ({ page }) => {
  await login(page);
  const feedbackSheet = await openFeedbackFromMore(page);

  // Verify placeholder text
  await expect(feedbackSheet.getByPlaceholder('Descreva o problema ou sugestão...')).toBeVisible();

  // Open type selector and verify all options
  const typeSelect = feedbackSheet.locator('button', { hasText: 'Sugestão' }).first();
  await typeSelect.click();

  // Verify all feedback types are available
  await expect(page.locator('[role="option"]', { hasText: 'Bug' }).first()).toBeVisible();
  await expect(page.locator('[role="option"]', { hasText: 'Sugestão' }).first()).toBeVisible();
  await expect(page.locator('[role="option"]', { hasText: 'Outro' }).first()).toBeVisible();
});
