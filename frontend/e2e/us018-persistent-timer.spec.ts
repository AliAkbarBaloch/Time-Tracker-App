import { test, expect } from '@playwright/test';
import { PRIMARY_USER, registerUser, setupAuth } from './helpers/auth';

const USER = { ...PRIMARY_USER, email: `us018${Date.now()}@e2e.test` };

test.describe('US-018 — Persistent Timer Across Browser Sessions', () => {
  test.beforeAll(async () => {
    await registerUser(USER);
  });

  // AC2: refreshing the page does not reset or stop the timer
  test('timer continues running after page refresh', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/dashboard');

    await page.getByTestId('start-btn').click();
    await expect(page.getByTestId('elapsed')).toBeVisible({ timeout: 8_000 });

    // Reload and check timer is still showing
    await page.reload();
    await expect(page.getByTestId('elapsed')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('stop-btn')).toBeVisible();

    // Clean up
    await page.getByTestId('stop-btn').click();
  });

  // AC1: closing and reopening the browser shows correct elapsed time
  test('navigating away and back preserves the running timer', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/dashboard');

    await page.getByTestId('start-btn').click();
    await expect(page.getByTestId('elapsed')).toBeVisible({ timeout: 8_000 });

    // Navigate to tasks page and back — timer must still be running
    await page.goto('/tasks');
    await page.waitForLoadState('domcontentloaded');
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('stop-btn')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('elapsed')).toBeVisible();

    // Clean up
    await page.getByTestId('stop-btn').click();
  });

  // AC3: the running task banner is visible on ALL pages while a task is active
  test('running task banner is shown on all pages while timer is active', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/dashboard');

    await page.getByTestId('start-btn').click();
    await expect(page.getByTestId('elapsed')).toBeVisible({ timeout: 8_000 });

    // Banner should be visible on the tasks page
    await page.goto('/tasks');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('topbar-timer')).toBeVisible({ timeout: 5_000 });

    // Banner should be visible on the projects page
    await page.goto('/projects');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('topbar-timer')).toBeVisible({ timeout: 5_000 });

    // Banner should be visible on the overview page
    await page.goto('/overview');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('topbar-timer')).toBeVisible({ timeout: 5_000 });

    // Clean up — go back to dashboard and stop
    await page.goto('/dashboard');
    await page.getByTestId('stop-btn').click();
  });

  // AC4: timer state is stored server-side — a second page session can see it
  test('second browser context sees the running timer via GET /api/tasks/active', async ({ page, browser }) => {
    const token = await setupAuth(page, USER);
    await page.goto('/dashboard');
    await page.getByTestId('start-btn').click();
    await expect(page.getByTestId('elapsed')).toBeVisible({ timeout: 8_000 });

    // Open a fresh context (simulates a different device / second login)
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await page2.goto('/');
    await page2.evaluate(({ t, u }) => {
      localStorage.setItem('tt_token', t);
      localStorage.setItem('tt_user', u);
    }, { t: token, u: JSON.stringify({ email: USER.email, displayName: USER.displayName }) });
    await page2.goto('/dashboard');
    await expect(page2.getByTestId('stop-btn')).toBeVisible({ timeout: 8_000 });
    await expect(page2.getByTestId('elapsed')).toBeVisible();
    await ctx2.close();

    // Clean up
    await page.getByTestId('stop-btn').click();
  });
});
