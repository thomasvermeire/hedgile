/**
 * LaimonID sign-in: OpenID Connect authorization code flow with PKCE.
 * The ID token is verified against the issuer's published keys (JWKS),
 * its audience (our client id) and the nonce we sent.
 */
import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from 'jose';
import { z } from 'zod';
import type { Identity } from '../tenancy/membership.server.js';

export interface OidcClient {
  issuer: string;
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
}

const discoverySchema = z.object({
  issuer: z.string(),
  authorization_endpoint: z.url(),
  token_endpoint: z.url(),
  jwks_uri: z.url(),
});
type Discovery = z.infer<typeof discoverySchema>;

const tokenSchema = z.object({ id_token: z.string().min(1) });

const claimsSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  email_verified: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
  name: z.string().optional(),
});

export class SignInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignInError';
  }
}

const discoveryCache = new Map<string, Promise<Discovery>>();
const jwksCache = new Map<string, Promise<ReturnType<typeof createLocalJWKSet>>>();

function fetcher(client: OidcClient): typeof fetch {
  return client.fetch ?? fetch;
}

async function discover(client: OidcClient): Promise<Discovery> {
  const key = client.issuer;
  let pending = discoveryCache.get(key);
  if (!pending) {
    const url = `${client.issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
    pending = fetcher(client)(url)
      .then(async (res) => {
        if (!res.ok) throw new SignInError(`LaimonID discovery failed (${res.status})`);
        return discoverySchema.parse(await res.json());
      })
      .catch((error: unknown) => {
        discoveryCache.delete(key);
        throw error;
      });
    discoveryCache.set(key, pending);
  }
  return pending;
}

async function keys(
  client: OidcClient,
  jwksUri: string
): Promise<ReturnType<typeof createLocalJWKSet>> {
  let pending = jwksCache.get(jwksUri);
  if (!pending) {
    pending = fetcher(client)(jwksUri)
      .then(async (res) => {
        if (!res.ok) throw new SignInError(`LaimonID keys could not be loaded (${res.status})`);
        return createLocalJWKSet((await res.json()) as JSONWebKeySet);
      })
      .catch((error: unknown) => {
        jwksCache.delete(jwksUri);
        throw error;
      });
    jwksCache.set(jwksUri, pending);
  }
  return pending;
}

/** Forget cached discovery and keys (tests, or after the issuer rotates keys). */
export function clearOidcCache(): void {
  discoveryCache.clear();
  jwksCache.clear();
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomToken(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export interface PendingSignIn {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
}

export async function beginSignIn(
  client: OidcClient,
  redirectUri: string,
  returnTo: string
): Promise<{ url: string; pending: PendingSignIn }> {
  const discovery = await discover(client);
  const pending: PendingSignIn = {
    state: randomToken(),
    nonce: randomToken(),
    codeVerifier: randomToken(),
    returnTo,
  };
  const url = new URL(discovery.authorization_endpoint);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: client.clientId,
    redirect_uri: redirectUri,
    scope: 'openid email profile',
    state: pending.state,
    nonce: pending.nonce,
    code_challenge: await pkceChallenge(pending.codeVerifier),
    code_challenge_method: 'S256',
  }).toString();
  return { url: url.toString(), pending };
}

export async function completeSignIn(
  client: OidcClient,
  redirectUri: string,
  params: URLSearchParams,
  pending: PendingSignIn | null
): Promise<Identity> {
  const error = params.get('error');
  if (error) throw new SignInError(`LaimonID refused the sign-in: ${error}`);
  const code = params.get('code');
  if (!pending || !code || params.get('state') !== pending.state) {
    throw new SignInError('The sign-in expired or did not start here. Please sign in again.');
  }

  const discovery = await discover(client);
  const res = await fetcher(client)(discovery.token_endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${btoa(`${encodeURIComponent(client.clientId)}:${encodeURIComponent(client.clientSecret)}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: pending.codeVerifier,
    }),
  });
  if (!res.ok) throw new SignInError(`LaimonID token exchange failed (${res.status})`);
  const { id_token } = tokenSchema.parse(await res.json());

  const { payload } = await jwtVerify(id_token, await keys(client, discovery.jwks_uri), {
    issuer: discovery.issuer,
    audience: client.clientId,
  }).catch(() => {
    throw new SignInError('LaimonID returned an ID token that could not be verified');
  });
  if (payload.nonce !== pending.nonce) throw new SignInError('The sign-in nonce did not match');

  const claims = claimsSchema.safeParse(payload);
  if (!claims.success) throw new SignInError('LaimonID did not share an email address');
  return {
    issuer: discovery.issuer,
    subject: claims.data.sub,
    email: claims.data.email,
    emailVerified: claims.data.email_verified === true || claims.data.email_verified === 'true',
    name: claims.data.name ?? null,
  };
}
