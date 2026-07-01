import { test, expect } from '@playwright/test';
import { PRIMARY_USER, registerUser, setupAuth } from './helpers/auth';

const USER = { ...PRIMARY_USER, email: `us010${Date.now()}@e2e.test` };

test.describe('US-010 — Create a Project', () => {
  test.beforeAll(async () => {
    await registerUser(USER);
  });

  test.beforeEach(async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/projects');
    await page.getByTestId('new-project-btn').click();
    await expect(page.getByTestId('project-form')).toBeVisible();
  });

  // AC1: project with unique name saved and appears in list
  test('valid project is saved and appears in the project list', async ({ page }) => {
    const name = `Project ${Date.now()}`;
    await page.getByTestId('project-name-input').fill(name);
    await page.getByTestId('create-project-btn').click();

    await expect(page.getByTestId('project-list')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(name)).toBeVisible();
  });

  // AC2: duplicate name shows validation error
  test('duplicate project name shows an error', async ({ page }) => {
    const name = `Dup ${Date.now()}`;
    await page.getByTestId('project-name-input').fill(name);
    await page.getByTestId('create-project-btn').click();
    await expect(page.getByText(name)).toBeVisible({ timeout: 8_000 });

    // Try to create the same name again
    await page.getByTestId('new-project-btn').click();
    await page.getByTestId('project-name-input').fill(name);
    await page.getByTestId('create-project-btn').click();

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 5_000 });
  });

  // AC4: project name up to 100 characters is accepted
  test('project name of 100 characters is accepted', async ({ page }) => {
    const longName = 'A'.repeat(100);
    await page.getByTestId('project-name-input').fill(longName);
    await page.getByTestId('create-project-btn').click();

    await expect(page.getByText(longName)).toBeVisible({ timeout: 8_000 });
  });
});
