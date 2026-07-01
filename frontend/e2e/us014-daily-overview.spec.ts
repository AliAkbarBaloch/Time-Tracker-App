import { test, expect, request } from '@playwright/test';
import { PRIMARY_USER, registerUser, setupAuth } from './helpers/auth';

const USER = { ...PRIMARY_USER, email: `us014${Date.now()}@e2e.test` };

test.describe('US-014 — View Daily Task Overview', () => {
  test.beforeAll(async () => {
    await registerUser(USER);
  });

  // AC4: empty day shows friendly message / zero totals
  test('dashboard shows zero today total when no tasks exist', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/dashboard');

    const todayEl = page.getByTestId('today-seconds');
    await expect(todayEl).toBeVisible({ timeout: 8_000 });
    await expect(todayEl).toHaveText('00:00:00');
  });

  // AC1 + AC3: task started and stopped today increments the today total
  test('completing a task today updates the daily total on dashboard', async ({ page }) => {
    const token = await setupAuth(page, USER);

    // Add a completed task for today via API (1 hour ago → 30 min ago)
    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    await ctx.post('/api/tasks', {
      data: {
        description: 'Daily task',
        startTime: new Date(Date.now() - 3_600_000).toISOString(),
        endTime: new Date(Date.now() - 1_800_000).toISOString(),
      },
    });
    await ctx.dispose();

    await page.goto('/dashboard');
    const todayEl = page.getByTestId('today-seconds');
    await expect(todayEl).not.toHaveText('00:00:00', { timeout: 8_000 });
  });

  // AC2: running task appears highlighted with elapsed timer on dashboard
  test('running task is visible with elapsed timer on dashboard', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/dashboard');

    await page.getByTestId('start-btn').click();
    await expect(page.getByTestId('elapsed')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('running-task-info')).toBeVisible();

    // Clean up
    await page.getByTestId('stop-btn').click();
  });
});
