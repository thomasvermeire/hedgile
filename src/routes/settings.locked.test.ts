import { describe, expect, it } from 'vitest';
import { contextFor, createTestEnv, seedOrgWithUser, sessionCookie } from '../test/context';
import { runSqlFile } from '../test/d1';
import { loader as connections } from './settings.connections';
import { loader as ledgers } from './settings.ledgers';
import { loader as valuation } from './settings.valuation';

type Args = Parameters<typeof valuation>[0];
const argsFor = (request: Request, env: Env) =>
  ({ request, context: contextFor(env) }) as unknown as Args;

describe('locked settings loaders', () => {
  it.each([
    ['connections', connections],
    ['ledgers', ledgers],
    ['valuation', valuation],
  ] as const)('redirects %s to sign-in when unauthenticated', async (name, loader) => {
    const env = createTestEnv();
    try {
      await (loader as (a: Args) => Promise<unknown>)(
        argsFor(new Request(`https://app.test/settings/${name}`), env)
      );
      expect.unreachable();
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(Response);
      const res = thrown as Response;
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe(
        `/auth/login?returnTo=${encodeURIComponent(`/settings/${name}`)}`
      );
    }
  });

  it('returns Hedgile Limited with WAVG on the valuation page', async () => {
    const env = createTestEnv();
    await seedOrgWithUser(env.DB, {
      orgId: 'org_hedgile',
      orgName: 'Hedgile',
      userId: 'u1',
      email: 'ann@x.test',
    });
    await runSqlFile(env.DB, 'db/reset-demo.sql');
    const cookie = await sessionCookie(env, 'u1', 'org_hedgile');
    const request = new Request('https://app.test/settings/valuation', {
      headers: { Cookie: cookie },
    });
    const result = await valuation(argsFor(request, env));
    expect(result.valuations).toContainEqual(
      expect.objectContaining({ name: 'Hedgile Limited', method: 'WAVG' })
    );
  });
});
