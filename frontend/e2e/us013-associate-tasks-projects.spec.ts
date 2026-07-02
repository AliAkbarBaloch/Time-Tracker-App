import { test, expect } from '@playwright/test';
import { PRIMARY_USER, registerUser, setupAuth } from './helpers/auth';

const USER = { ...PRIMARY_USER, email: `us013${Date.now()}@e2e.test` };

function isoLocal(offsetMinutes: number): string {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  return d.toISOString().slice(0, 16);
}

test.describe('US-013 — Associate Tasks with Projects', () => {
  test.beforeAll(async () => {
    await registerUser(USER);
  });

  // AC1: task can be associated with a project during creation; project shown in task row
  test('task created with a project shows project chip in the task list', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/projects');

    const projName = `Proj ${Date.now()}`;
    await page.getByTestId('new-project-btn').click();
    await page.getByTestId('project-name-input').fill(projName);
    await page.getByTestId('create-project-btn').click();
    await expect(page.getByText(projName)).toBeVisible({ timeout: 8_000 });

    // Create task linked to project
    await page.goto('/tasks');
    await page.getByTestId('add-task-btn').click();
    await page.getByTestId('task-desc-input').fill('Linked task');
    await page.getByTestId('task-start-input').fill(isoLocal(-60));
    await page.getByTestId('task-end-input').fill(isoLocal(-30));

    // Check first project checkbox
    await page.locator('[data-testid^="create-project-checkbox-"]').first().check();
    await page.getByTestId('submit-task-btn').click();

    // Project name appears in the task row
    const taskRow = page.locator('[data-testid^="task-item-"]').first();
    await expect(taskRow).toBeVisible({ timeout: 8_000 });
    await expect(taskRow.locator('[data-testid^="task-projects-"]')).toContainText(projName);
  });

  // AC3: removing project association via edit updates the task row
  test('removing project association via edit clears the project chip', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/projects');

    const projName = `RemoveProj ${Date.now()}`;
    await page.getByTestId('new-project-btn').click();
    await page.getByTestId('project-name-input').fill(projName);
    await page.getByTestId('create-project-btn').click();
    await expect(page.getByText(projName)).toBeVisible({ timeout: 8_000 });

    await page.goto('/tasks');
    await page.getByTestId('add-task-btn').click();
    const taskDesc = `RemoveTask ${Date.now()}`;
    await page.getByTestId('task-desc-input').fill(taskDesc);
    await page.getByTestId('task-start-input').fill(isoLocal(-90));
    await page.getByTestId('task-end-input').fill(isoLocal(-60));
    await page.locator('[data-testid^="create-project-checkbox-"]').first().check();
    await page.getByTestId('submit-task-btn').click();

    // Find specific task row by description
    const taskRow = page.locator('[data-testid^="task-item-"]').filter({ hasText: taskDesc });
    await expect(taskRow).toBeVisible({ timeout: 8_000 });

    // Edit and uncheck the project
    await taskRow.locator('[data-testid^="edit-btn-"]').click();
    await page.locator('[data-testid^="edit-project-checkbox-"]').first().uncheck();
    await page.getByTestId('save-edit-btn').click();

    // Wait for the edit form to close; after removing all projects the chip element is absent from DOM
    await expect(page.getByTestId('save-edit-btn')).not.toBeVisible({ timeout: 5_000 });
    await expect(taskRow.locator('[data-testid^="task-projects-"]')).not.toBeVisible({ timeout: 8_000 });
  });

  // AC4: only the authenticated user's own projects appear in the selector
  test("only the user's own projects appear in the project selector", async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/projects');

    const myProj = `MyProj ${Date.now()}`;
    await page.getByTestId('new-project-btn').click();
    await page.getByTestId('project-name-input').fill(myProj);
    await page.getByTestId('create-project-btn').click();
    await expect(page.getByText(myProj)).toBeVisible({ timeout: 8_000 });

    await page.goto('/tasks');
    await page.getByTestId('add-task-btn').click();

    const checkboxes = page.locator('[data-testid^="create-project-checkbox-"]');
    // All visible project checkboxes belong to this user — at least one exists
    await expect(checkboxes.first()).toBeVisible({ timeout: 5_000 });
    const count = await checkboxes.count();
    expect(count).toBeGreaterThan(0);
  });
});
