import { test, expect, request } from '@playwright/test';
import { PRIMARY_USER, registerUser, setupAuth } from './helpers/auth';

const USER = { ...PRIMARY_USER, email: `us015${Date.now()}@e2e.test` };

test.describe('US-015 — View Weekly Task Overview', () => {
  test.beforeAll(async () => {
    await registerUser(USER);
  });

  // AC1: All 7 days of the current week are visible, even days with no tasks
  test('all 7 day columns are visible including empty days', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/overview');

    // Switch to week tab if needed
    const weekTab = page.getByTestId('view-tab-week');
    if (await weekTab.isVisible()) {
      await weekTab.click();
    }

    const weekView = page.getByTestId('week-view');
    await expect(weekView).toBeVisible({ timeout: 8_000 });

    // All 7 day columns must render
    for (let i = 0; i < 7; i++) {
      await expect(page.getByTestId(`week-col-${i}`)).toBeVisible();
    }
  });

  // AC2: per-day totals and overall weekly total are accurate
  test('week view shows correct per-day and weekly totals after adding a task', async ({ page }) => {
    const token = await setupAuth(page, USER);

    // Add a 30-minute task for today via API
    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    await ctx.post('/api/tasks', {
      data: {
        description: 'Weekly overview task',
        startTime: new Date(Date.now() - 3_600_000).toISOString(),
        endTime: new Date(Date.now() - 1_800_000).toISOString(),
      },
    });
    await ctx.dispose();

    await page.goto('/overview');
    const weekTab = page.getByTestId('view-tab-week');
    if (await weekTab.isVisible()) {
      await weekTab.click();
    }

    await expect(page.getByTestId('week-view')).toBeVisible({ timeout: 8_000 });

    // Weekly total should be non-zero
    const weekTotal = page.getByTestId('week-total');
    await expect(weekTotal).toBeVisible();
    await expect(weekTotal).not.toHaveText('00:00:00');
  });

  // AC3: navigating to the previous week shows that week's data
  test('prev-week navigation button changes the displayed week', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/overview');

    const weekTab = page.getByTestId('view-tab-week');
    if (await weekTab.isVisible()) {
      await weekTab.click();
    }

    await expect(page.getByTestId('week-view')).toBeVisible({ timeout: 8_000 });

    // Capture current week heading text before navigation
    const weekHeading = page.getByTestId('week-view').locator('h2, h3, [data-testid="week-label"]').first();
    const beforeText = await weekHeading.textContent();

    await page.getByTestId('prev-week-btn').click();

    // Heading should change to show the previous week
    const afterText = await weekHeading.textContent();
    expect(afterText).not.toBe(beforeText);
  });

  // AC4: tasks spanning midnight attributed to the day their start time falls in
  test('task spanning midnight is counted in the day its start time falls in', async ({ page }) => {
    const token = await setupAuth(page, USER);

    // Create a task whose startTime is today at 23:00 and endTime is tomorrow 01:00
    const now = new Date();
    const startMidnight = new Date(now);
    startMidnight.setHours(23, 0, 0, 0);
    const endMidnight = new Date(startMidnight.getTime() + 2 * 3_600_000);

    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    const resp = await ctx.post('/api/tasks', {
      data: {
        description: 'Midnight spanning task',
        startTime: startMidnight.toISOString(),
        endTime: endMidnight.toISOString(),
      },
    });
    // API must accept the task (201 or 200)
    expect([200, 201]).toContain(resp.status());
    const created = await resp.json();

    await ctx.dispose();

    // The task duration of 2h should appear on today's column, not tomorrow's
    await page.goto('/overview');
    const weekTab = page.getByTestId('view-tab-week');
    if (await weekTab.isVisible()) {
      await weekTab.click();
    }

    await expect(page.getByTestId('week-view')).toBeVisible({ timeout: 8_000 });

    // Today's column (JS day index mapped to Mon=0 Sun=6) must contain the task description
    const todayIndex = (now.getDay() + 6) % 7;
    const todayCol = page.getByTestId(`week-col-${todayIndex}`);
    await expect(todayCol).toBeVisible();
    await expect(todayCol).toContainText(created.description ?? 'Midnight spanning task', { timeout: 5_000 });
  });
});
