/**
 * A D1Database stand-in for tests, backed by Node's built-in SQLite and
 * loaded with the real migrations. Implements the parts of D1 the app uses.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

type Bindable = string | number | null | boolean;

class Statement {
  constructor(
    private readonly db: DatabaseSync,
    readonly sql: string,
    private readonly params: Bindable[] = []
  ) {}

  bind(...params: Bindable[]): Statement {
    return new Statement(this.db, this.sql, params);
  }

  private args(): SQLInputValue[] {
    return this.params.map((p) => (typeof p === 'boolean' ? (p ? 1 : 0) : p));
  }

  async first<T>(column?: string): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...this.args()) as
      Record<string, unknown> | undefined;
    if (!row) return null;
    return (column ? row[column] : { ...row }) as T;
  }

  async all<T>(): Promise<{ results: T[]; success: true }> {
    const rows = this.db.prepare(this.sql).all(...this.args()) as Record<string, unknown>[];
    return { results: rows.map((r) => ({ ...r })) as T[], success: true };
  }

  async run(): Promise<{ success: true; meta: { changes: number } }> {
    const info = this.db.prepare(this.sql).run(...this.args());
    return { success: true, meta: { changes: Number(info.changes) } };
  }
}

export function createTestD1(): D1Database {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const dir = join(process.cwd(), 'migrations');
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    db.exec(readFileSync(join(dir, file), 'utf8'));
  }
  const d1 = {
    prepare: (sql: string) => new Statement(db, sql),
    batch: async (statements: Statement[]) => {
      db.exec('BEGIN');
      try {
        const results = [];
        for (const s of statements) results.push(await s.all());
        db.exec('COMMIT');
        return results;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    exec: async (sql: string) => {
      db.exec(sql);
      return { count: 1, duration: 0 };
    },
  };
  return d1 as unknown as D1Database;
}

/** Run a .sql file from the repository (e.g. db/reset-demo.sql) against a test D1. */
export async function runSqlFile(d1: D1Database, path: string): Promise<void> {
  await d1.exec(readFileSync(join(process.cwd(), path), 'utf8'));
}
