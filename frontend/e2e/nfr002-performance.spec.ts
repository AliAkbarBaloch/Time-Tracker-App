import { test, expect, request } from '@playwright/test';
import { PRIMARY_USER, registerUser, setupAuth } from './helpers/auth';

const USER = { ...PRIMARY_USER, email: `nfr002${Date.now()}@e2e.test` };

test.describe('NFR-002 — Performance', () => {
  test.beforeAll(async () => {
    await registerUser(USER);
  });

  // AC1: initial dashboard load completes in under 1 second on localhost
  test('dashboard page loads within 1 second', async ({ page }) => {
    await setupAuth(page, USER);

    const start = Date.now();
    await page.goto('/dashboard');
    await expect(page.getByTestId('dashboard-summary')).toBeVisible({ timeout: 5_000 });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(1000);
  });

  // AC4: single API call for dashboard summary data (no waterfall)
  test('GET /api/dashboard/summary returns aggregated data in one call', async () => {
    const token = await (async () => {
      const ctx = await request.newContext({ baseURL: process.env.API_BASE ?? 'http://localhost:8080' });
      const resp = await ctx.post('/api/auth/login', { data: { email: USER.email, password: USER.password } });
      const body = await resp.json();
      await ctx.dispose();
      return body.token;
    })();

    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    const before = Date.now();
    const resp = await ctx.get('/api/dashboard/summary');
    const responseTime = Date.now() - before;
    // Buffer JSON BEFORE disposing — disposing frees the response buffer
    const body = await resp.json();
    await ctx.dispose();

    expect(resp.status()).toBe(200);
    expect(responseTime).toBeLessThan(1000);

    // Response must contain all aggregated fields in one payload
    expect(body).toHaveProperty('todaySeconds');
    expect(body).toHaveProperty('weekSeconds');
    expect(body).toHaveProperty('topProjects');
  });

  // AC3: production frontend is served as a static bundle (not the Vite dev server)
  test('frontend entry point is served as a production HTML document', async ({ page }) => {
    const resp = await page.goto('/');
    expect(resp?.status()).toBe(200);

    // The page must load React and not show a Vite error screen
    await expect(page).not.toHaveTitle(/Error/i, { timeout: 5_000 });

    // HTML must reference a hashed JS bundle (Vite production output pattern)
    const html = await page.content();
    expect(html).toMatch(/src="[^"]*\.js"/);
  });
});
