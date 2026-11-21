import { describe, expect, it } from 'vitest';
import { contextFor, createTestEnv, seedOrgWithUser, sessionCookie } from '../test/context';
import { releases } from '../versioning/releases';
import { loader } from './releases';

type Args = Parameters<typeof loader>[0];
const argsFor = (request: Request, env: Env) => ({ request, context: contextFor(env) }) as Args;

describe('releases loader', () => {
  it('redirects an unauthenticated request to sign-in', async () => {
    const env = createTestEnv();
    try {
      await loader(argsFor(new Request('https://app.test/releases'), env));
      expect.unreachable();
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(Response);
      const res = thrown as Response;
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe('/auth/login?returnTo=%2Freleases');
    }
  });

  it('returns the releases when signed in', async () => {
    const env = createTestEnv();
    await seedOrgWithUser(env.DB, {
      orgId: 'org_hedgile',
      orgName: 'Hedgile',
      userId: 'u1',
      email: 'ann@x.test',
    });
    const cookie = await sessionCookie(env, 'u1', 'org_hedgile');
    const result = await loader(
      argsFor(new Request('https://app.test/releases', { headers: { Cookie: cookie } }), env)
    );
    expect(result.releases).toEqual(releases);
    expect(typeof result.currentVersion).toBe('string');
  });
});
