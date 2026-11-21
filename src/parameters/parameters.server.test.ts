import { beforeEach, describe, expect, it } from 'vitest';
import { ForbiddenError, type Tenant } from '../tenancy/tenant';
import { seedOrgWithUser } from '../test/context';
import { createTestD1 } from '../test/d1';
import {
  getParameter,
  InvalidParameterError,
  parameterHistory,
  setParameter,
  threeWayMatchTolerance,
} from './parameters.server';

const KEY = 'three_way_match_tolerance_pct';

function tenant(db: D1Database, role: 'admin' | 'user', userId = 'u_h'): Tenant {
  return {
    db,
    organisationId: 'org_hedgile',
    organisationName: 'Hedgile',
    userId,
    email: `${userId}@x.test`,
    userName: null,
    role,
  };
}

describe('organisation parameters', () => {
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
    await db.prepare("UPDATE users SET name = 'Hanna' WHERE id = 'u_h'").run();
  });

  it('defaults to 5% with no stored row', async () => {
    await db.prepare('DELETE FROM organisation_parameters').run();
    const row = await db
      .prepare('SELECT COUNT(*) AS n FROM organisation_parameters WHERE organisation_id = ?')
      .bind('org_hedgile')
      .first<{ n: number }>();
    expect(row?.n).toBe(0);
    expect(await threeWayMatchTolerance(tenant(db, 'user'))).toBe(5);
  });

  it('reads the stored value, which the migration seeds as 5', async () => {
    const seeded = await db
      .prepare('SELECT value FROM organisation_parameters WHERE organisation_id = ? AND key = ?')
      .bind('org_hedgile', KEY)
      .first<{ value: string }>();
    expect(seeded?.value).toBe('5');
    expect(await getParameter(tenant(db, 'user'), KEY)).toBe(5);
  });

  it('an admin changes it, and the history says who, when, old and new', async () => {
    const admin = tenant(db, 'admin');
    expect(await setParameter(admin, KEY, '7.5')).toBe(7.5);
    expect(await setParameter(admin, KEY, 3)).toBe(3);
    const history = await parameterHistory(tenant(db, 'user'), KEY);
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({
      userId: 'u_h',
      userName: 'Hanna',
      userEmail: 'h@x.test',
      oldValue: 7.5,
      newValue: 3,
    });
    expect(history[1]).toMatchObject({ oldValue: 5, newValue: 7.5 });
    expect(history[0]?.at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    const stored = await db
      .prepare('SELECT value, updated_by AS by FROM organisation_parameters WHERE key = ?')
      .bind(KEY)
      .first<{ value: string; by: string }>();
    expect(stored).toEqual({ value: '3', by: 'u_h' });
  });

  it('a user who is not an admin cannot change it', async () => {
    await expect(setParameter(tenant(db, 'user'), KEY, 9)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await threeWayMatchTolerance(tenant(db, 'user'))).toBe(5);
    expect(await parameterHistory(tenant(db, 'admin'), KEY)).toEqual([]);
  });

  it.each(['0', '-1', '100.01', '101', '1.234', 'abc', '', '5%', '1e1', NaN, null])(
    'refuses %j',
    async (bad) => {
      await expect(setParameter(tenant(db, 'admin'), KEY, bad)).rejects.toBeInstanceOf(
        InvalidParameterError
      );
      expect(await threeWayMatchTolerance(tenant(db, 'admin'))).toBe(5);
      expect(await parameterHistory(tenant(db, 'admin'), KEY)).toEqual([]);
    }
  );

  it.each([
    ['0.01', 0.01],
    ['100', 100],
    [' 12.5 ', 12.5],
  ])('accepts %j', async (input, expected) => {
    expect(await setParameter(tenant(db, 'admin'), KEY, input)).toBe(expected);
  });

  it('is read fresh at each call, never cached', async () => {
    const reader = tenant(db, 'user');
    expect(await threeWayMatchTolerance(reader)).toBe(5);
    await setParameter(tenant(db, 'admin'), KEY, 2);
    expect(await threeWayMatchTolerance(reader)).toBe(2);
    await db
      .prepare('UPDATE organisation_parameters SET value = ? WHERE key = ?')
      .bind('11', KEY)
      .run();
    expect(await threeWayMatchTolerance(reader)).toBe(11);
  });
});
