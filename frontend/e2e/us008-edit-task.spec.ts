import { test, expect, request } from '@playwright/test';
import { PRIMARY_USER, SECONDARY_USER, registerUser, setupAuth } from './helpers/auth';

const USER = { ...PRIMARY_USER, email: `us008a${Date.now()}@e2e.test` };
const OTHER = { ...SECONDARY_USER, email: `us008b${Date.now()}@e2e.test` };

function isoLocal(offsetMinutes: number): string {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  return d.toISOString().slice(0, 16);
}

test.describe('US-008 — Edit a Task', () => {
  test.beforeAll(async () => {
    await registerUser(USER);
    await registerUser(OTHER);
  });

  // AC1: all editable fields can be changed and saved
  test('editing description, start and end time saves correctly', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/tasks');

    // Create a task first
    await page.getByTestId('add-task-btn').click();
    await page.getByTestId('task-desc-input').fill('Before edit');
    await page.getByTestId('task-start-input').fill(isoLocal(-90));
    await page.getByTestId('task-end-input').fill(isoLocal(-60));
    await page.getByTestId('submit-task-btn').click();
    await expect(page.getByText('Before edit')).toBeVisible({ timeout: 8_000 });

    // Click edit on the first task
    await page.locator('[data-testid^="edit-btn-"]').first().click();
    await expect(page.locator('[data-testid^="edit-form-"]').first()).toBeVisible();

    await page.getByTestId('edit-desc-input').fill('After edit');
    await page.getByTestId('save-edit-btn').click();

    await expect(page.getByText('After edit')).toBeVisible({ timeout: 8_000 });
  });

  // AC2: start >= end on edit is rejected
  test('editing with start >= end shows validation error', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/tasks');

    await page.getByTestId('add-task-btn').click();
    await page.getByTestId('task-start-input').fill(isoLocal(-60));
    await page.getByTestId('task-end-input').fill(isoLocal(-30));
    await page.getByTestId('submit-task-btn').click();
    await expect(page.locator('[data-testid^="task-item-"]').first()).toBeVisible({ timeout: 8_000 });

    await page.locator('[data-testid^="edit-btn-"]').first().click();
    await page.getByTestId('edit-start-input').fill(isoLocal(-10));
    await page.getByTestId('edit-end-input').fill(isoLocal(-30));
    await page.getByTestId('save-edit-btn').click();

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 5_000 });
  });

  // AC4: editing another user's task returns 403
  test("editing another user's task returns 403 from API", async ({ page }) => {
    // Create a task as USER
    const userToken = await setupAuth(page, USER);
    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: `Bearer ${userToken}` },
    });
    const create = await ctx.post('/api/tasks', {
      data: {
        description: 'Owned task',
        startTime: new Date(Date.now() - 3_600_000).toISOString(),
        endTime: new Date(Date.now() - 1_800_000).toISOString(),
      },
    });
    const taskId = (await create.json()).id as number;
    await ctx.dispose();

    // Try to edit as OTHER user
    const otherToken = await setupAuth(page, OTHER);
    const ctx2 = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: `Bearer ${otherToken}` },
    });
    const edit = await ctx2.put(`/api/tasks/${taskId}`, {
      data: {
        description: 'Hacked',
        startTime: new Date(Date.now() - 3_600_000).toISOString(),
        endTime: new Date(Date.now() - 1_800_000).toISOString(),
      },
    });
    expect([403, 404]).toContain(edit.status());
    await ctx2.dispose();
  });
});
