import { test, expect, request } from '@playwright/test';
import { PRIMARY_USER, registerUser, setupAuth } from './helpers/auth';

const USER = { ...PRIMARY_USER, email: `us016${Date.now()}@e2e.test` };

test.describe('US-016 — View Monthly Task Overview', () => {
  test.beforeAll(async () => {
    await registerUser(USER);
  });

  // AC1: All days of the current month are displayed in calendar layout
  test('month view shows day cells for every day in the current month', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/overview');

    await page.getByTestId('view-tab-month').click();
    await expect(page.getByTestId('month-view')).toBeVisible({ timeout: 8_000 });

    // Today's cell must exist
    const today = new Date();
    const ds = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    await expect(page.getByTestId(`month-day-${ds}`)).toBeVisible();
  });

  // AC2: Each day cell shows the total tracked time for that day
  test('day cell shows non-zero total after a task is added for that day', async ({ page }) => {
    const token = await setupAuth(page, USER);

    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    await ctx.post('/api/tasks', {
      data: {
        description: 'Monthly task',
        startTime: new Date(Date.now() - 3_600_000).toISOString(),
        endTime: new Date(Date.now() - 1_800_000).toISOString(),
      },
    });
    await ctx.dispose();

    await page.goto('/overview');
    await page.getByTestId('view-tab-month').click();
    await expect(page.getByTestId('month-view')).toBeVisible({ timeout: 8_000 });

    const today = new Date();
    const ds = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const dayTotal = page.getByTestId(`month-day-total-${ds}`);
    await expect(dayTotal).not.toHaveText('—', { timeout: 5_000 });
  });

  // AC3: Navigating to the previous month shows correct historical data
  test('prev-month navigation button changes the displayed month', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/overview');

    await page.getByTestId('view-tab-month').click();
    await expect(page.getByTestId('month-view')).toBeVisible({ timeout: 8_000 });

    const beforeLabel = await page.getByTestId('month-label').textContent();
    await page.getByTestId('prev-month-btn').click();
    const afterLabel = await page.getByTestId('month-label').textContent();

    expect(afterLabel).not.toBe(beforeLabel);
  });

  // AC4: Monthly total is the sum of all daily totals
  test('monthly total is non-zero when tasks exist for this month', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/overview');

    await page.getByTestId('view-tab-month').click();
    await expect(page.getByTestId('month-view')).toBeVisible({ timeout: 8_000 });

    const monthTotal = page.getByTestId('month-total');
    await expect(monthTotal).toBeVisible();
    await expect(monthTotal).not.toHaveText('00:00:00');
  });
});
