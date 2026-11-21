/**
 * The main user flow, end to end through the real route handlers: sign in with
 * LaimonID, land in organisation Hedgile, see the menu, add a material, sign out.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearOidcCache } from '../auth/oidc.server';
import * as appLayout from '../routes/app-layout';
import * as callback from '../routes/auth.callback';
import * as login from '../routes/auth.login';
import * as logout from '../routes/auth.logout';
import * as health from '../routes/health';
import * as materials from '../routes/master-data.materials';
import { contextFor, createTestEnv } from './context';
import { runSqlFile } from './d1';
import { createFakeLaimonId } from './oidc';

type Args = Parameters<typeof login.loader>[0];
const APP = 'https://hedgileapp.test';

function args(env: Env, request: Request): Args {
  return { request, context: contextFor(env), params: {} } as unknown as Args;
}

/** Merge Set-Cookie headers into a cookie jar (name=value only). */
function store(jar: Map<string, string>, res: Response) {
  for (const header of res.headers.getSetCookie()) {
    const [pair] = header.split(';');
    const [name, ...value] = (pair ?? '').split('=');
    if (!name) continue;
    if (value.join('=') === '' || /max-age=0|expires=thu, 01 jan 1970/i.test(header))
      jar.delete(name);
    else jar.set(name, value.join('='));
  }
}
const cookieHeader = (jar: Map<string, string>) => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');

async function thrownResponse(fn: () => Promise<unknown>): Promise<Response> {
  try {
    const value = await fn();
    if (value instanceof Response) return value;
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    throw thrown;
  }
  throw new Error('expected a Response');
}

describe('main user flow', () => {
  let idp: Awaited<ReturnType<typeof createFakeLaimonId>>;
  let env: Env;

  beforeEach(async () => {
    clearOidcCache();
    idp = await createFakeLaimonId();
    vi.stubGlobal('fetch', idp.fetch);
    env = createTestEnv();
    await runSqlFile(env.DB, 'db/reset-demo.sql');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('signs in with LaimonID, lands in Hedgile, adds a material and signs out', async () => {
    const jar = new Map<string, string>();

    // 1. Health is public.
    const healthRes = await health.loader(args(env, new Request(`${APP}/health`)) as never);
    expect(await healthRes.json()).toMatchObject({ status: 'ok', database: 'ok' });

    // 2. Opening the app unauthenticated goes to sign-in.
    const refused = await thrownResponse(() =>
      appLayout.loader(args(env, new Request(`${APP}/master-data/materials`)) as never)
    );
    expect(refused.headers.get('Location')).toBe('/auth/login?returnTo=%2Fmaster-data%2Fmaterials');

    // 3. Sign-in goes to LaimonID.
    const toIdp = await login.loader(
      args(env, new Request(`${APP}/auth/login?returnTo=%2Fmaster-data%2Fmaterials`))
    );
    store(jar, toIdp);
    const authorizeUrl = toIdp.headers.get('Location') ?? '';
    expect(authorizeUrl).toMatch(/^https:\/\/id\.test\.laimon\/authorize\?/);

    // 4. LaimonID sends the bootstrap admin back; they land in Hedgile, on the page they asked for.
    const query = idp.approve(authorizeUrl, {
      sub: 'ann',
      email: 'admin@hedgile.test',
      email_verified: true,
      name: 'Ann',
    });
    const landed = await callback.loader(
      args(
        env,
        new Request(`${APP}/auth/callback?${query}`, { headers: { Cookie: cookieHeader(jar) } })
      ) as never
    );
    store(jar, landed);
    expect(landed.headers.get('Location')).toBe('/master-data/materials');
    expect(jar.has('hedgile_session')).toBe(true);

    // 5. The shell knows the organisation, the user and the active metal references.
    const shell = await appLayout.loader(
      args(
        env,
        new Request(`${APP}/master-data/materials`, { headers: { Cookie: cookieHeader(jar) } })
      ) as never
    );
    expect(shell).toMatchObject({
      organisation: 'Hedgile',
      user: { email: 'admin@hedgile.test', role: 'admin' },
      references: [{ id: 'ref_lme_ni_cash', name: 'LME Nickel Cash' }],
      laimonEnabled: false,
    });

    // 6. Add a material, then see it in the list.
    const form = new URLSearchParams({
      code: 'ni-full',
      name: 'Nickel full plate',
      metal: 'Nickel',
    });
    const saved = await thrownResponse(() =>
      materials.action(
        args(
          env,
          new Request(`${APP}/master-data/materials`, {
            method: 'POST',
            body: form,
            headers: {
              Cookie: cookieHeader(jar),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          })
        ) as never
      )
    );
    expect(saved.status).toBe(302);
    const list = await materials.loader(
      args(
        env,
        new Request(`${APP}/master-data/materials`, { headers: { Cookie: cookieHeader(jar) } })
      ) as never
    );
    expect(list.materials.map((m) => m.code)).toContain('NI-FULL');

    // 7. An invalid metal is refused with a message.
    const invalid = await materials.action(
      args(
        env,
        new Request(`${APP}/master-data/materials`, {
          method: 'POST',
          body: new URLSearchParams({ code: 'X1', name: 'Bad', metal: 'Unobtainium' }),
          headers: {
            Cookie: cookieHeader(jar),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      ) as never
    );
    expect(JSON.stringify(invalid)).toContain('Choose a metal from the list');

    // 8. Sign out; the old session no longer opens the app.
    const out = await logout.action(
      args(
        env,
        new Request(`${APP}/auth/logout`, {
          method: 'POST',
          headers: { Cookie: cookieHeader(jar) },
        })
      ) as never
    );
    store(jar, out);
    expect(jar.has('hedgile_session')).toBe(false);
    const afterLogout = await thrownResponse(() =>
      appLayout.loader(
        args(env, new Request(`${APP}/`, { headers: { Cookie: cookieHeader(jar) } })) as never
      )
    );
    expect(afterLogout.status).toBe(302);
  });

  it('refuses a LaimonID user who is not a member, without a session', async () => {
    const jar = new Map<string, string>();
    const toIdp = await login.loader(args(env, new Request(`${APP}/auth/login`)));
    store(jar, toIdp);
    const query = idp.approve(toIdp.headers.get('Location') ?? '', {
      sub: 'eve',
      email: 'eve@elsewhere.test',
      email_verified: true,
    });
    const res = await callback.loader(
      args(
        env,
        new Request(`${APP}/auth/callback?${query}`, { headers: { Cookie: cookieHeader(jar) } })
      ) as never
    );
    store(jar, res);
    expect(res.headers.get('Location')).toBe('/auth/no-access?reason=no_membership');
    expect(jar.has('hedgile_session')).toBe(false);
  });
});
