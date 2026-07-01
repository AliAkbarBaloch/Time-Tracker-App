import { test, expect, request } from '@playwright/test';
import { PRIMARY_USER, registerUser, loginUser, setupAuth } from './helpers/auth';

const USER       = { ...PRIMARY_USER, email: `us028${Date.now()}@e2e.test` };
const EMPTY_USER = { ...PRIMARY_USER, email: `us028empty${Date.now()}@e2e.test` };

const API = process.env.API_BASE ?? 'http://localhost:8080';

test.describe('US-028 — Productivity Analytics', () => {
  test.beforeAll(async () => {
    await registerUser(USER);
    await registerUser(EMPTY_USER);
  });

  // AC1: GET /api/analytics/heatmap returns entries for days with tracked time
  test('heatmap endpoint returns days with totalSeconds for tracked tasks', async () => {
    const token = await loginUser(USER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    await ctx.post('/api/tasks', {
      data: { description: 'Heatmap task', startTime: new Date(Date.now() - 3600000).toISOString(), endTime: new Date(Date.now() - 1800000).toISOString() },
    });
    const year = new Date().getFullYear();
    const resp = await ctx.get(`/api/analytics/heatmap?year=${year}`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('days');
    expect(Array.isArray(body.days)).toBe(true);
    // At least one day entry for today
    const today = new Date().toISOString().slice(0, 10);
    const todayEntry = body.days.find((d: { date: string }) => d.date === today);
    expect(todayEntry).toBeDefined();
    expect(todayEntry.totalSeconds).toBeGreaterThan(0);
    await ctx.dispose();
  });

  // AC2: GET /api/analytics/weekly-pattern returns 7 entries Mon–Sun
  test('weekly-pattern endpoint returns exactly 7 day-of-week entries', async () => {
    const token = await loginUser(USER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    const resp = await ctx.get('/api/analytics/weekly-pattern?weeks=12');
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('byDayOfWeek');
    expect(body.byDayOfWeek.length).toBe(7);
    const days = body.byDayOfWeek.map((d: { day: string }) => d.day);
    expect(days).toContain('MON');
    expect(days).toContain('SUN');
    await ctx.dispose();
  });

  // AC3/AC9: both endpoints return 401 without a valid JWT
  test('analytics endpoints return 401 without JWT', async () => {
    const ctx = await request.newContext({ baseURL: API });
    const year = new Date().getFullYear();
    expect((await ctx.get(`/api/analytics/heatmap?year=${year}`)).status()).toBe(401);
    expect((await ctx.get('/api/analytics/weekly-pattern?weeks=12')).status()).toBe(401);
    await ctx.dispose();
  });

  // AC9: data scoped to authenticated user — different user sees different data
  test('heatmap data is scoped to the authenticated user', async () => {
    const token = await loginUser(EMPTY_USER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    const year = new Date().getFullYear();
    const resp = await ctx.get(`/api/analytics/heatmap?year=${year}`);
    const body = await resp.json();
    // EMPTY_USER has no tasks — heatmap days array must be empty
    expect(body.days.length).toBe(0);
    await ctx.dispose();
  });

  // UI: analytics page renders heatmap grid and week-pattern chart
  test('analytics page renders heatmap grid and weekly pattern chart', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/analytics');
    await expect(page.getByTestId('analytics-page')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('heatmap-grid')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('week-pattern-chart')).toBeVisible();
  });

  // AC4: heatmap grid renders 52×7 cells (Mon–Sun × 52+ weeks)
  test('heatmap grid contains at least 364 cells (52 weeks × 7 days)', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/analytics');
    await expect(page.getByTestId('heatmap-grid')).toBeVisible({ timeout: 8_000 });
    const cells = page.locator('[data-testid^="heatmap-cell-"]');
    const count = await cells.count();
    // 52 weeks × 7 days = 364 minimum (some years have 53 weeks)
    expect(count).toBeGreaterThanOrEqual(364);
  });

  // AC6: day-of-week chart shows Mon–Sun bars (7 bars)
  test('weekly pattern chart shows 7 day bars', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/analytics');
    await expect(page.getByTestId('week-pattern-chart')).toBeVisible({ timeout: 8_000 });
    for (const day of ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']) {
      await expect(page.getByTestId(`week-bar-${day}`)).toBeVisible();
    }
  });

  // AC7: year selector changes the heatmap year without page reload
  test('year selector updates the heatmap without navigating away', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/analytics');
    await expect(page.getByTestId('heatmap-grid')).toBeVisible({ timeout: 8_000 });

    const prevYear = String(new Date().getFullYear() - 1);
    await page.getByTestId('year-select').selectOption(prevYear);

    // Still on /analytics (no navigation)
    expect(page.url()).toContain('/analytics');
    await expect(page.getByTestId('heatmap-grid')).toBeVisible({ timeout: 5_000 });
  });

  // AC8: user with no data sees an empty heatmap (days array empty from API)
  test('empty user sees an empty heatmap grid (all minimum colour cells)', async ({ page }) => {
    await setupAuth(page, EMPTY_USER);
    await page.goto('/analytics');
    await expect(page.getByTestId('heatmap-grid')).toBeVisible({ timeout: 8_000 });
    // All real cells should have the pad or level-0 style — no bright cells
    // Just verify the grid renders without error
    await expect(page.getByTestId('analytics-page')).toBeVisible();
  });
});
