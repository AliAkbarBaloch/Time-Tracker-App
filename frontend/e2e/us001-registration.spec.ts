import { test, expect } from '@playwright/test';
import { registerUser } from './helpers/auth';

const UNIQUE = () => `reg${Date.now()}@e2e.test`;

test.describe('US-001 — User Registration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Register' }).click();
  });

  // AC1: valid unique registration succeeds and redirects to dashboard
  test('happy path: new user registers and lands on dashboard', async ({ page }) => {
    const email = UNIQUE();
    await page.locator('#displayName').fill('Reg Tester');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill('SecurePass1!');
    await page.getByTestId('confirm-password-input').fill('SecurePass1!');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
    // User initials visible in the top bar
    await expect(page.locator('.user-avatar')).toBeVisible();
  });

  // AC2: duplicate email shows error
  test('duplicate email shows error message', async ({ page }) => {
    const email = UNIQUE();
    // Register once via API
    await registerUser({ email, password: 'SecurePass1!', displayName: 'First' });

    await page.locator('#displayName').fill('Second');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill('SecurePass1!');
    await page.getByTestId('confirm-password-input').fill('SecurePass1!');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 8_000 });
  });

  // AC4 (form): empty form shows field-level validation errors
  test('submitting empty form shows validation errors', async ({ page }) => {
    // Touch each field to activate React's dirty state, then clear it
    // This ensures field-level errors appear on submit rather than relying on HTML5 required
    for (const id of ['#displayName', '#email', '#password']) {
      await page.locator(id).fill('x');
      await page.locator(id).fill('');
    }
    await page.getByTestId('confirm-password-input').fill('x');
    await page.getByTestId('confirm-password-input').fill('');

    await page.getByRole('button', { name: 'Create Account' }).click();

    // At least one field-level error appears
    const errorLocators = [
      page.getByTestId('error-displayName'),
      page.getByTestId('error-email'),
      page.getByTestId('error-password'),
    ];
    let found = false;
    for (const loc of errorLocators) {
      if (await loc.isVisible()) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  // AC4 (form): password mismatch shows error
  test('mismatched passwords show error before submit', async ({ page }) => {
    await page.locator('#displayName').fill('Mismatch');
    await page.locator('#email').fill(UNIQUE());
    await page.locator('#password').fill('SecurePass1!');
    await page.getByTestId('confirm-password-input').fill('DifferentPass1!');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page.getByTestId('error-confirmPassword')).toBeVisible({ timeout: 5_000 });
  });

  // AC4 (form): short password rejected
  test('password shorter than 8 characters is rejected', async ({ page }) => {
    await page.locator('#displayName').fill('Short');
    await page.locator('#email').fill(UNIQUE());
    await page.locator('#password').fill('abc123');
    await page.getByTestId('confirm-password-input').fill('abc123');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page.getByTestId('error-password')).toBeVisible({ timeout: 5_000 });
  });
});
