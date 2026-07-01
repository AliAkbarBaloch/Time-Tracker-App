import { test, expect, request } from '@playwright/test';
import { PRIMARY_USER, SECONDARY_USER, registerUser, setupAuth } from './helpers/auth';

const USER = { ...PRIMARY_USER, email: `us012a${Date.now()}@e2e.test` };
const OTHER = { ...SECONDARY_USER, email: `us012b${Date.now()}@e2e.test` };

test.describe('US-012 — Edit and Delete a Project', () => {
  test.beforeAll(async () => {
    await registerUser(USER);
    await registerUser(OTHER);
  });

  // AC1: rename to a unique name succeeds
  test('renaming a project to a unique name succeeds', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/projects');

    const original = `EditMe ${Date.now()}`;
    await page.getByTestId('new-project-btn').click();
    await page.getByTestId('project-name-input').fill(original);
    await page.getByTestId('create-project-btn').click();
    await expect(page.getByText(original)).toBeVisible({ timeout: 8_000 });

    // Open edit form and rename
    await page.locator('[data-testid^="edit-project-btn-"]').first().click();
    const renamed = `Renamed ${Date.now()}`;
    await page.getByTestId('edit-project-name-input').fill(renamed);
    await page.getByTestId('save-project-edit-btn').click();

    await expect(page.getByText(renamed)).toBeVisible({ timeout: 8_000 });
  });

  // AC2: deleting a project with tasks shows force-delete warning dialog
  test('deleting project with tasks shows a warning dialog', async ({ page }) => {
    const token = await setupAuth(page, USER);

    // Create project and attach a task to it via API
    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    const proj = await (await ctx.post('/api/projects', { data: { name: `WithTask ${Date.now()}` } })).json();
    await ctx.post('/api/tasks', {
      data: {
        description: 'linked',
        startTime: new Date(Date.now() - 3_600_000).toISOString(),
        endTime: new Date(Date.now() - 1_800_000).toISOString(),
        projectIds: [proj.id],
      },
    });
    await ctx.dispose();

    await page.goto('/projects');
    await expect(page.getByText(proj.name)).toBeVisible({ timeout: 8_000 });

    await page.locator(`[data-testid="delete-project-btn-${proj.id}"]`).click();

    // Force-delete warning dialog must appear
    await expect(page.getByTestId('delete-warning-dialog')).toBeVisible({ timeout: 5_000 });
    // Cancel keeps the project
    await page.getByTestId('cancel-force-delete-btn').click();
    await expect(page.getByText(proj.name)).toBeVisible();
  });

  // AC4: only owner can edit — other user gets 404/403
  test("editing another user's project returns 403/404", async ({ page }) => {
    const userToken = await setupAuth(page, USER);
    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: `Bearer ${userToken}` },
    });
    const proj = await (await ctx.post('/api/projects', { data: { name: `OwnerOnly ${Date.now()}` } })).json();
    await ctx.dispose();

    const otherToken = await setupAuth(page, OTHER);
    const ctx2 = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: `Bearer ${otherToken}` },
    });
    const resp = await ctx2.put(`/api/projects/${proj.id}`, { data: { name: 'Hacked' } });
    expect([403, 404]).toContain(resp.status());
    await ctx2.dispose();
  });
});
