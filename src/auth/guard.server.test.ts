import { describe, expect, it } from 'vitest';
import { contextFor, createTestEnv, seedOrgWithUser, sessionCookie } from '../test/context';
import { requireTenant } from './guard.server';

async function refusal(promise: Promise<unknown>): Promise<Response> {
  try {
    await promise;
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    throw thrown;
  }
  throw new Error('expected the request to be refused');
}

describe('requireTenant', () => {
  it('sends an unauthenticated page request to LaimonID sign-in', async () => {
    const env = createTestEnv();
    const res = await refusal(
      requireTenant({
        request: new Request('https://app.test/settings?tab=1'),
        context: contextFor(env),
      })
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/auth/login?returnTo=%2Fsettings%3Ftab%3D1');
  });

  it('refuses an unauthenticated API request with 401', async () => {
    const env = createTestEnv();
    const res = await refusal(
      requireTenant({
        request: new Request('https://app.test/api/laimon/chat'),
        context: contextFor(env),
      })
    );
    expect(res.status).toBe(401);
  });

  it('refuses a tampered session cookie', async () => {
    const env = createTestEnv();
    const forged = `hedgile_session=${btoa(JSON.stringify({ userId: 'u', organisationId: 'org_hedgile' }))}`;
    const res = await refusal(
      requireTenant({
        request: new Request('https://app.test/', { headers: { Cookie: forged } }),
        context: contextFor(env),
      })
    );
    expect(res.status).toBe(302);
  });

  it('returns the user and organisation for a valid session', async () => {
    const env = createTestEnv();
    await seedOrgWithUser(env.DB, {
      orgId: 'org_hedgile',
      orgName: 'Hedgile',
      userId: 'u1',
      email: 'ann@x.test',
      role: 'admin',
    });
    const cookie = await sessionCookie(env, 'u1', 'org_hedgile');
    const tenant = await requireTenant({
      request: new Request('https://app.test/', { headers: { Cookie: cookie } }),
      context: contextFor(env),
    });
    expect(tenant).toMatchObject({
      organisationId: 'org_hedgile',
      organisationName: 'Hedgile',
      role: 'admin',
      userId: 'u1',
    });
  });

  it('signs out a user whose membership was removed', async () => {
    const env = createTestEnv();
    await seedOrgWithUser(env.DB, {
      orgId: 'org_hedgile',
      orgName: 'Hedgile',
      userId: 'u1',
      email: 'ann@x.test',
    });
    const cookie = await sessionCookie(env, 'u1', 'org_hedgile');
    await env.DB.prepare("DELETE FROM memberships WHERE user_id = 'u1'").run();
    const res = await refusal(
      requireTenant({
        request: new Request('https://app.test/', { headers: { Cookie: cookie } }),
        context: contextFor(env),
      })
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Set-Cookie')).toContain('hedgile_session=;');
  });

  it('turns missing settings into a 503 naming them', async () => {
    const env = createTestEnv({ SESSION_SECRET: '' });
    try {
      await requireTenant({ request: new Request('https://app.test/'), context: contextFor(env) });
      expect.unreachable();
    } catch (thrown) {
      const response = thrown as { init?: { status?: number }; data?: { settings?: string[] } };
      expect(response.init?.status).toBe(503);
      expect(response.data?.settings).toEqual(['SESSION_SECRET']);
    }
  });
});
