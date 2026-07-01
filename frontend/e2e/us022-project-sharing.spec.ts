import { test, expect, request } from '@playwright/test';
import { PRIMARY_USER, SECONDARY_USER, registerUser, loginUser, setupAuth } from './helpers/auth';

const OWNER = { ...PRIMARY_USER,   email: `us022owner${Date.now()}@e2e.test` };
const MEMBER = { ...SECONDARY_USER, email: `us022member${Date.now()}@e2e.test` };
const STRANGER = { ...SECONDARY_USER, email: `us022stranger${Date.now()}@e2e.test` };

const API = process.env.API_BASE ?? 'http://localhost:8080';

test.describe('US-022 — Project Sharing', () => {
  test.beforeAll(async () => {
    await registerUser(OWNER);
    await registerUser(MEMBER);
    await registerUser(STRANGER);
  });

  // AC1: owner can invite a registered user; invitee sees project immediately
  test('invited member sees the shared project in their project list', async ({ page }) => {
    const ownerToken = await loginUser(OWNER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${ownerToken}` } });
    const proj = await (await ctx.post('/api/projects', { data: { name: `Shared ${Date.now()}` } })).json();
    const inviteResp = await ctx.post(`/api/projects/${proj.id}/members`, { data: { email: MEMBER.email } });
    expect(inviteResp.status()).toBe(201);
    await ctx.dispose();

    // Member sees shared project in their list
    await setupAuth(page, MEMBER);
    await page.goto('/projects');
    await expect(page.getByText(proj.name)).toBeVisible({ timeout: 8_000 });
    // Shared badge visible
    await expect(page.getByTestId(`shared-badge-${proj.id}`)).toBeVisible();
  });

  // AC2: inviting an unknown email returns 404
  test('inviting an unknown email returns 404', async () => {
    const ownerToken = await loginUser(OWNER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${ownerToken}` } });
    const proj = await (await ctx.post('/api/projects', { data: { name: `NoInvite ${Date.now()}` } })).json();
    const resp = await ctx.post(`/api/projects/${proj.id}/members`, { data: { email: 'nobody@nowhere.invalid' } });
    expect(resp.status()).toBe(404);
    await ctx.dispose();
  });

  // AC3: inviting an already-invited user returns 409
  test('inviting an already-invited user returns 409', async () => {
    const ownerToken = await loginUser(OWNER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${ownerToken}` } });
    const proj = await (await ctx.post('/api/projects', { data: { name: `Dup ${Date.now()}` } })).json();
    await ctx.post(`/api/projects/${proj.id}/members`, { data: { email: MEMBER.email } });
    const dup = await ctx.post(`/api/projects/${proj.id}/members`, { data: { email: MEMBER.email } });
    expect(dup.status()).toBe(409);
    await ctx.dispose();
  });

  // AC5: non-member GET /api/projects/{id} returns 403
  test('non-member cannot access project summary (403)', async () => {
    const ownerToken = await loginUser(OWNER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${ownerToken}` } });
    const proj = await (await ctx.post('/api/projects', { data: { name: `Private ${Date.now()}` } })).json();
    await ctx.dispose();

    const strangerToken = await loginUser(STRANGER);
    const ctx2 = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${strangerToken}` } });
    const resp = await ctx2.get(`/api/projects/${proj.id}/summary`);
    expect(resp.status()).toBe(403);
    await ctx2.dispose();
  });

  // AC6: owner can remove a member; removed member loses access
  test('removed member loses access to the shared project', async () => {
    const ownerToken = await loginUser(OWNER);
    const memberToken = await loginUser(MEMBER);

    const ctxOwner = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${ownerToken}` } });
    const proj = await (await ctxOwner.post('/api/projects', { data: { name: `RemoveMember ${Date.now()}` } })).json();
    const invResp = await ctxOwner.post(`/api/projects/${proj.id}/members`, { data: { email: MEMBER.email } });
    const member = await invResp.json();
    await ctxOwner.delete(`/api/projects/${proj.id}/members/${member.userId}`);
    await ctxOwner.dispose();

    const ctxMember = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${memberToken}` } });
    const resp = await ctxMember.get(`/api/projects/${proj.id}/summary`);
    expect([403, 404]).toContain(resp.status());
    await ctxMember.dispose();
  });

  // AC9: shared project shows visual badge in project list
  // (covered inside AC1 test above — shared-badge visible)

  // AC10: GET /api/projects/{id}/members returns name, email, role
  test('members list returns name, email, and role for each participant', async () => {
    const ownerToken = await loginUser(OWNER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${ownerToken}` } });
    const proj = await (await ctx.post('/api/projects', { data: { name: `Members ${Date.now()}` } })).json();
    await ctx.post(`/api/projects/${proj.id}/members`, { data: { email: MEMBER.email } });
    const resp = await ctx.get(`/api/projects/${proj.id}/members`);
    expect(resp.status()).toBe(200);
    const members = await resp.json();
    expect(Array.isArray(members)).toBe(true);
    expect(members.length).toBeGreaterThanOrEqual(2);
    for (const m of members) {
      expect(m).toHaveProperty('displayName');
      expect(m).toHaveProperty('email');
      expect(m).toHaveProperty('role');
    }
    await ctx.dispose();
  });

  // UI: invite form visible and error shows on unknown email
  test('invite form shows an error when inviting an unknown email', async ({ page }) => {
    const ownerToken = await setupAuth(page, OWNER);
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${ownerToken}` } });
    const proj = await (await ctx.post('/api/projects', { data: { name: `UIInvite ${Date.now()}` } })).json();
    await ctx.dispose();

    await page.goto(`/projects/${proj.id}`);
    await expect(page.getByTestId('invite-form')).toBeVisible({ timeout: 8_000 });
    await page.getByTestId('invite-email-input').fill('ghost@nowhere.invalid');
    await page.getByTestId('invite-submit-btn').click();
    await expect(page.getByTestId('invite-error')).toBeVisible({ timeout: 5_000 });
  });
});
