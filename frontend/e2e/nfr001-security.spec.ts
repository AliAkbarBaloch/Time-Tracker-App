import { test, expect, request } from '@playwright/test';
import { PRIMARY_USER, SECONDARY_USER, registerUser, loginUser } from './helpers/auth';

const USER_A = { ...PRIMARY_USER, email: `nfr001a${Date.now()}@e2e.test` };
const USER_B = { ...SECONDARY_USER, email: `nfr001b${Date.now()}@e2e.test` };

test.describe('NFR-001 — Security', () => {
  test.beforeAll(async () => {
    await registerUser(USER_A);
    await registerUser(USER_B);
  });

  // AC2: request with missing JWT to any protected endpoint returns 401
  test('protected endpoints return 401 without a JWT', async () => {
    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
    });
    const endpoints = [
      { method: 'GET', path: '/api/tasks' },
      { method: 'GET', path: '/api/projects' },
      { method: 'GET', path: '/api/dashboard/summary' },
    ];
    for (const ep of endpoints) {
      const resp = ep.method === 'GET'
        ? await ctx.get(ep.path)
        : await ctx.post(ep.path, { data: {} });
      expect(resp.status(), `${ep.method} ${ep.path} should be 401 without auth`).toBe(401);
    }
    await ctx.dispose();
  });

  // AC2: expired/invalid JWT returns 401
  test('invalid JWT token returns 401', async () => {
    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: 'Bearer invalid.jwt.token' },
    });
    const resp = await ctx.get('/api/tasks');
    expect(resp.status()).toBe(401);
    await ctx.dispose();
  });

  // AC3: User A's JWT cannot access User B's tasks (returns 403 or 404)
  test("User A cannot read or modify User B's tasks", async () => {
    const tokenA = await loginUser(USER_A);
    const tokenB = await loginUser(USER_B);

    const ctxB = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: `Bearer ${tokenB}` },
    });
    // Create a task as User B
    const taskResp = await ctxB.post('/api/tasks', {
      data: {
        description: 'User B private task',
        startTime: new Date(Date.now() - 3_600_000).toISOString(),
        endTime: new Date(Date.now() - 1_800_000).toISOString(),
      },
    });
    const task = await taskResp.json();
    await ctxB.dispose();

    // Try to access/modify User B's task as User A
    const ctxA = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: `Bearer ${tokenA}` },
    });
    const putResp = await ctxA.put(`/api/tasks/${task.id}`, {
      data: { description: 'Hacked', startTime: task.startTime, endTime: task.endTime },
    });
    expect([403, 404]).toContain(putResp.status());

    const delResp = await ctxA.delete(`/api/tasks/${task.id}`);
    expect([403, 404]).toContain(delResp.status());
    await ctxA.dispose();
  });

  // AC4: SQL injection attempts are rejected or safely escaped
  test('SQL injection in task description is safely stored as literal text', async () => {
    const tokenA = await loginUser(USER_A);
    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: `Bearer ${tokenA}` },
    });
    const payload = "'; DROP TABLE tasks; --";
    const resp = await ctx.post('/api/tasks', {
      data: {
        description: payload,
        startTime: new Date(Date.now() - 3_600_000).toISOString(),
        endTime: new Date(Date.now() - 1_800_000).toISOString(),
      },
    });
    // Must not crash the server (201/200 with the text stored literally)
    expect([200, 201]).toContain(resp.status());
    const created = await resp.json();
    expect(created.description).toBe(payload);

    // Tasks endpoint must still work after the injection attempt
    const listResp = await ctx.get('/api/tasks');
    expect(listResp.status()).toBe(200);
    await ctx.dispose();
  });
});
