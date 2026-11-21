/**
 * A fake LaimonID (OpenID Connect provider) for tests: discovery, keys, and a
 * token endpoint that checks the PKCE verifier and signs ID tokens.
 */
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose';

export const ISSUER = 'https://id.test.laimon';
export const CLIENT_ID = 'hedgile-test';
export const CLIENT_SECRET = 'test-secret';

interface Grant {
  nonce: string;
  challenge: string;
  redirectUri: string;
  claims: Record<string, unknown>;
}

async function sha256url(value: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  );
  let binary = '';
  for (const b of digest) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function createFakeLaimonId() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  const grants = new Map<string, Grant>();
  let signingKey: CryptoKey = privateKey;
  let audience = CLIENT_ID;

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input : input.url
    );
    if (url.pathname === '/.well-known/openid-configuration') {
      return Response.json({
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}/authorize`,
        token_endpoint: `${ISSUER}/token`,
        jwks_uri: `${ISSUER}/jwks`,
      });
    }
    if (url.pathname === '/jwks') return Response.json({ keys: [jwk] });
    if (url.pathname === '/token') {
      const auth = new Headers(init?.headers).get('authorization') ?? '';
      if (auth !== `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`)
        return new Response('bad client', { status: 401 });
      const body = new URLSearchParams(String(init?.body));
      const grant = grants.get(body.get('code') ?? '');
      if (!grant || grant.redirectUri !== body.get('redirect_uri'))
        return new Response('bad code', { status: 400 });
      if ((await sha256url(body.get('code_verifier') ?? '')) !== grant.challenge) {
        return new Response('bad verifier', { status: 400 });
      }
      grants.delete(body.get('code') ?? '');
      const idToken = await new SignJWT({ ...grant.claims, nonce: grant.nonce })
        .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
        .setIssuer(ISSUER)
        .setAudience(audience)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(signingKey);
      return Response.json({ access_token: 'at', token_type: 'Bearer', id_token: idToken });
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;

  return {
    fetch: fetchImpl,
    /** The user signs in at LaimonID: returns the callback query LaimonID would redirect with. */
    approve(authorizeUrl: string, claims: Record<string, unknown>): URLSearchParams {
      const params = new URL(authorizeUrl).searchParams;
      if (params.get('code_challenge_method') !== 'S256') throw new Error('PKCE S256 expected');
      const code = crypto.randomUUID();
      grants.set(code, {
        nonce: params.get('nonce') ?? '',
        challenge: params.get('code_challenge') ?? '',
        redirectUri: params.get('redirect_uri') ?? '',
        claims,
      });
      return new URLSearchParams({ code, state: params.get('state') ?? '' });
    },
    /** Sign tokens with a key LaimonID does not publish (forged token). */
    async useUnpublishedKey() {
      signingKey = (await generateKeyPair('RS256')).privateKey;
    },
    setAudience(value: string) {
      audience = value;
    },
  };
}
