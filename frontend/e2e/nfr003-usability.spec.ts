import { test, expect } from '@playwright/test';
import { PRIMARY_USER, registerUser, setupAuth } from './helpers/auth';

const USER = { ...PRIMARY_USER, email: `nfr003${Date.now()}@e2e.test` };

test.describe('NFR-003 — Usability', () => {
  test.beforeAll(async () => {
    await registerUser(USER);
  });

  // AC1: start tracking in ≤ 1 click from the dashboard (start button is directly clickable)
  test('Start Timer button is clickable with a single click from the dashboard', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/dashboard');

    await expect(page.getByTestId('start-btn')).toBeVisible({ timeout: 8_000 });
    await page.getByTestId('start-btn').click();
    await expect(page.getByTestId('elapsed')).toBeVisible({ timeout: 5_000 });

    // Clean up
    await page.getByTestId('stop-btn').click();
  });

  // Add task requires ≤ 2 clicks from the tasks page (one click to open form, one to submit)
  test('Add task form is reachable within 2 clicks from the tasks page', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/tasks');

    // Click 1: open the add task form
    await page.getByTestId('add-task-btn').click();
    await expect(page.getByTestId('add-task-form')).toBeVisible({ timeout: 5_000 });
  });

  // AC4: running task always visible without scrolling (topbar-timer is always in the viewport)
  test('running timer is visible in the topbar on every page without scrolling', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/dashboard');
    await page.getByTestId('start-btn').click();
    await expect(page.getByTestId('elapsed')).toBeVisible({ timeout: 8_000 });

    for (const route of ['/tasks', '/projects', '/overview', '/dashboard']) {
      await page.goto(route);
      const timer = page.getByTestId('topbar-timer');
      await expect(timer).toBeVisible({ timeout: 5_000 });
      const box = await timer.boundingBox();
      expect(box).not.toBeNull();
      // Must be within the viewport vertically (not below the fold)
      const viewportHeight = page.viewportSize()?.height ?? 768;
      expect(box!.y + box!.height).toBeLessThan(viewportHeight);
    }

    await page.goto('/dashboard');
    await page.getByTestId('stop-btn').click();
  });

  // AC2: forms show field-level error messages when validation fails
  test('registration form shows field-level errors for invalid inputs', async ({ page }) => {
    await page.goto('/login');
    // Switch to the Register tab
    await page.getByRole('button', { name: /register/i }).click();
    // Touch each field to activate React's dirty state, then clear it
    for (const id of ['#displayName', '#email', '#password']) {
      await page.locator(id).fill('x');
      await page.locator(id).fill('');
    }
    await page.getByTestId('confirm-password-input').fill('x');
    await page.getByTestId('confirm-password-input').fill('');
    // Submit with empty fields — field-level errors should appear
    await page.getByRole('button', { name: /create account/i }).click();
    const errors = page.locator('[data-testid^="error-"]');
    await expect(errors.first()).toBeVisible({ timeout: 5_000 });
  });

  // AC3: layout does not break at 1024px, 1280px, 1440px
  test('dashboard layout is functional at 1024px, 1280px, and 1440px viewports', async ({ page }) => {
    for (const width of [1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 768 });
      await setupAuth(page, USER);
      await page.goto('/dashboard');
      await expect(page.getByTestId('dashboard-summary')).toBeVisible({ timeout: 8_000 });
      // No horizontal scroll on the body
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(bodyWidth).toBeLessThanOrEqual(width + 5);
    }
  });
});
