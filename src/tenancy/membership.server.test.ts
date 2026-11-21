import { beforeEach, describe, expect, it } from 'vitest';
import { createTestD1 } from '../test/d1';
import { findMembership, HEDGILE_ORG_ID, resolveSignIn, type Identity } from './membership.server';

const identity = (overrides: Partial<Identity> = {}): Identity => ({
  issuer: 'https://id.test.laimon',
  subject: 'sub-1',
  email: 'Ann@Hedgile.test',
  emailVerified: true,
  name: 'Ann',
  ...overrides,
});

describe('resolveSignIn', () => {
  let db: D1Database;
  beforeEach(() => {
    db = createTestD1();
  });

  it('has organisation Hedgile seeded', async () => {
    expect(
      await db
        .prepare('SELECT name FROM organisations WHERE id = ?')
        .bind(HEDGILE_ORG_ID)
        .first('name')
    ).toBe('Hedgile');
  });

  it('lands a bootstrap admin in organisation Hedgile as admin', async () => {
    const result = await resolveSignIn(db, identity(), ['ann@hedgile.test']);
    expect(result).toMatchObject({
      ok: true,
      membership: { organisationName: 'Hedgile', role: 'admin' },
    });
  });

  it('lets an invited email join with the invited role, once verified', async () => {
    await db
      .prepare(
        "INSERT INTO memberships (id, organisation_id, email, role) VALUES ('m1', ?, 'ann@hedgile.test', 'user')"
      )
      .bind(HEDGILE_ORG_ID)
      .run();
    const result = await resolveSignIn(db, identity(), []);
    expect(result).toMatchObject({
      ok: true,
      membership: { organisationId: HEDGILE_ORG_ID, role: 'user' },
    });
  });

  it('refuses an unverified email even when it is invited', async () => {
    await db
      .prepare(
        "INSERT INTO memberships (id, organisation_id, email, role) VALUES ('m1', ?, 'ann@hedgile.test', 'admin')"
      )
      .bind(HEDGILE_ORG_ID)
      .run();
    expect(await resolveSignIn(db, identity({ emailVerified: false }), [])).toEqual({
      ok: false,
      reason: 'email_not_verified',
    });
  });

  it('refuses someone with no membership or invitation', async () => {
    expect(await resolveSignIn(db, identity(), ['other@hedgile.test'])).toEqual({
      ok: false,
      reason: 'no_membership',
    });
  });

  it('recognises a returning user by issuer and subject, not by email', async () => {
    const first = await resolveSignIn(db, identity(), ['ann@hedgile.test']);
    const again = await resolveSignIn(db, identity({ email: 'ann.new@hedgile.test' }), []);
    expect(again.ok && first.ok && again.userId === first.userId).toBe(true);
    const stranger = await resolveSignIn(db, identity({ subject: 'sub-2' }), []);
    expect(stranger.ok).toBe(false);
  });

  it('finds no membership in an organisation the user is not in', async () => {
    const result = await resolveSignIn(db, identity(), ['ann@hedgile.test']);
    if (!result.ok) throw new Error('expected sign-in');
    expect(await findMembership(db, result.userId, 'org_other')).toBeNull();
  });
});
