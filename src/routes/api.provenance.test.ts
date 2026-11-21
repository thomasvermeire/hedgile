import { describe, expect, it } from 'vitest';
import { provenanceStatement } from '../provenance/provenance.server';
import { contextFor, createTestEnv, seedOrgWithUser, sessionCookie } from '../test/context';
import * as route from './api.provenance';

type Args = Parameters<typeof route.loader>[0];

function args(env: Env, url: string, cookie?: string): Args {
  return {
    request: new Request(url, cookie ? { headers: { Cookie: cookie } } : undefined),
    context: contextFor(env),
    params: {},
  } as unknown as Args;
}

async function call(env: Env, url: string, cookie?: string): Promise<Response> {
  try {
    return await route.loader(args(env, url, cookie));
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    throw thrown;
  }
}

const BASE = 'https://app.test/api/provenance';
const QUERY = '?objectType=line&objectId=l1&field=amount';

describe('GET /api/provenance', () => {
  it('is 401 without a session', async () => {
    const env = createTestEnv();
    expect((await call(env, BASE + QUERY)).status).toBe(401);
  });

  it('is 400 for a bad query, 404 when nothing is recorded, 200 with the entry', async () => {
    const env = createTestEnv();
    await seedOrgWithUser(env.DB, {
      orgId: 'org_a',
      orgName: 'A',
      userId: 'u1',
      email: 'a@x.test',
    });
    const cookie = await sessionCookie(env, 'u1', 'org_a');

    expect((await call(env, `${BASE}?objectType=line`, cookie)).status).toBe(400);
    expect((await call(env, BASE + QUERY, cookie)).status).toBe(404);

    await env.DB.batch([
      provenanceStatement(
        {
          db: env.DB,
          organisationId: 'org_a',
          organisationName: 'A',
          userId: 'u1',
          email: 'a@x.test',
          userName: null,
          role: 'user',
        },
        {
          objectType: 'line',
          objectId: 'l1',
          field: 'amount',
          value: 61500,
          trigger: 'quantity',
          mode: 'automatic',
          formula: 'price × quantity',
          inputs: [
            { name: 'price', value: 12300 },
            { name: 'quantity', value: 5 },
          ],
        }
      ),
    ]);
    const res = await call(env, BASE + QUERY, cookie);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      latest: { value: string; userEmail: string };
      history: [];
    };
    expect(body.latest).toMatchObject({ value: '61500', userEmail: 'a@x.test' });
    expect(body.history).toEqual([]);
  });

  it("is 404 for another organisation's value", async () => {
    const env = createTestEnv();
    await seedOrgWithUser(env.DB, {
      orgId: 'org_a',
      orgName: 'A',
      userId: 'u1',
      email: 'a@x.test',
    });
    await seedOrgWithUser(env.DB, {
      orgId: 'org_b',
      orgName: 'B',
      userId: 'u2',
      email: 'b@x.test',
    });
    await env.DB.batch([
      provenanceStatement(
        {
          db: env.DB,
          organisationId: 'org_a',
          organisationName: 'A',
          userId: 'u1',
          email: 'a@x.test',
          userName: null,
          role: 'user',
        },
        {
          objectType: 'line',
          objectId: 'l1',
          field: 'amount',
          value: 1,
          trigger: 'manual',
          mode: 'manual',
        }
      ),
    ]);
    const cookie = await sessionCookie(env, 'u2', 'org_b');
    expect((await call(env, BASE + QUERY, cookie)).status).toBe(404);
  });
});
