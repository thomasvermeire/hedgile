import { beforeEach, describe, expect, it } from 'vitest';
import { addMember, MemberExistsError, resetMemberPassword } from '../settings/members.server';
import { seedOrgWithUser } from '../test/context';
import { createTestD1 } from '../test/d1';
import {
  findMembership,
  HEDGILE_ORG_ID,
  LOCK_MINUTES,
  MAX_FAILED_LOGINS,
  setPassword,
  signIn,
  type Bootstrap,
} from './membership.server';
import { ForbiddenError, type Tenant } from './tenant';

const noBootstrap: Bootstrap = { email: undefined, password: undefined };
const bootstrap: Bootstrap = { email: 'Boss@Hedgile.test', password: 'first-admin-password' };

describe('signIn', () => {
  let db: D1Database;
  beforeEach(async () => {
    db = createTestD1();
    await seedOrgWithUser(db, {
      orgId: HEDGILE_ORG_ID,
      orgName: 'Hedgile',
      userId: 'u_ann',
      email: 'ann@hedgile.test',
      password: 'ann-password-1',
    });
  });

  it('has organisation Hedgile seeded', async () => {
    expect(
      await db
        .prepare('SELECT name FROM organisations WHERE id = ?')
        .bind(HEDGILE_ORG_ID)
        .first('name')
    ).toBe('Hedgile');
  });

  it('signs in with the right password, ignoring email case and spaces', async () => {
    const result = await signIn(db, '  Ann@Hedgile.test ', 'ann-password-1', noBootstrap);
    expect(result).toMatchObject({
      ok: true,
      userId: 'u_ann',
      sessionVersion: 0,
      membership: { organisationName: 'Hedgile', role: 'user' },
    });
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    expect(await signIn(db, 'ann@hedgile.test', 'wrong-password', noBootstrap)).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(await signIn(db, 'nobody@hedgile.test', 'ann-password-1', noBootstrap)).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it(`locks the account for ${LOCK_MINUTES} minutes after ${MAX_FAILED_LOGINS} wrong passwords`, async () => {
    const t0 = new Date('2026-11-21T10:00:00Z');
    for (let i = 1; i < MAX_FAILED_LOGINS; i++) {
      expect((await signIn(db, 'ann@hedgile.test', 'wrong', noBootstrap, t0)).ok).toBe(false);
    }
    expect(await signIn(db, 'ann@hedgile.test', 'wrong', noBootstrap, t0)).toEqual({
      ok: false,
      reason: 'locked',
    });
    // Even the right password is refused while locked...
    const during = new Date(t0.getTime() + (LOCK_MINUTES - 1) * 60_000);
    expect(await signIn(db, 'ann@hedgile.test', 'ann-password-1', noBootstrap, during)).toEqual({
      ok: false,
      reason: 'locked',
    });
    // ...and accepted once the lock has passed.
    const after = new Date(t0.getTime() + (LOCK_MINUTES + 1) * 60_000);
    expect((await signIn(db, 'ann@hedgile.test', 'ann-password-1', noBootstrap, after)).ok).toBe(
      true
    );
  });

  it('resets the wrong-password count after a successful sign-in', async () => {
    for (let i = 1; i < MAX_FAILED_LOGINS; i++)
      await signIn(db, 'ann@hedgile.test', 'wrong', noBootstrap);
    await signIn(db, 'ann@hedgile.test', 'ann-password-1', noBootstrap);
    expect(await signIn(db, 'ann@hedgile.test', 'wrong', noBootstrap)).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('creates the bootstrap admin in Hedgile on their first sign-in, and only with the configured password', async () => {
    expect(await signIn(db, 'boss@hedgile.test', 'not-the-password', bootstrap)).toEqual({
      ok: false,
      reason: 'invalid',
    });
    const first = await signIn(db, 'boss@hedgile.test', 'first-admin-password', bootstrap);
    expect(first).toMatchObject({
      ok: true,
      membership: { organisationId: HEDGILE_ORG_ID, role: 'admin' },
    });
    // From then on the stored password counts, even when the setting is removed.
    expect((await signIn(db, 'boss@hedgile.test', 'first-admin-password', noBootstrap)).ok).toBe(
      true
    );
  });

  it('does not let the bootstrap setting take over an existing account', async () => {
    const takeover: Bootstrap = { email: 'ann@hedgile.test', password: 'attacker-password' };
    expect(await signIn(db, 'ann@hedgile.test', 'attacker-password', takeover)).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('refuses an account without a membership', async () => {
    await setPassword(db, 'loner@hedgile.test', 'loner-password');
    expect(await signIn(db, 'loner@hedgile.test', 'loner-password', noBootstrap)).toEqual({
      ok: false,
      reason: 'no_membership',
    });
  });

  it('a new password replaces the old one and bumps the session version', async () => {
    await setPassword(db, 'ann@hedgile.test', 'brand-new-password');
    expect((await signIn(db, 'ann@hedgile.test', 'ann-password-1', noBootstrap)).ok).toBe(false);
    expect(await signIn(db, 'ann@hedgile.test', 'brand-new-password', noBootstrap)).toMatchObject({
      ok: true,
      sessionVersion: 1,
    });
  });

  it('finds no membership in an organisation the user is not in', async () => {
    expect(await findMembership(db, 'u_ann', 'org_other')).toBeNull();
  });
});

describe('members', () => {
  let db: D1Database;
  const tenant = (organisationId: string, userId: string): Tenant => ({
    db,
    organisationId,
    organisationName: organisationId,
    userId,
    email: `${userId}@x.test`,
    userName: null,
    role: 'admin',
  });

  beforeEach(async () => {
    db = createTestD1();
    await seedOrgWithUser(db, {
      orgId: HEDGILE_ORG_ID,
      orgName: 'Hedgile',
      userId: 'u_h',
      email: 'h@x.test',
      role: 'admin',
    });
    await seedOrgWithUser(db, {
      orgId: 'org_rival',
      orgName: 'Rival',
      userId: 'u_r',
      email: 'r@x.test',
      role: 'admin',
    });
  });

  it('an admin adds a member who can then sign in with the initial password', async () => {
    await addMember(tenant(HEDGILE_ORG_ID, 'u_h'), {
      email: 'New@X.test',
      name: 'New Person',
      role: 'user',
      password: 'initial-password',
    });
    expect(await signIn(db, 'new@x.test', 'initial-password', noBootstrap)).toMatchObject({
      ok: true,
      membership: { organisationId: HEDGILE_ORG_ID, role: 'user' },
    });
  });

  it('refuses adding the same email twice', async () => {
    const input = {
      email: 'dup@x.test',
      name: null,
      role: 'user' as const,
      password: 'initial-password',
    };
    await addMember(tenant(HEDGILE_ORG_ID, 'u_h'), input);
    await expect(addMember(tenant(HEDGILE_ORG_ID, 'u_h'), input)).rejects.toThrow(
      MemberExistsError
    );
  });

  it("another organisation's admin cannot set an existing account's password by adding them", async () => {
    await addMember(tenant(HEDGILE_ORG_ID, 'u_h'), {
      email: 'shared@x.test',
      name: null,
      role: 'user',
      password: 'shared-own-password',
    });
    await addMember(tenant('org_rival', 'u_r'), {
      email: 'shared@x.test',
      name: null,
      role: 'user',
      password: 'rival-chosen-password',
    });
    expect((await signIn(db, 'shared@x.test', 'rival-chosen-password', noBootstrap)).ok).toBe(
      false
    );
    expect((await signIn(db, 'shared@x.test', 'shared-own-password', noBootstrap)).ok).toBe(true);
    // ...nor reset it, now that the account is in two organisations.
    const membership = await db
      .prepare(
        "SELECT id FROM memberships WHERE organisation_id = 'org_rival' AND email = 'shared@x.test'"
      )
      .first<string>('id');
    await expect(
      resetMemberPassword(tenant('org_rival', 'u_r'), membership ?? '', 'rival-reset-password')
    ).rejects.toThrow(ForbiddenError);
  });

  it('an admin resets the password of a member of their organisation only', async () => {
    await addMember(tenant(HEDGILE_ORG_ID, 'u_h'), {
      email: 'forgot@x.test',
      name: null,
      role: 'user',
      password: 'forgotten-password',
    });
    const id = await db
      .prepare("SELECT id FROM memberships WHERE email = 'forgot@x.test'")
      .first<string>('id');
    expect(
      await resetMemberPassword(tenant('org_rival', 'u_r'), id ?? '', 'rival-reset-password')
    ).toBe(false);
    expect(
      await resetMemberPassword(tenant(HEDGILE_ORG_ID, 'u_h'), id ?? '', 'reset-by-admin')
    ).toBe(true);
    expect((await signIn(db, 'forgot@x.test', 'reset-by-admin', noBootstrap)).ok).toBe(true);
  });
});
