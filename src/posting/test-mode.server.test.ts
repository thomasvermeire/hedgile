import { beforeEach, describe, expect, it } from 'vitest';
import { ForbiddenError, type Tenant } from '../tenancy/tenant';
import { seedOrgWithUser } from '../test/context';
import { createTestD1 } from '../test/d1';
import { getTestMode, setTestMode } from './test-mode.server';

function tenant(db: D1Database, role: 'admin' | 'user'): Tenant {
  return {
    db,
    organisationId: 'org_hedgile',
    organisationName: 'Hedgile',
    userId: 'u_h',
    email: 'h@x.test',
    userName: null,
    role,
  };
}

describe('test mode setting', () => {
  let db: D1Database;

  beforeEach(async () => {
    db = createTestD1();
    await seedOrgWithUser(db, {
      orgId: 'org_hedgile',
      orgName: 'Hedgile',
      userId: 'u_h',
      email: 'h@x.test',
      role: 'admin',
    });
  });

  it('is off by default', async () => {
    expect(await getTestMode(tenant(db, 'user'))).toBe(false);
  });

  it('an admin turns it on and off, and each change is audited', async () => {
    const admin = tenant(db, 'admin');
    await setTestMode(admin, true);
    expect(await getTestMode(admin)).toBe(true);
    await setTestMode(admin, false);
    expect(await getTestMode(admin)).toBe(false);
    const { results } = await db
      .prepare(
        "SELECT details FROM audit_log WHERE action = 'organisation.test_mode_changed' AND organisation_id = ? ORDER BY rowid"
      )
      .bind('org_hedgile')
      .all<{ details: string }>();
    expect(results.map((r) => JSON.parse(r.details))).toEqual([
      { testMode: true },
      { testMode: false },
    ]);
  });

  it('a user who is not an admin cannot change it', async () => {
    await expect(setTestMode(tenant(db, 'user'), true)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await getTestMode(tenant(db, 'user'))).toBe(false);
  });
});
