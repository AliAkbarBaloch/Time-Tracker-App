import { test, expect, request } from '@playwright/test';
import { PRIMARY_USER, registerUser, loginUser, setupAuth } from './helpers/auth';

const USER = { ...PRIMARY_USER, email: `us024${Date.now()}@e2e.test` };
const OTHER = { ...PRIMARY_USER, email: `us024other${Date.now()}@e2e.test` };

const API = process.env.API_BASE ?? 'http://localhost:8080';

test.describe('US-024 — Export Project Tasks as CSV or JSON', () => {
  test.beforeAll(async () => {
    await registerUser(USER);
    await registerUser(OTHER);
  });

  // AC1: GET /api/projects/{id}/export returns a downloadable CSV file with correct headers
  test('export returns CSV with Content-Disposition attachment header', async () => {
    const token = await loginUser(USER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    const proj = await (await ctx.post('/api/projects', { data: { name: `ExportCSV ${Date.now()}` } })).json();
    await ctx.post('/api/tasks', {
      data: { description: 'Export task', startTime: new Date(Date.now() - 3600000).toISOString(), endTime: new Date(Date.now() - 1800000).toISOString(), projectIds: [proj.id] },
    });
    const resp = await ctx.get(`/api/projects/${proj.id}/export`);
    expect(resp.status()).toBe(200);
    const disposition = resp.headers()['content-disposition'] ?? '';
    expect(disposition).toMatch(/attachment/i);
    expect(disposition).toMatch(/\.csv/i);
    await ctx.dispose();
  });

  // AC2: ?format=json returns a JSON file
  test('export with format=json returns JSON with correct structure', async () => {
    const token = await loginUser(USER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    const proj = await (await ctx.post('/api/projects', { data: { name: `ExportJSON ${Date.now()}` } })).json();
    await ctx.post('/api/tasks', {
      data: { description: 'JSON export task', startTime: new Date(Date.now() - 3600000).toISOString(), endTime: new Date(Date.now() - 1800000).toISOString(), projectIds: [proj.id] },
    });
    const resp = await ctx.get(`/api/projects/${proj.id}/export?format=json`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('project');
    expect(body).toHaveProperty('tasks');
    expect(Array.isArray(body.tasks)).toBe(true);
    await ctx.dispose();
  });

  // AC3: each exported task includes start time, end time, duration, project path, user
  test('CSV export contains required columns', async () => {
    const token = await loginUser(USER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    const proj = await (await ctx.post('/api/projects', { data: { name: `ExportCols ${Date.now()}` } })).json();
    await ctx.post('/api/tasks', {
      data: { description: 'Col task', startTime: new Date(Date.now() - 3600000).toISOString(), endTime: new Date(Date.now() - 1800000).toISOString(), projectIds: [proj.id] },
    });
    const resp = await ctx.get(`/api/projects/${proj.id}/export`);
    const text = await resp.text();
    // Header row must contain required columns
    const header = text.split('\n')[0].toLowerCase();
    expect(header).toContain('description');
    expect(header).toContain('start_time');
    expect(header).toContain('end_time');
    expect(header).toContain('duration_seconds');
    await ctx.dispose();
  });

  // AC4: ?year=&month= filters to that month only
  test('year+month filter returns only tasks in that month', async () => {
    const token = await loginUser(USER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    const proj = await (await ctx.post('/api/projects', { data: { name: `ExportMonth ${Date.now()}` } })).json();
    await ctx.post('/api/tasks', {
      data: { description: 'In month', startTime: new Date(Date.now() - 3600000).toISOString(), endTime: new Date(Date.now() - 1800000).toISOString(), projectIds: [proj.id] },
    });
    const now = new Date();
    const resp = await ctx.get(`/api/projects/${proj.id}/export?year=${now.getFullYear()}&month=${now.getMonth() + 1}`);
    expect(resp.status()).toBe(200);
    // Response with correct month filter — next month returns empty CSV (only header row)
    const nextMonth = now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2;
    const nextYear  = now.getMonth() + 2 > 12 ? now.getFullYear() + 1 : now.getFullYear();
    const emptyResp = await ctx.get(`/api/projects/${proj.id}/export?year=${nextYear}&month=${nextMonth}`);
    expect(emptyResp.status()).toBe(200);
    const emptyText = await emptyResp.text();
    // Only header row — no data rows
    expect(emptyText.trim().split('\n').length).toBe(1);
    await ctx.dispose();
  });

  // AC7: non-member request returns 403
  test('non-member export request returns 403', async () => {
    const ownerToken = await loginUser(USER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${ownerToken}` } });
    const proj = await (await ctx.post('/api/projects', { data: { name: `ExportPrivate ${Date.now()}` } })).json();
    await ctx.dispose();

    const otherToken = await loginUser(OTHER);
    const ctx2 = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${otherToken}` } });
    const resp = await ctx2.get(`/api/projects/${proj.id}/export`);
    expect(resp.status()).toBe(403);
    await ctx2.dispose();
  });

  // UI: export button opens modal with format and scope controls
  test('export button opens modal with format and scope selectors', async ({ page }) => {
    const token = await setupAuth(page, USER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    const proj = await (await ctx.post('/api/projects', { data: { name: `ExportUI ${Date.now()}` } })).json();
    await ctx.dispose();

    await page.goto(`/projects/${proj.id}`);
    await expect(page.getByTestId('export-btn')).toBeVisible({ timeout: 8_000 });
    await page.getByTestId('export-btn').click();
    await expect(page.getByTestId('export-modal')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('export-format-csv')).toBeVisible();
    await expect(page.getByTestId('export-format-json')).toBeVisible();
    await expect(page.getByTestId('export-scope-all')).toBeVisible();
    await expect(page.getByTestId('export-scope-month')).toBeVisible();
  });
});
