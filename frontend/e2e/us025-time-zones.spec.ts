import { test, expect, request } from '@playwright/test';
import { PRIMARY_USER, registerUser, loginUser, setupAuth } from './helpers/auth';

const USER = { ...PRIMARY_USER, email: `us025${Date.now()}@e2e.test` };

const API = process.env.API_BASE ?? 'http://localhost:8080';

test.describe('US-025 — Time Zones', () => {
  test.beforeAll(async () => {
    await registerUser(USER);
  });

  // AC8: default timezone for new users is "UTC"
  test('GET /api/users/profile returns UTC as default timezone', async () => {
    const token = await loginUser(USER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    const resp = await ctx.get('/api/users/profile');
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('timezone');
    expect(body.timezone).toBe('UTC');
    await ctx.dispose();
  });

  // AC1: user can set preferred timezone; GET /api/users/profile returns it
  test('PUT /api/users/profile updates timezone; GET returns new value', async () => {
    const token = await loginUser(USER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    const putResp = await ctx.put('/api/users/profile', { data: { timezone: 'Europe/Berlin' } });
    expect(putResp.status()).toBe(200);

    const getResp = await ctx.get('/api/users/profile');
    const body = await getResp.json();
    expect(body.timezone).toBe('Europe/Berlin');

    // Reset back to UTC for isolation
    await ctx.put('/api/users/profile', { data: { timezone: 'UTC' } });
    await ctx.dispose();
  });

  // AC4: invalid IANA zone rejected with 400
  test('invalid timezone string is rejected with 400', async () => {
    const token = await loginUser(USER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    const resp = await ctx.put('/api/users/profile', { data: { timezone: 'Not/AZone' } });
    expect(resp.status()).toBe(400);
    await ctx.dispose();
  });

  // AC5: changing timezone does not alter stored UTC timestamps
  test('stored task startTime is unchanged after timezone update', async () => {
    const token = await loginUser(USER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    const startTime = new Date(Date.now() - 3600000).toISOString();
    const taskResp = await ctx.post('/api/tasks', {
      data: { description: 'TZ test task', startTime, endTime: new Date(Date.now() - 1800000).toISOString() },
    });
    const task = await taskResp.json();
    const originalStart = task.startTime;

    // Change timezone to America/New_York
    await ctx.put('/api/users/profile', { data: { timezone: 'America/New_York' } });

    // Fetch tasks and confirm startTime unchanged
    const listResp = await ctx.get('/api/tasks');
    const tasks = await listResp.json();
    const found = tasks.find((t: { id: number }) => t.id === task.id);
    expect(found).toBeDefined();
    expect(found.startTime).toBe(originalStart);

    // Reset
    await ctx.put('/api/users/profile', { data: { timezone: 'UTC' } });
    await ctx.dispose();
  });

  // UI: timezone selector is visible in Settings page and saves successfully
  test('settings page timezone selector saves and confirms new timezone', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/settings');
    await expect(page.getByTestId('timezone-select')).toBeVisible({ timeout: 8_000 });

    // Change to America/New_York
    await page.getByTestId('timezone-select').selectOption('America/New_York');
    await page.getByTestId('timezone-submit-btn').click();
    await expect(page.getByTestId('timezone-success')).toBeVisible({ timeout: 5_000 });

    // Reset back for test isolation
    await page.getByTestId('timezone-select').selectOption('UTC');
    await page.getByTestId('timezone-submit-btn').click();
  });
});
