import { test, expect, request } from '@playwright/test';
import { PRIMARY_USER, registerUser, loginUser, setupAuth } from './helpers/auth';

const USER = { ...PRIMARY_USER, email: `us026${Date.now()}@e2e.test` };

const API = process.env.API_BASE ?? 'http://localhost:8080';

test.describe('US-026 — Project Time Budgets', () => {
  test.beforeAll(async () => {
    await registerUser(USER);
  });

  // AC1: creating a project with budgetHours stores the value
  test('creating a project with budgetHours stores and returns the value', async () => {
    const token = await loginUser(USER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    const resp = await ctx.post('/api/projects', { data: { name: `Budget ${Date.now()}`, budgetHours: 10 } });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    expect(body.budgetHours).toBe(10);
    await ctx.dispose();
  });

  // AC2: GET /api/projects/{id}/summary returns budgetHours, usedHours, budgetPercent, budgetStatus
  test('project summary returns budget fields', async () => {
    const token = await loginUser(USER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    const proj = await (await ctx.post('/api/projects', { data: { name: `BudgetSummary ${Date.now()}`, budgetHours: 5 } })).json();
    const resp = await ctx.get(`/api/projects/${proj.id}/summary`);
    const body = await resp.json();
    expect(body).toHaveProperty('budgetHours');
    expect(body).toHaveProperty('usedHours');
    expect(body).toHaveProperty('budgetPercent');
    expect(body).toHaveProperty('budgetStatus');
    await ctx.dispose();
  });

  // AC3–AC5: ON_TRACK / WARNING / OVER_BUDGET status thresholds
  test('budgetStatus is ON_TRACK when used < 80% of budget', async () => {
    const token = await loginUser(USER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    // Budget: 10h, add 1h task → ~10% used → ON_TRACK
    const proj = await (await ctx.post('/api/projects', { data: { name: `OnTrack ${Date.now()}`, budgetHours: 10 } })).json();
    await ctx.post('/api/tasks', {
      data: { description: 'small task', startTime: new Date(Date.now() - 3600000).toISOString(), endTime: new Date(Date.now() - 1800000).toISOString(), projectIds: [proj.id] },
    });
    const resp = await ctx.get(`/api/projects/${proj.id}/summary`);
    const body = await resp.json();
    expect(body.budgetStatus).toBe('ON_TRACK');
    await ctx.dispose();
  });

  test('budgetStatus is OVER_BUDGET when used >= budget', async () => {
    const token = await loginUser(USER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    // Budget: 1h, add 2h task → OVER_BUDGET
    const proj = await (await ctx.post('/api/projects', { data: { name: `OverBudget ${Date.now()}`, budgetHours: 1 } })).json();
    await ctx.post('/api/tasks', {
      data: { description: '2h task', startTime: new Date(Date.now() - 7200000).toISOString(), endTime: new Date(Date.now() - 3600000).toISOString(), projectIds: [proj.id] },
    });
    const resp = await ctx.get(`/api/projects/${proj.id}/summary`);
    const body = await resp.json();
    expect(body.budgetStatus).toBe('OVER_BUDGET');
    await ctx.dispose();
  });

  // AC6: projects without a budget show no progress bar
  test('project without budget has no progress bar in the list', async ({ page }) => {
    const token = await setupAuth(page, USER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    const proj = await (await ctx.post('/api/projects', { data: { name: `NoBudget ${Date.now()}` } })).json();
    await ctx.dispose();

    await page.goto('/projects');
    await expect(page.getByText(proj.name)).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId(`budget-bar-${proj.id}`)).not.toBeVisible();
  });

  // AC8: budget progress bar visible on project list card for project with budget
  test('project with budget shows progress bar in the list', async ({ page }) => {
    const token = await setupAuth(page, USER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    const proj = await (await ctx.post('/api/projects', { data: { name: `WithBudget ${Date.now()}`, budgetHours: 8 } })).json();
    await ctx.dispose();

    await page.goto('/projects');
    await expect(page.getByText(proj.name)).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId(`budget-bar-${proj.id}`)).toBeVisible();
  });

  // AC7: updating budgetHours to null removes the budget
  test('updating budgetHours to null removes the budget', async () => {
    const token = await loginUser(USER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    const proj = await (await ctx.post('/api/projects', { data: { name: `RemoveBudget ${Date.now()}`, budgetHours: 5 } })).json();
    await ctx.put(`/api/projects/${proj.id}`, { data: { name: proj.name, budgetHours: null } });
    const resp = await ctx.get(`/api/projects/${proj.id}/summary`);
    const body = await resp.json();
    expect(body.budgetHours).toBeNull();
    expect(body.budgetStatus).toBeNull();
    await ctx.dispose();
  });
});
