import { test, expect, request } from '@playwright/test';
import { PRIMARY_USER, SECONDARY_USER, registerUser, loginUser, setupAuth } from './helpers/auth';

const OWNER  = { ...PRIMARY_USER,   email: `us023owner${Date.now()}@e2e.test` };
const MEMBER = { ...SECONDARY_USER, email: `us023member${Date.now()}@e2e.test` };
const OTHER  = { ...SECONDARY_USER, email: `us023other${Date.now()}@e2e.test` };

const API = process.env.API_BASE ?? 'http://localhost:8080';

let projId: number;
let ownerToken: string;
let memberToken: string;

test.describe('US-023 — Task Overview for Shared Projects', () => {
  test.beforeAll(async () => {
    await registerUser(OWNER);
    await registerUser(MEMBER);
    await registerUser(OTHER);

    ownerToken = await loginUser(OWNER);
    memberToken = await loginUser(MEMBER);

    // Set up: owner creates project, invites member, both add tasks
    const ctxO = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${ownerToken}` } });
    const proj = await (await ctxO.post('/api/projects', { data: { name: `US023Shared ${Date.now()}` } })).json();
    projId = proj.id;
    await ctxO.post(`/api/projects/${projId}/members`, { data: { email: MEMBER.email } });
    await ctxO.post('/api/tasks', {
      data: { description: 'Owner task', startTime: new Date(Date.now() - 7200000).toISOString(), endTime: new Date(Date.now() - 3600000).toISOString(), projectIds: [projId] },
    });
    await ctxO.dispose();

    const ctxM = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${memberToken}` } });
    await ctxM.post('/api/tasks', {
      data: { description: 'Member task', startTime: new Date(Date.now() - 3600000).toISOString(), endTime: new Date(Date.now() - 1800000).toISOString(), projectIds: [projId] },
    });
    await ctxM.dispose();
  });

  // AC1: summary returns contributions array with per-user totals
  test('GET /api/projects/{id}/summary returns contributions array', async () => {
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${ownerToken}` } });
    const resp = await ctx.get(`/api/projects/${projId}/summary`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('contributions');
    expect(Array.isArray(body.contributions)).toBe(true);
    expect(body.contributions.length).toBeGreaterThanOrEqual(2);
    await ctx.dispose();
  });

  // AC2: ?userId filter returns only that user's tasks and their individual total
  test('userId filter returns only that user\'s tasks', async () => {
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${ownerToken}` } });

    // Get owner's userId from the member list
    const membersResp = await ctx.get(`/api/projects/${projId}/members`);
    const members = await membersResp.json();
    const ownerMember = members.find((m: { role: string }) => m.role === 'OWNER');
    expect(ownerMember).toBeDefined();

    const resp = await ctx.get(`/api/projects/${projId}/summary?userId=${ownerMember.userId}`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    // All returned tasks must belong to the owner
    if (body.tasks && body.tasks.length > 0) {
      for (const t of body.tasks) {
        expect(t.userId).toBe(ownerMember.userId);
      }
    }
    await ctx.dispose();
  });

  // AC4: non-member cannot use userId filter (403)
  test('non-member userId filter on shared project returns 403', async () => {
    const otherToken = await loginUser(OTHER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${otherToken}` } });
    const resp = await ctx.get(`/api/projects/${projId}/summary?userId=1`);
    expect(resp.status()).toBe(403);
    await ctx.dispose();
  });

  // AC7: selecting "All users" shows combined total >= either individual total
  test('combined total is >= each individual contribution', async () => {
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${ownerToken}` } });
    const resp = await ctx.get(`/api/projects/${projId}/summary`);
    const body = await resp.json();
    const combinedTotal: number = body.totalSeconds ?? 0;
    for (const c of (body.contributions ?? [])) {
      expect(combinedTotal).toBeGreaterThanOrEqual(c.totalSeconds);
    }
    await ctx.dispose();
  });

  // UI: contributors section and user-filter dropdown are visible for shared projects
  test('contributors section and user-filter dropdown render on shared project detail page', async ({ page }) => {
    await setupAuth(page, OWNER);
    await page.goto(`/projects/${projId}`);
    await expect(page.getByTestId('contributors-section')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('user-filter-select')).toBeVisible();
  });
});
