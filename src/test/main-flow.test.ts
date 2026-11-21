/**
 * The main user flow, end to end through the real route handlers: the first
 * admin signs in, lands in organisation Hedgile, sees the menu, adds a material,
 * adds a colleague, changes their password and signs out.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import * as account from '../routes/account';
import * as appLayout from '../routes/app-layout';
import * as login from '../routes/auth.login';
import * as logout from '../routes/auth.logout';
import * as health from '../routes/health';
import * as materials from '../routes/master-data.materials';
import * as settings from '../routes/settings';
import { BOOTSTRAP_EMAIL, BOOTSTRAP_PASSWORD, contextFor, createTestEnv } from './context';
import { runSqlFile } from './d1';

const APP = 'https://hedgileapp.test';

type Jar = Map<string, string>;

function args(env: Env, request: Request): never {
  return { request, context: contextFor(env), params: {} } as never;
}

/** Merge Set-Cookie headers into a cookie jar (name=value only). */
function store(jar: Jar, res: Response) {
  for (const header of res.headers.getSetCookie()) {
    const [pair] = header.split(';');
    const [name, ...value] = (pair ?? '').split('=');
    if (!name) continue;
    if (value.join('=') === '' || /max-age=0|expires=thu, 01 jan 1970/i.test(header))
      jar.delete(name);
    else jar.set(name, value.join('='));
  }
}
const cookieHeader = (jar: Jar) => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');

function form(jar: Jar, path: string, fields: Record<string, string>): Request {
  return new Request(`${APP}${path}`, {
    method: 'POST',
    body: new URLSearchParams(fields),
    headers: { Cookie: cookieHeader(jar), 'Content-Type': 'application/x-www-form-urlencoded' },
  });
}
const get = (jar: Jar, path: string) =>
  new Request(`${APP}${path}`, { headers: { Cookie: cookieHeader(jar) } });

/** Run a loader/action and return the Response it returned or threw. */
async function response(fn: () => Promise<unknown>): Promise<Response> {
  try {
    const value = await fn();
    if (value instanceof Response) return value;
    throw new Error(`expected a Response, got ${JSON.stringify(value)}`);
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    throw thrown;
  }
}

describe('main user flow', () => {
  let env: Env;
  beforeEach(async () => {
    env = createTestEnv();
    await runSqlFile(env.DB, 'db/reset-demo.sql');
  });

  it('first admin signs in, works in Hedgile, adds a colleague, changes password and signs out', async () => {
    const jar: Jar = new Map();

    // Health is public; the app is not.
    expect(
      await (await health.loader(args(env, new Request(`${APP}/health`)))).json()
    ).toMatchObject({ status: 'ok' });
    const refused = await response(() =>
      appLayout.loader(args(env, get(jar, '/master-data/materials')))
    );
    expect(refused.headers.get('Location')).toBe('/auth/login?returnTo=%2Fmaster-data%2Fmaterials');

    // A wrong password is refused without a session.
    const wrong = await login.action(
      args(
        env,
        form(jar, '/auth/login', { email: BOOTSTRAP_EMAIL, password: 'not-it', returnTo: '/' })
      )
    );
    expect(JSON.stringify(wrong)).toContain('The email or password is not right.');

    // The bootstrap admin signs in and lands on the page they asked for.
    const signedIn = await response(() =>
      login.action(
        args(
          env,
          form(jar, '/auth/login', {
            email: BOOTSTRAP_EMAIL,
            password: BOOTSTRAP_PASSWORD,
            returnTo: '/master-data/materials',
          })
        )
      )
    );
    store(jar, signedIn);
    expect(signedIn.headers.get('Location')).toBe('/master-data/materials');

    // The shell knows the organisation, the user and the active metal references.
    expect(await appLayout.loader(args(env, get(jar, '/master-data/materials')))).toMatchObject({
      organisation: 'Hedgile',
      user: { email: BOOTSTRAP_EMAIL, role: 'admin' },
      references: [{ id: 'ref_lme_ni_cash', name: 'LME Nickel Cash' }],
    });

    // Add a material, then see it in the list; an invalid metal is refused.
    const saved = await response(() =>
      materials.action(
        args(
          env,
          form(jar, '/master-data/materials', {
            code: 'ni-full',
            name: 'Nickel full plate',
            metal: 'Nickel',
          })
        )
      )
    );
    expect(saved.status).toBe(302);
    const list = await materials.loader(args(env, get(jar, '/master-data/materials')));
    expect(list.materials.map((m) => m.code)).toContain('NI-FULL');
    const invalid = await materials.action(
      args(
        env,
        form(jar, '/master-data/materials', { code: 'X1', name: 'Bad', metal: 'Unobtainium' })
      )
    );
    expect(JSON.stringify(invalid)).toContain('Choose a metal from the list');

    // Add a colleague with an initial password; they can sign in.
    await response(() =>
      settings.action(
        args(
          env,
          form(jar, '/settings', {
            intent: 'invite',
            email: 'colleague@hedgile.test',
            name: 'Colleague',
            role: 'user',
            password: 'colleague-initial',
          })
        )
      )
    );
    const colleague = await response(() =>
      login.action(
        args(
          env,
          form(new Map(), '/auth/login', {
            email: 'colleague@hedgile.test',
            password: 'colleague-initial',
          })
        )
      )
    );
    expect(colleague.status).toBe(302);

    // Change own password: this session stays signed in, the old password stops working.
    const changed = await response(() =>
      account.action(
        args(
          env,
          form(jar, '/account', {
            current: BOOTSTRAP_PASSWORD,
            password: 'my-new-password',
            confirm: 'my-new-password',
          })
        )
      )
    );
    store(jar, changed);
    expect(changed.headers.get('Location')).toBe('/account?changed');
    expect(await account.loader(args(env, get(jar, '/account?changed')))).toMatchObject({
      changed: true,
    });
    const oldPassword = await login.action(
      args(
        env,
        form(new Map(), '/auth/login', { email: BOOTSTRAP_EMAIL, password: BOOTSTRAP_PASSWORD })
      )
    );
    expect(JSON.stringify(oldPassword)).toContain('not right');

    // Sign out; the old session no longer opens the app.
    const out = await response(() => logout.action(args(env, form(jar, '/auth/logout', {}))));
    store(jar, out);
    expect(jar.has('hedgile_session')).toBe(false);
    const afterLogout = await response(() => appLayout.loader(args(env, get(jar, '/'))));
    expect(afterLogout.status).toBe(302);
  });

  it('only sends people to pages on this site after sign-in', async () => {
    const res = await response(() =>
      login.action(
        args(
          env,
          form(new Map(), '/auth/login', {
            email: BOOTSTRAP_EMAIL,
            password: BOOTSTRAP_PASSWORD,
            returnTo: '//evil.example/steal',
          })
        )
      )
    );
    expect(res.headers.get('Location')).toBe('/');
  });
});
