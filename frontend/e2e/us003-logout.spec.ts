import { test, expect, request } from '@playwright/test';
import { PRIMARY_USER, registerUser, setupAuth } from './helpers/auth';

const USER = { ...PRIMARY_USER, email: `logout${Date.now()}@e2e.test` };

test.describe('US-003 — User Logout', () => {
  test.beforeAll(async () => {
    await registerUser(USER);
  });

  // AC1: clicking Logout clears credentials and redirects to /login
  test('clicking Logout redirects to /login and clears localStorage', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    await page.getByRole('button', { name: 'Logout' }).click();

    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

    // Token must be gone from localStorage
    const token = await page.evaluate(() => localStorage.getItem('tt_token'));
    expect(token).toBeNull();
  });

  // AC2: after logout, navigating to /dashboard bounces back to /login
  test('after logout, protected route /dashboard redirects to /login', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });

  // AC2: after logout, /tasks is also protected
  test('after logout, protected route /tasks redirects to /login', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/tasks');
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

    await page.goto('/tasks');
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });

  // AC3: API call without token returns 401
  test('API call without token returns 401', async () => {
    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
    });
    const resp = await ctx.get('/api/tasks');
    expect(resp.status()).toBe(401);
    await ctx.dispose();
  });
});
