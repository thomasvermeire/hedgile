import { describe, expect, it } from 'vitest';
import { createTestD1, runSqlFile } from '../test/d1';

const count = (db: D1Database, table: string) =>
  db
    .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE organisation_id = 'org_hedgile'`)
    .first<number>('n');

describe('db/reset-demo.sql', () => {
  it('restores the start state and keeps users, memberships and other organisations', async () => {
    const db = createTestD1();
    await db.batch([
      db.prepare(
        "INSERT INTO organisations (id, slug, name) VALUES ('org_rival', 'rival', 'Rival')"
      ),
      db.prepare(
        "INSERT INTO users (id, issuer, subject, email) VALUES ('u1', 'i', 's', 'a@x.test')"
      ),
      db.prepare(
        "INSERT INTO memberships (id, organisation_id, user_id, email, role) VALUES ('m1', 'org_hedgile', 'u1', 'a@x.test', 'admin')"
      ),
      db.prepare(
        "INSERT INTO companies (id, organisation_id, name) VALUES ('c_extra', 'org_hedgile', 'Made during the demo')"
      ),
      db.prepare(
        "INSERT INTO companies (id, organisation_id, name) VALUES ('c_rival', 'org_rival', 'Rival data')"
      ),
      db.prepare(
        "UPDATE organisations SET name = 'Renamed', base_currency = 'EUR' WHERE id = 'org_hedgile'"
      ),
    ]);

    await runSqlFile(db, 'db/reset-demo.sql');
    await runSqlFile(db, 'db/reset-demo.sql'); // can run again

    expect(
      await db
        .prepare("SELECT name, base_currency AS c FROM organisations WHERE id = 'org_hedgile'")
        .first()
    ).toEqual({
      name: 'Hedgile',
      c: 'USD',
    });
    expect(
      await db.prepare("SELECT name FROM companies WHERE organisation_id = 'org_hedgile'").all()
    ).toMatchObject({
      results: [{ name: 'Hedgile Demo Trading BV' }],
    });
    expect(await count(db, 'materials')).toBe(2);
    expect(await count(db, 'metal_references')).toBe(1);
    expect(await count(db, 'extraction_drafts')).toBe(0);
    expect(await count(db, 'memberships')).toBe(1);
    expect(await db.prepare("SELECT name FROM companies WHERE id = 'c_rival'").first('name')).toBe(
      'Rival data'
    );
  });
});
