import { test, expect, request } from '@playwright/test';
import { PRIMARY_USER, SECONDARY_USER, registerUser, setupAuth } from './helpers/auth';

const USER = { ...PRIMARY_USER, email: `us009a${Date.now()}@e2e.test` };
const OTHER = { ...SECONDARY_USER, email: `us009b${Date.now()}@e2e.test` };

function isoLocal(offsetMinutes: number): string {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  return d.toISOString().slice(0, 16);
}

test.describe('US-009 — Delete a Task', () => {
  test.beforeAll(async () => {
    await registerUser(USER);
    await registerUser(OTHER);
  });

  // AC2: confirming deletion removes the task from the UI
  test('confirming delete removes the task from the list', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/tasks');

    await page.getByTestId('add-task-btn').click();
    await page.getByTestId('task-desc-input').fill('To be deleted');
    await page.getByTestId('task-start-input').fill(isoLocal(-60));
    await page.getByTestId('task-end-input').fill(isoLocal(-30));
    await page.getByTestId('submit-task-btn').click();
    await expect(page.getByText('To be deleted')).toBeVisible({ timeout: 8_000 });

    // Click delete; if a confirmation dialog appears, confirm it
    await page.locator('[data-testid^="delete-btn-"]').first().click();
    const confirmBtn = page.locator('[data-testid="confirm-delete-btn"], button:has-text("Delete"), button:has-text("Confirm"), button:has-text("Yes")');
    if (await confirmBtn.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await confirmBtn.click();
    }

    await expect(page.getByText('To be deleted')).not.toBeVisible({ timeout: 8_000 });
  });

  // AC1: after deletion the list is empty (or shows no-tasks message)
  test('after deleting the only task the empty state message appears', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/tasks');

    await page.getByTestId('add-task-btn').click();
    await page.getByTestId('task-start-input').fill(isoLocal(-60));
    await page.getByTestId('task-end-input').fill(isoLocal(-30));
    await page.getByTestId('submit-task-btn').click();
    await expect(page.locator('[data-testid^="task-item-"]').first()).toBeVisible({ timeout: 8_000 });

    await page.locator('[data-testid^="delete-btn-"]').first().click();
    const confirmBtn2 = page.locator('[data-testid="confirm-delete-btn"], button:has-text("Delete"), button:has-text("Confirm"), button:has-text("Yes")');
    if (await confirmBtn2.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await confirmBtn2.click();
    }

    await expect(page.getByTestId('no-tasks-message')).toBeVisible({ timeout: 8_000 });
  });

  // AC4: deleting another user's task returns 403/404
  test("deleting another user's task returns 403/404 from API", async ({ page }) => {
    const userToken = await setupAuth(page, USER);
    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: `Bearer ${userToken}` },
    });
    const create = await ctx.post('/api/tasks', {
      data: {
        description: 'Owned',
        startTime: new Date(Date.now() - 3_600_000).toISOString(),
        endTime: new Date(Date.now() - 1_800_000).toISOString(),
      },
    });
    const taskId = (await create.json()).id as number;
    await ctx.dispose();

    const otherToken = await setupAuth(page, OTHER);
    const ctx2 = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: `Bearer ${otherToken}` },
    });
    const del = await ctx2.delete(`/api/tasks/${taskId}`);
    expect([403, 404]).toContain(del.status());
    await ctx2.dispose();
  });
});
