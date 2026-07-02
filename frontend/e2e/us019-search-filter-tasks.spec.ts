import { test, expect, request } from '@playwright/test';
import { PRIMARY_USER, registerUser, setupAuth } from './helpers/auth';

const USER = { ...PRIMARY_USER, email: `us019${Date.now()}@e2e.test` };

function isoAgo(ms: number) {
  return new Date(Date.now() - ms).toISOString();
}

test.describe('US-019 — Search and Filter Tasks', () => {
  test.beforeAll(async () => {
    await registerUser(USER);
  });

  // AC1: keyword search returns only tasks whose description contains the keyword (case-insensitive)
  test('keyword search filters tasks by description (case-insensitive)', async ({ page }) => {
    const token = await setupAuth(page, USER);
    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    await ctx.post('/api/tasks', { data: { description: 'ALPHA task', startTime: isoAgo(7200000), endTime: isoAgo(3600000) } });
    await ctx.post('/api/tasks', { data: { description: 'beta task', startTime: isoAgo(3600000), endTime: isoAgo(1800000) } });
    await ctx.dispose();

    await page.goto('/tasks');
    await page.getByTestId('filter-search-input').fill('alpha');

    // Wait for debounce (300 ms) and re-render
    await page.waitForTimeout(500);
    const rows = page.locator('[data-testid^="task-item-"]');
    await expect(rows.first()).toBeVisible({ timeout: 8_000 });

    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).textContent();
      expect(text?.toLowerCase()).toContain('alpha');
    }
  });

  // AC3: combining filters narrows results (AND logic)
  test('combining keyword and date range filters narrows results', async ({ page }) => {
    const token = await setupAuth(page, USER);
    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    // Task matching keyword today
    await ctx.post('/api/tasks', { data: { description: 'GAMMA today', startTime: isoAgo(1800000), endTime: isoAgo(900000) } });
    // Task matching keyword but yesterday (outside today filter)
    const yesterday = new Date(Date.now() - 86_400_000);
    await ctx.post('/api/tasks', {
      data: {
        description: 'GAMMA yesterday',
        startTime: new Date(yesterday.getTime() - 3600000).toISOString(),
        endTime: yesterday.toISOString(),
      },
    });
    await ctx.dispose();

    await page.goto('/tasks');
    await page.getByTestId('filter-search-input').fill('GAMMA');
    await page.waitForTimeout(500);

    // All rows should contain 'gamma'
    const rows = page.locator('[data-testid^="task-item-"]');
    await expect(rows.first()).toBeVisible({ timeout: 8_000 });
    const allCount = await rows.count();
    expect(allCount).toBeGreaterThanOrEqual(2);

    // Now add a from-date of today — should shrink to only today's task.
    // Use expect(rows).not.toHaveCount() so we poll the DOM until the count actually
    // drops (waitForResponse fires before React processes the response, so checking
    // rows.count() immediately after the response is a race condition).
    const todayStr = new Date().toISOString().slice(0, 10);
    await page.getByTestId('filter-from').fill(todayStr);
    await expect(rows).not.toHaveCount(allCount, { timeout: 8_000 });

    const narrowedCount = await rows.count();
    expect(narrowedCount).toBeLessThan(allCount);
  });

  // AC4: reset button restores the unfiltered task list
  test('reset button restores the full task list', async ({ page }) => {
    const token = await setupAuth(page, USER);

    // Create a task explicitly so this test does not rely on previous tests' tasks
    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    await ctx.post('/api/tasks', {
      data: { description: 'Reset test task', startTime: isoAgo(3600000), endTime: isoAgo(1800000) },
    });
    await ctx.dispose();

    await page.goto('/tasks');

    await page.getByTestId('filter-search-input').fill('nonexistentxyz');
    await page.waitForTimeout(500);

    // Possibly no results shown; wait for reset button to be present and click it
    await expect(page.getByTestId('filter-reset-btn')).toBeVisible({ timeout: 8_000 });

    // Wait for the reset-triggered re-fetch to complete before asserting the list
    const refetch = page.waitForResponse(
      r => r.url().includes('/api/tasks') && r.status() === 200,
      { timeout: 5_000 },
    );
    await page.getByTestId('filter-reset-btn').click();
    await refetch.catch(() => {});

    // Search input should be cleared
    await expect(page.getByTestId('filter-search-input')).toHaveValue('');

    // Task list should now be showing items again
    const rows = page.locator('[data-testid^="task-item-"]');
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
  });
});
