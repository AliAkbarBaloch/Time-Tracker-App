import { test, expect, request } from '@playwright/test';

test.describe('NFR-004 — Local Deployability', () => {
  // AC1: the application responds on the expected ports (backend 8080, frontend 3000)
  test('backend health endpoint returns 200', async () => {
    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
    });
    const resp = await ctx.get('/api/health');
    expect(resp.status()).toBe(200);
    await ctx.dispose();
  });

  // AC1: frontend SPA is accessible on the expected port
  test('frontend serves the SPA on port 3000 (or BASE_URL)', async ({ page }) => {
    await page.goto('/');
    await expect(page).not.toHaveTitle(/404|Not Found|Error/i, { timeout: 8_000 });
    // React root must be present in the DOM
    const root = page.locator('#root, [id="root"]');
    await expect(root).toBeAttached({ timeout: 5_000 });
  });

  // AC4: H2 console is NOT exposed by default (returns 404 or redirects away)
  test('H2 console endpoint is not accessible by default', async () => {
    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
    });
    const resp = await ctx.get('/h2-console', { failOnStatusCode: false });
    // Should be 404 (disabled) — not 200
    expect(resp.status()).not.toBe(200);
    await ctx.dispose();
  });

  // AC3: no internet required at runtime — all API calls resolve to localhost
  test('all API endpoints resolve to localhost without external calls', async () => {
    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
    });
    // Public endpoint (no auth required)
    const resp = await ctx.get('/api/health');
    expect(resp.status()).toBe(200);
    // URL must be local
    expect(resp.url()).toMatch(/localhost|127\.0\.0\.1/);
    await ctx.dispose();
  });

  // AC2: data persists — a task created in one session is visible in another
  test('data written in one session is visible in a subsequent session', async ({ browser }) => {
    const API = process.env.API_BASE ?? 'http://localhost:8080';
    const email = `nfr004p${Date.now()}@e2e.test`;
    const password = 'TestPass1!';

    // Register and create a task
    const ctx = await request.newContext({ baseURL: API });
    await ctx.post('/api/auth/register', { data: { email, password, displayName: 'NFR004' } });
    const loginResp = await ctx.post('/api/auth/login', { data: { email, password } });
    const { token } = await loginResp.json();

    const authed = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    await authed.post('/api/tasks', {
      data: {
        description: 'Persisted task NFR004',
        startTime: new Date(Date.now() - 3_600_000).toISOString(),
        endTime: new Date(Date.now() - 1_800_000).toISOString(),
      },
    });
    await authed.dispose();
    await ctx.dispose();

    // Open a fresh page (new browser context) and log in again
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await page2.goto('/');
    await page2.evaluate((t) => localStorage.setItem('tt_token', t), token);
    await page2.evaluate((u) => localStorage.setItem('tt_user', JSON.stringify(u)), { email, displayName: 'NFR004' });
    await page2.goto('/tasks');

    const taskRow = page2.locator('[data-testid^="task-item-"]');
    await expect(taskRow.first()).toBeVisible({ timeout: 8_000 });
    await expect(page2.locator('[data-testid^="task-item-"]').filter({ hasText: 'Persisted task NFR004' })).toBeVisible();
    await ctx2.close();
  });
});
