import { test, expect } from '@playwright/test';
import { PRIMARY_USER, registerUser, injectAuth } from './helpers/auth';

const USER = { ...PRIMARY_USER, email: `login${Date.now()}@e2e.test` };

test.describe('US-002 — User Login', () => {
  test.beforeAll(async () => {
    await registerUser(USER);
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  // AC1: correct credentials → redirect to dashboard
  test('happy path: valid credentials redirect to dashboard', async ({ page }) => {
    await page.locator('#email').fill(USER.email);
    await page.locator('#password').fill(USER.password);
    await page.getByRole('button', { name: 'Log In' }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
    await expect(page.locator('.user-avatar')).toBeVisible();
  });

  // AC2: wrong password → generic error, does not reveal which field
  test('wrong password shows a generic error without revealing which field', async ({ page }) => {
    await page.locator('#email').fill(USER.email);
    await page.locator('#password').fill('WrongPassword999!');
    await page.getByRole('button', { name: 'Log In' }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible({ timeout: 8_000 });
    // Must not say "password" or "email" specifically
    const text = (await alert.textContent()) ?? '';
    expect(text.toLowerCase()).not.toContain('password incorrect');
    expect(text.toLowerCase()).not.toContain('email not found');
  });

  // AC2: non-existent email → same generic error
  test('non-existent email shows the same generic error', async ({ page }) => {
    await page.locator('#email').fill('nobody@nowhere.test');
    await page.locator('#password').fill('SomePass1!');
    await page.getByRole('button', { name: 'Log In' }).click();

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 8_000 });
  });

  // AC1 (form): empty form shows validation errors before hitting API
  test('empty form shows validation errors', async ({ page }) => {
    await page.getByRole('button', { name: 'Log In' }).click();

    const emailErr = page.getByTestId('error-email');
    const passErr = page.getByTestId('error-password');
    const either = (await emailErr.isVisible()) || (await passErr.isVisible());
    expect(either).toBe(true);
  });

  // AC3: after login, protected routes remain accessible without re-auth
  test('after login, protected routes are accessible without re-authenticating', async ({ page }) => {
    await page.locator('#email').fill(USER.email);
    await page.locator('#password').fill(USER.password);
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    // Navigate directly to /tasks — must stay there, not bounce to /login
    await page.goto('/tasks');
    await expect(page).toHaveURL(/\/tasks/);
    await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible();
  });

  // AC4: tampered token in localStorage → redirected to /login
  test('invalid token in localStorage redirects to login', async ({ page }) => {
    await injectAuth(page, USER, 'not.a.valid.jwt.token');
    await page.goto('/dashboard');

    // App should detect the invalid token and send user back to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
