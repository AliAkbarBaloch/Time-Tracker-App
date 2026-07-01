import { test, expect, request } from '@playwright/test';
import { PRIMARY_USER, SECONDARY_USER, registerUser, loginUser, setupAuth } from './helpers/auth';

const USER  = { ...PRIMARY_USER,   email: `us027${Date.now()}@e2e.test` };
const OTHER = { ...SECONDARY_USER, email: `us027other${Date.now()}@e2e.test` };

const API = process.env.API_BASE ?? 'http://localhost:8080';

test.describe('US-027 — Task Templates', () => {
  test.beforeAll(async () => {
    await registerUser(USER);
    await registerUser(OTHER);
  });

  // AC1: create template with name, description, project associations
  test('creating a template returns it in GET /api/task-templates', async () => {
    const token = await loginUser(USER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    const resp = await ctx.post('/api/task-templates', { data: { name: 'Stand-up', description: 'Daily stand-up meeting' } });
    expect(resp.status()).toBe(201);
    const tpl = await resp.json();

    const listResp = await ctx.get('/api/task-templates');
    const list = await listResp.json();
    expect(list.some((t: { id: number }) => t.id === tpl.id)).toBe(true);
    await ctx.dispose();
  });

  // AC2: POST /api/task-templates/{id}/start creates a running task
  test('start-from-template creates a running task pre-filled with template data', async () => {
    const token = await loginUser(USER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    const tpl = await (await ctx.post('/api/task-templates', { data: { name: 'Code Review', description: 'Review PRs' } })).json();

    const startResp = await ctx.post(`/api/task-templates/${tpl.id}/start`);
    expect([200, 201]).toContain(startResp.status());
    const running = await startResp.json();
    expect(running.endTime).toBeNull();
    expect(running.description).toBe('Review PRs');

    // Clean up: stop the timer
    await ctx.post('/api/tasks/stop');
    await ctx.dispose();
  });

  // AC3: starting from template while timer already running returns 409
  test('start-from-template while timer running returns 409', async () => {
    const token = await loginUser(USER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    const tpl1 = await (await ctx.post('/api/task-templates', { data: { name: 'T1' } })).json();
    const tpl2 = await (await ctx.post('/api/task-templates', { data: { name: 'T2' } })).json();

    await ctx.post(`/api/task-templates/${tpl1.id}/start`);
    const resp = await ctx.post(`/api/task-templates/${tpl2.id}/start`);
    expect(resp.status()).toBe(409);

    await ctx.post('/api/tasks/stop');
    await ctx.dispose();
  });

  // AC4: templates are private — User A cannot access User B's templates
  test("User B cannot access User A's templates", async () => {
    const tokenA = await loginUser(USER);
    const ctxA = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${tokenA}` } });
    const tpl = await (await ctxA.post('/api/task-templates', { data: { name: 'Private Tpl' } })).json();
    await ctxA.dispose();

    const tokenB = await loginUser(OTHER);
    const ctxB = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${tokenB}` } });
    const putResp = await ctxB.put(`/api/task-templates/${tpl.id}`, { data: { name: 'Hacked' } });
    expect([403, 404]).toContain(putResp.status());
    const delResp = await ctxB.delete(`/api/task-templates/${tpl.id}`);
    expect([403, 404]).toContain(delResp.status());
    await ctxB.dispose();
  });

  // AC5: user can update and delete their own templates
  test('user can update and delete their own template', async () => {
    const token = await loginUser(USER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    const tpl = await (await ctx.post('/api/task-templates', { data: { name: 'OldName' } })).json();

    const putResp = await ctx.put(`/api/task-templates/${tpl.id}`, { data: { name: 'NewName' } });
    expect(putResp.status()).toBe(200);
    const updated = await putResp.json();
    expect(updated.name).toBe('NewName');

    const delResp = await ctx.delete(`/api/task-templates/${tpl.id}`);
    expect(delResp.status()).toBe(204);
    await ctx.dispose();
  });

  // UI: templates section visible on dashboard; new template form works
  test('dashboard shows templates section and new template form', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/dashboard');
    await expect(page.getByTestId('templates-section')).toBeVisible({ timeout: 8_000 });

    // Open new template form
    await page.getByTestId('new-template-btn').click();
    await expect(page.getByTestId('template-form')).toBeVisible({ timeout: 5_000 });

    // Fill and submit
    const tplName = `UI Tpl ${Date.now()}`;
    await page.getByTestId('template-name-input').fill(tplName);
    await page.getByTestId('create-template-btn').click();

    await expect(page.getByTestId('template-list')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('[data-testid^="template-card-"]').filter({ hasText: tplName })).toBeVisible();
  });

  // AC6: template list visible on dashboard with Start button per template
  test('each template card has a Start button', async ({ page }) => {
    await setupAuth(page, USER);
    await page.goto('/dashboard');
    await expect(page.getByTestId('template-list')).toBeVisible({ timeout: 8_000 });

    const cards = page.locator('[data-testid^="template-card-"]');
    await expect(cards.first()).toBeVisible();
    // First card must have a start button
    const firstId = await cards.first().getAttribute('data-testid');
    const id = firstId?.replace('template-card-', '');
    await expect(page.getByTestId(`template-start-btn-${id}`)).toBeVisible();
  });
});
