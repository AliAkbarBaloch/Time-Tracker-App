import { test, expect, request } from '@playwright/test';
import { PRIMARY_USER, registerUser, setupAuth } from './helpers/auth';

const USER = { ...PRIMARY_USER, email: `us021${Date.now()}@e2e.test` };
const OTHER = { ...PRIMARY_USER, email: `us021other${Date.now()}@e2e.test` };

test.describe('US-021 — Data Persistence', () => {
  test.beforeAll(async () => {
    await registerUser(USER);
    await registerUser(OTHER);
  });

  // AC2: after logging out and back in, all previously tracked tasks are visible
  test('tasks and projects are visible after logout and re-login', async ({ page }) => {
    const token = await setupAuth(page, USER);
    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    await ctx.post('/api/tasks', {
      data: {
        description: 'Persistent task after reauth',
        startTime: new Date(Date.now() - 3_600_000).toISOString(),
        endTime: new Date(Date.now() - 1_800_000).toISOString(),
      },
    });
    const projResp = await ctx.post('/api/projects', { data: { name: `PersistProj ${Date.now()}` } });
    const proj = await projResp.json();
    await ctx.dispose();

    // Simulate logout by clearing localStorage
    await page.evaluate(() => {
      localStorage.removeItem('tt_token');
      localStorage.removeItem('tt_user');
    });

    // Re-login via setupAuth
    await setupAuth(page, USER);
    await page.goto('/tasks');
    await expect(page.locator('[data-testid^="task-item-"]').filter({ hasText: 'Persistent task after reauth' })).toBeVisible({ timeout: 8_000 });

    await page.goto('/projects');
    await expect(page.getByText(proj.name)).toBeVisible({ timeout: 8_000 });
  });

  // AC4: subproject hierarchy persists across re-login
  test('subproject hierarchy persists after logout and re-login', async ({ page }) => {
    const token = await setupAuth(page, USER);
    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    const parent = await (await ctx.post('/api/projects', { data: { name: `ParentPersist ${Date.now()}` } })).json();
    const child = await (await ctx.post('/api/projects', { data: { name: `ChildPersist ${Date.now()}`, parentProjectId: parent.id } })).json();
    await ctx.dispose();

    // Re-login
    await page.evaluate(() => { localStorage.removeItem('tt_token'); localStorage.removeItem('tt_user'); });
    await setupAuth(page, USER);
    await page.goto('/projects');

    await expect(page.getByText(parent.name)).toBeVisible({ timeout: 8_000 });
    // Child may be visible without clicking if the tree auto-expands; only toggle if needed
    const childLocator = page.getByText(child.name);
    const alreadyVisible = await childLocator.isVisible().catch(() => false);
    if (!alreadyVisible) {
      await page.locator('[data-testid^="collapse-btn-"]').first().click();
    }
    await expect(childLocator).toBeVisible({ timeout: 8_000 });
  });

  // AC3: task-project associations persist across re-login
  test('task-project associations are visible after re-login', async ({ page }) => {
    const token = await setupAuth(page, USER);
    const ctx = await request.newContext({
      baseURL: process.env.API_BASE ?? 'http://localhost:8080',
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    const proj = await (await ctx.post('/api/projects', { data: { name: `AssocPersist ${Date.now()}` } })).json();
    const taskResp = await ctx.post('/api/tasks', {
      data: {
        description: 'Task with project persist',
        startTime: new Date(Date.now() - 3_600_000).toISOString(),
        endTime: new Date(Date.now() - 1_800_000).toISOString(),
        projectIds: [proj.id],
      },
    });
    const task = await taskResp.json();
    await ctx.dispose();

    // Re-login
    await page.evaluate(() => { localStorage.removeItem('tt_token'); localStorage.removeItem('tt_user'); });
    await setupAuth(page, USER);
    await page.goto('/tasks');

    const taskRow = page.getByTestId(`task-item-${task.id}`);
    await expect(taskRow).toBeVisible({ timeout: 8_000 });
    await expect(taskRow.locator(`[data-testid="task-projects-${task.id}"]`)).toContainText(proj.name);
  });

  // AC5: no data from User A returned in any API response authenticated as User B
  test("User B cannot see User A's tasks via the API", async () => {
    const API = process.env.API_BASE ?? 'http://localhost:8080';

    const ctxA = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${await getToken(USER)}` } });
    await ctxA.post('/api/tasks', {
      data: {
        description: 'User A private task',
        startTime: new Date(Date.now() - 3_600_000).toISOString(),
        endTime: new Date(Date.now() - 1_800_000).toISOString(),
      },
    });
    await ctxA.dispose();

    const ctxB = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${await getToken(OTHER)}` } });
    const listResp = await ctxB.get('/api/tasks');
    const body = await listResp.json();
    await ctxB.dispose();

    const taskList: Array<{ description: string }> = body.content ?? body;
    const leakedTask = Array.isArray(taskList)
      ? taskList.find(t => t.description === 'User A private task')
      : undefined;
    expect(leakedTask).toBeUndefined();
  });
});

async function getToken(user: { email: string; password: string }): Promise<string> {
  const ctx = await request.newContext({ baseURL: process.env.API_BASE ?? 'http://localhost:8080' });
  const resp = await ctx.post('/api/auth/login', { data: { email: user.email, password: user.password } });
  const body = await resp.json();
  await ctx.dispose();
  return body.token;
}
