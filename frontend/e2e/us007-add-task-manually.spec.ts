import { test, expect } from '@playwright/test';
import { PRIMARY_USER, registerUser, setupAuth } from './helpers/auth';

const USER = { ...PRIMARY_USER, email: `us007${Date.now()}@e2e.test` };

function isoLocal(offsetMinutes: number): string {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  return d.toISOString().slice(0, 16);
}

test.describe('US-007 — Add a Task Manually', () => {
  test.beforeAll(async () => {
    await registerUser(USER);
  });

  test.beforeEach(async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/tasks');
    await page.getByTestId('add-task-btn').click();
    await expect(page.getByTestId('add-task-form')).toBeVisible();
  });

  // AC1: valid task is saved and appears in the task list
  test('valid task is saved and appears in the task list', async ({ page }) => {
    await page.getByTestId('task-desc-input').fill('Manual task E2E');
    await page.getByTestId('task-start-input').fill(isoLocal(-60));
    await page.getByTestId('task-end-input').fill(isoLocal(-30));
    await page.getByTestId('submit-task-btn').click();

    await expect(page.getByTestId('task-list')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('Manual task E2E')).toBeVisible();
  });

  // AC1: task is indistinguishable from timer-tracked tasks in the UI (same list item structure)
  test('manually added task appears in task list like any other task', async ({ page }) => {
    await page.getByTestId('task-start-input').fill(isoLocal(-120));
    await page.getByTestId('task-end-input').fill(isoLocal(-90));
    await page.getByTestId('submit-task-btn').click();

    await expect(page.getByTestId('task-list')).toBeVisible({ timeout: 8_000 });
    // Task items have edit + delete buttons — same as timer tasks
    const firstTask = page.locator('[data-testid^="task-item-"]').first();
    await expect(firstTask.locator('[data-testid^="edit-btn-"]')).toBeVisible();
    await expect(firstTask.locator('[data-testid^="delete-btn-"]')).toBeVisible();
  });

  // AC2: start >= end shows validation error
  test('start time after end time shows validation error', async ({ page }) => {
    await page.getByTestId('task-start-input').fill(isoLocal(-30));
    await page.getByTestId('task-end-input').fill(isoLocal(-60));
    await page.getByTestId('submit-task-btn').click();

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 5_000 });
  });
});
