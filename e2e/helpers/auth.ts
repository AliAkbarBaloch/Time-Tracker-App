import { Page, request } from '@playwright/test';

const API_BASE = process.env.API_BASE ?? 'http://localhost:8080';

export interface TestUser {
  email: string;
  password: string;
  displayName: string;
}

export const PRIMARY_USER: TestUser = {
  email: 'alice@e2e.test',
  password: 'TestPass1!',
  displayName: 'Alice E2E',
};

export const SECONDARY_USER: TestUser = {
  email: 'bob@e2e.test',
  password: 'TestPass2!',
  displayName: 'Bob E2E',
};

/** Register a user via API; ignores 409 (already exists). Returns token. */
export async function registerUser(user: TestUser): Promise<string> {
  const ctx = await request.newContext({ baseURL: API_BASE });
  await ctx.post('/api/auth/register', {
    data: { email: user.email, password: user.password, displayName: user.displayName },
  });
  const loginResp = await ctx.post('/api/auth/login', {
    data: { email: user.email, password: user.password },
  });
  const body = await loginResp.json();
  await ctx.dispose();
  return body.token as string;
}

/** Login via API and return the JWT token. */
export async function loginUser(user: TestUser): Promise<string> {
  const ctx = await request.newContext({ baseURL: API_BASE });
  const resp = await ctx.post('/api/auth/login', {
    data: { email: user.email, password: user.password },
  });
  const body = await resp.json();
  await ctx.dispose();
  return body.token as string;
}

/**
 * Inject JWT into the browser's localStorage so the app treats the page as
 * already authenticated — skips the login form entirely.
 */
export async function injectAuth(page: Page, user: TestUser, token: string): Promise<void> {
  await page.goto('/');
  await page.evaluate(
    ([t, u]) => {
      localStorage.setItem('tt_token', t);
      localStorage.setItem(
        'tt_user',
        JSON.stringify({ email: u.email, displayName: u.displayName, timezone: 'UTC' }),
      );
    },
    [token, user] as [string, TestUser],
  );
}

/** Full setup: register (idempotent) then inject auth into the browser. */
export async function setupAuth(page: Page, user: TestUser = PRIMARY_USER): Promise<string> {
  const token = await registerUser(user);
  await injectAuth(page, user, token);
  return token;
}
