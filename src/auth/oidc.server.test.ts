import { beforeEach, describe, expect, it } from 'vitest';
import { CLIENT_ID, CLIENT_SECRET, createFakeLaimonId, ISSUER } from '../test/oidc';
import { beginSignIn, clearOidcCache, completeSignIn, SignInError } from './oidc.server';

const REDIRECT = 'https://app.test/auth/callback';
const claims = { sub: 'user-1', email: 'Ann@Hedgile.test', email_verified: true, name: 'Ann' };

describe('LaimonID sign-in', () => {
  let idp: Awaited<ReturnType<typeof createFakeLaimonId>>;
  let client: Parameters<typeof beginSignIn>[0];

  beforeEach(async () => {
    clearOidcCache();
    idp = await createFakeLaimonId();
    client = { issuer: ISSUER, clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, fetch: idp.fetch };
  });

  it('sends the user to LaimonID with state, nonce and a PKCE challenge', async () => {
    const { url, pending } = await beginSignIn(client, REDIRECT, '/settings');
    const params = new URL(url).searchParams;
    expect(url.startsWith(`${ISSUER}/authorize?`)).toBe(true);
    expect(params.get('client_id')).toBe(CLIENT_ID);
    expect(params.get('redirect_uri')).toBe(REDIRECT);
    expect(params.get('scope')).toBe('openid email profile');
    expect(params.get('state')).toBe(pending.state);
    expect(params.get('nonce')).toBe(pending.nonce);
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('code_challenge')).not.toBe(pending.codeVerifier);
    expect(pending.returnTo).toBe('/settings');
  });

  it('returns the verified identity', async () => {
    const { url, pending } = await beginSignIn(client, REDIRECT, '/');
    const identity = await completeSignIn(client, REDIRECT, idp.approve(url, claims), pending);
    expect(identity).toEqual({
      issuer: ISSUER,
      subject: 'user-1',
      email: 'Ann@Hedgile.test',
      emailVerified: true,
      name: 'Ann',
    });
  });

  it('refuses a callback whose state does not match', async () => {
    const { url, pending } = await beginSignIn(client, REDIRECT, '/');
    const params = idp.approve(url, claims);
    params.set('state', 'forged');
    await expect(completeSignIn(client, REDIRECT, params, pending)).rejects.toThrow(SignInError);
  });

  it('refuses a callback without a pending sign-in', async () => {
    const { url } = await beginSignIn(client, REDIRECT, '/');
    await expect(completeSignIn(client, REDIRECT, idp.approve(url, claims), null)).rejects.toThrow(
      SignInError
    );
  });

  it('refuses an ID token signed with a key LaimonID does not publish', async () => {
    const { url, pending } = await beginSignIn(client, REDIRECT, '/');
    await idp.useUnpublishedKey();
    await expect(
      completeSignIn(client, REDIRECT, idp.approve(url, claims), pending)
    ).rejects.toThrow('could not be verified');
  });

  it('refuses an ID token meant for another client', async () => {
    const { url, pending } = await beginSignIn(client, REDIRECT, '/');
    idp.setAudience('someone-else');
    await expect(
      completeSignIn(client, REDIRECT, idp.approve(url, claims), pending)
    ).rejects.toThrow(SignInError);
  });

  it('refuses an ID token issued for another sign-in (nonce)', async () => {
    const first = await beginSignIn(client, REDIRECT, '/');
    const second = await beginSignIn(client, REDIRECT, '/');
    const params = idp.approve(first.url, claims);
    params.set('state', second.pending.state);
    await expect(completeSignIn(client, REDIRECT, params, second.pending)).rejects.toThrow(
      SignInError
    );
  });

  it('reports an error LaimonID sends back', async () => {
    const { pending } = await beginSignIn(client, REDIRECT, '/');
    await expect(
      completeSignIn(client, REDIRECT, new URLSearchParams({ error: 'access_denied' }), pending)
    ).rejects.toThrow('access_denied');
  });
});
