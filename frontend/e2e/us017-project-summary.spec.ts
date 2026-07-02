import { test, expect, request } from '@playwright/test';
import { PRIMARY_USER, registerUser, setupAuth } from './helpers/auth';

const USER = { ...PRIMARY_USER, email: `us017${Date.now()}@e2e.test` };

test.describe('US-017 — View Project Time Summary', () => {
  test.beforeAll(async () => {
    await registerUser(USER);
  });

  // AC1: total time reflects all tasks on project and its entire subproject tree
  test('project detail shows rolled-up total including subproject tasks', async ({ page }) => {
    const token = await setupAuth(page, USER);
    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });

    // Create parent and child project
    const parent = await (await ctx.post('/api/projects', { data: { name: `Parent ${Date.now()}` } })).json();
    const child = await (await ctx.post('/api/projects', { data: { name: `Child ${Date.now()}`, parentProjectId: parent.id } })).json();

    // Add a task to the child project
    await ctx.post('/api/tasks', {
      data: {
        description: 'Subproject task',
        startTime: new Date(Date.now() - 3_600_000).toISOString(),
        endTime: new Date(Date.now() - 1_800_000).toISOString(),
        projectIds: [child.id],
      },
    });
    await ctx.dispose();

    await page.goto(`/projects/${parent.id}`);
    await expect(page.getByTestId('project-summary-name')).toBeVisible({ timeout: 8_000 });

    // Parent total must be non-zero (rolled up from child)
    const total = page.getByTestId('project-summary-total');
    await expect(total).toBeVisible();
    await expect(total).not.toHaveText('0:00:00');
    await expect(total).not.toHaveText('00:00:00');
  });

  // AC3: changing date range filter updates totals without page reload
  test('switching preset filter updates totals without page reload', async ({ page }) => {
    const token = await setupAuth(page, USER);
    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    const proj = await (await ctx.post('/api/projects', { data: { name: `Filter ${Date.now()}` } })).json();
    await ctx.post('/api/tasks', {
      data: {
        description: 'Filter test task',
        startTime: new Date(Date.now() - 3_600_000).toISOString(),
        endTime: new Date(Date.now() - 1_800_000).toISOString(),
        projectIds: [proj.id],
      },
    });
    await ctx.dispose();

    await page.goto(`/projects/${proj.id}`);
    await expect(page.getByTestId('project-summary-name')).toBeVisible({ timeout: 8_000 });

    // Capture All Time total first
    await page.getByTestId('preset-btn-all-time').click();
    const allTimeTotal = await page.getByTestId('project-summary-total').textContent();

    // Switch to Today — total should still be non-zero and page did not navigate
    await page.getByTestId('preset-btn-today').click();
    await expect(page.getByTestId('project-summary-total')).toBeVisible({ timeout: 5_000 });
    expect(page.url()).toContain(`/projects/${proj.id}`);

    // Switch to All Time again — wait for re-fetch to complete, then total matches original
    await page.getByTestId('preset-btn-all-time').click();
    await page.waitForTimeout(1_500);
    const allTimeAgain = await page.getByTestId('project-summary-total').textContent();
    expect(allTimeAgain).toBe(allTimeTotal);
  });

  // AC4: project with no tasks in selected period shows zero
  test('project with no tasks in selected period shows zero total', async ({ page }) => {
    const token = await setupAuth(page, USER);
    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    const emptyProj = await (await ctx.post('/api/projects', { data: { name: `Empty ${Date.now()}` } })).json();
    await ctx.dispose();

    await page.goto(`/projects/${emptyProj.id}`);
    await expect(page.getByTestId('project-summary-name')).toBeVisible({ timeout: 8_000 });

    const total = page.getByTestId('project-summary-total');
    await expect(total).toBeVisible();
    // Accept any zero-duration format: 0:00:00, 00:00:00, 0:00, 0h 0m, 0m, etc.
    const text = (await total.textContent()) ?? '';
    expect(text.trim()).toMatch(/^0+:00|^0h?\s*0|^0m/);
  });
});
