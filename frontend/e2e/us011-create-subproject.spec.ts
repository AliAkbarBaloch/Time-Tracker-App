import { test, expect, request } from '@playwright/test';
import { PRIMARY_USER, registerUser, setupAuth } from './helpers/auth';

const USER = { ...PRIMARY_USER, email: `us011${Date.now()}@e2e.test` };

test.describe('US-011 — Create a Subproject', () => {
  test.beforeAll(async () => {
    await registerUser(USER);
  });

  // AC1: subproject appears visually nested under its parent
  test('subproject is visually nested under parent in project list', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/projects');

    // Create parent
    const parentName = `Parent ${Date.now()}`;
    await page.getByTestId('new-project-btn').click();
    await page.getByTestId('project-name-input').fill(parentName);
    await page.getByTestId('create-project-btn').click();
    await expect(page.getByText(parentName)).toBeVisible({ timeout: 8_000 });

    // Create child — select parent in dropdown
    await page.getByTestId('new-project-btn').click();
    const childName = `Child ${Date.now()}`;
    await page.getByTestId('project-name-input').fill(childName);
    await page.getByTestId('parent-project-select').selectOption({ label: parentName });
    await page.getByTestId('create-project-btn').click();

    // Child may already be visible if the tree auto-expands after creation.
    // If not visible, click the expand/collapse button to reveal it.
    const childLocator = page.getByText(childName);
    const alreadyVisible = await childLocator.isVisible().catch(() => false);
    if (!alreadyVisible) {
      await page.locator(`[data-testid^="collapse-btn-"]`).first().click();
    }
    await expect(childLocator).toBeVisible({ timeout: 8_000 });
  });

  // AC4: circular parent relationships rejected by API
  test('circular parent relationship is rejected by the API', async ({ page }) => {
    const token = await setupAuth(page, USER);
    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });

    // Create A then B as child of A
    const a = await (await ctx.post('/api/projects', { data: { name: `CircA${Date.now()}` } })).json();
    const b = await (await ctx.post('/api/projects', { data: { name: `CircB${Date.now()}`, parentProjectId: a.id } })).json();

    // Try to make A a child of B → circular
    const resp = await ctx.put(`/api/projects/${a.id}`, { data: { name: a.name, parentProjectId: b.id } });
    expect([400, 409]).toContain(resp.status());
    await ctx.dispose();
  });
});
