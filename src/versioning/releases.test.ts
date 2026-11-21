import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import packageJson from '../../package.json';
import { releases } from './releases';

const releaseSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((d) => {
      const parsed = new Date(`${d}T00:00:00Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(d);
    }, 'not a real date'),
  changes: z
    .array(
      z.object({
        type: z.enum(['story', 'bug', 'improvement']),
        title: z.string().min(1),
        laimonadeId: z
          .string()
          .regex(/^[0-9a-f]{24}$/)
          .nullable(),
      })
    )
    .min(1),
});

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

describe('releases', () => {
  it('matches the schema', () => {
    expect(() => z.array(releaseSchema).parse(releases)).not.toThrow();
  });

  it('has unique versions, newest first', () => {
    const versions = releases.map((r) => r.version);
    expect(new Set(versions).size).toBe(versions.length);
    for (let i = 1; i < releases.length; i++) {
      const newer = releases[i - 1];
      const older = releases[i];
      expect(compareVersions(newer?.version ?? '', older?.version ?? '')).toBeGreaterThan(0);
      expect((newer?.date ?? '') >= (older?.date ?? '')).toBe(true);
    }
  });

  it('has the version in package.json as its newest release', () => {
    expect(releases[0]?.version).toBe(packageJson.version);
  });

  it('rejects bad data', () => {
    const bad = { version: '1', date: '2026-02-30', changes: [] };
    expect(releaseSchema.safeParse(bad).success).toBe(false);
  });
});
