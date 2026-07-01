import { test, expect, request } from '@playwright/test';
import { PRIMARY_USER, registerUser, setupAuth } from './helpers/auth';

const USER = { ...PRIMARY_USER, email: `us020${Date.now()}@e2e.test` };
// Fresh user with NO data to test empty-state
const EMPTY_USER = { ...PRIMARY_USER, email: `us020empty${Date.now()}@e2e.test` };

test.describe('US-020 — Dashboard Summary / Home Overview', () => {
  test.beforeAll(async () => {
    await registerUser(USER);
    await registerUser(EMPTY_USER);
  });

  // AC5: new user with no data sees an empty-state onboarding prompt
  test('new user with no data sees empty state on dashboard', async ({ page }) => {
    await setupAuth(page, EMPTY_USER);
    await page.goto('/dashboard');

    await expect(page.getByTestId('dashboard-summary')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('today-seconds')).toHaveText('00:00:00');
    await expect(page.getByTestId('week-seconds')).toHaveText('00:00:00');
    await expect(page.getByTestId('top-projects-empty')).toBeVisible();
  });

  // AC1: today's and this week's totals are correct after adding a task
  test('today and week totals are non-zero after adding a task today', async ({ page }) => {
    const token = await setupAuth(page, USER);
    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    await ctx.post('/api/tasks', {
      data: {
        description: 'Dashboard test task',
        startTime: new Date(Date.now() - 3_600_000).toISOString(),
        endTime: new Date(Date.now() - 1_800_000).toISOString(),
      },
    });
    await ctx.dispose();

    await page.goto('/dashboard');
    await expect(page.getByTestId('dashboard-summary')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('today-seconds')).not.toHaveText('00:00:00');
    await expect(page.getByTestId('week-seconds')).not.toHaveText('00:00:00');
  });

  // AC2: running task is displayed with live elapsed-time counter
  test('running task is shown with elapsed timer on dashboard', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/dashboard');
    await page.getByTestId('start-btn').click();
    await expect(page.getByTestId('running-task-info')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('elapsed')).toBeVisible();

    // Clean up
    await page.getByTestId('stop-btn').click();
  });

  // AC3: top projects section is shown (with at least one project after adding a task linked to it)
  test('top projects list shows project with tracked time this week', async ({ page }) => {
    const token = await setupAuth(page, USER);
    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    const proj = await (await ctx.post('/api/projects', { data: { name: `TopProj ${Date.now()}` } })).json();
    await ctx.post('/api/tasks', {
      data: {
        description: 'Top project task',
        startTime: new Date(Date.now() - 3_600_000).toISOString(),
        endTime: new Date(Date.now() - 1_800_000).toISOString(),
        projectIds: [proj.id],
      },
    });
    await ctx.dispose();

    await page.goto('/dashboard');
    await expect(page.getByTestId('top-projects')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId(`top-project-${proj.id}`)).toBeVisible();
  });

  // AC4: all summary data fetched in a single API call (no waterfall — verify endpoint exists and responds quickly)
  test('GET /api/dashboard/summary responds within 1 second', async ({ page }) => {
    const token = await setupAuth(page, USER);
    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    const before = Date.now();
    const resp = await ctx.get('/api/dashboard/summary');
    const elapsed = Date.now() - before;
    await ctx.dispose();

    expect(resp.status()).toBe(200);
    expect(elapsed).toBeLessThan(1000);
  });
});
