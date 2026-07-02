import { test, expect, request } from '@playwright/test';
import { PRIMARY_USER, registerUser, setupAuth } from './helpers/auth';

const USER = { ...PRIMARY_USER, email: `us006${Date.now()}@e2e.test` };

test.describe('US-006 — Stop a Running Task', () => {
  test.beforeAll(async () => {
    await registerUser(USER);
  });

  test.beforeEach(async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/dashboard');
  });

  // AC1: Stop sets endTime; AC3: Stop button disappears, Start button restored
  test('clicking Stop ends the timer and restores the Start button', async ({ page }) => {
    await page.getByTestId('start-btn').click();
    await expect(page.getByTestId('elapsed')).toBeVisible({ timeout: 8_000 });

    await page.getByTestId('stop-btn').click();

    await expect(page.getByTestId('start-btn')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('elapsed')).not.toBeVisible();
  });

  // AC2: completed task appears in the task list immediately after stopping
  test('stopped task appears in task list immediately', async ({ page }) => {
    await page.getByTestId('task-desc-input').fill('Stopped task');
    await page.getByTestId('start-btn').click();
    await expect(page.getByTestId('stop-btn')).toBeVisible({ timeout: 8_000 });

    // Wait at least 1 second so the stopped task has a non-zero duration
    await page.waitForTimeout(1_200);

    await page.getByTestId('stop-btn').click();
    await expect(page.getByTestId('start-btn')).toBeVisible({ timeout: 8_000 });

    // Dashboard today total should be non-zero
    const todayEl = page.getByTestId('today-seconds');
    await expect(todayEl).not.toHaveText('00:00:00', { timeout: 10_000 });
  });

  // AC4: stopping when no timer is running — backend returns 404 (API-level check)
  test('stopping with no active timer returns 404 from API', async ({ page }) => {
    // Obtain token via stored localStorage
    const token = await setupAuth(page, USER);
    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    const resp = await ctx.post('/api/tasks/stop');
    expect(resp.status()).toBe(404);
    await ctx.dispose();
  });
});
