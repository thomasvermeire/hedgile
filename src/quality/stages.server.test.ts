import { beforeEach, describe, expect, it } from 'vitest';
import { seedOrgWithUser } from '../test/context';
import { createTestD1, runSqlFile } from '../test/d1';
import { ForbiddenError, type Tenant } from '../tenancy/tenant';
import {
  activeQualityStages,
  addQualityStage,
  listQualityStages,
  newStageInput,
  setQualityStageActive,
  StageCodeTakenError,
  StageLockedError,
  stageInput,
  updateQualityStage,
} from './stages.server';

function tenant(db: D1Database, role: 'admin' | 'user' = 'admin'): Tenant {
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

describe('quality stages', () => {
  let db: D1Database;
  let admin: Tenant;

  beforeEach(async () => {
    db = createTestD1();
    await seedOrgWithUser(db, {
      orgId: 'org_hedgile',
      orgName: 'Hedgile',
      userId: 'u_h',
      email: 'h@x.test',
      role: 'admin',
    });
    await runSqlFile(db, 'db/reset-demo.sql');
    admin = tenant(db);
  });

  async function byCode(code: string) {
    const stage = (await listQualityStages(admin)).find((s) => s.code === code);
    if (!stage) throw new Error(`no stage ${code}`);
    return stage;
  }

  async function auditActions(): Promise<string[]> {
    const { results } = await db
      .prepare("SELECT action FROM audit_log WHERE object_type = 'quality_stage' ORDER BY rowid")
      .all<{ action: string }>();
    return results.map((r) => r.action);
  }

  it('seeds TA, PA and FA active and the rest locked, in order', async () => {
    const stages = await listQualityStages(admin);
    expect(stages.map((s) => [s.code, s.status])).toEqual([
      ['TA', 'active'],
      ['PA', 'active'],
      ['LA', 'locked'],
      ['EX', 'locked'],
      ['VA', 'locked'],
      ['UA', 'locked'],
      ['FA', 'active'],
      ['IS', 'locked'],
    ]);
    expect((await activeQualityStages(admin)).map((s) => s.code)).toEqual(['TA', 'PA', 'FA']);
  });

  it('adds a stage that starts active, last in order, and audits it', async () => {
    const id = await addQualityStage(admin, newStageInput.parse({ code: 'zz', name: 'Zed' }));
    const stage = await byCode('ZZ');
    expect(stage).toMatchObject({ id, name: 'Zed', status: 'active', sortOrder: 9 });
    expect((await activeQualityStages(admin)).map((s) => s.code)).toContain('ZZ');
    expect(await auditActions()).toEqual(['quality_stage.created']);
  });

  it('refuses a duplicate code', async () => {
    await expect(
      addQualityStage(admin, newStageInput.parse({ code: 'TA', name: 'Again' }))
    ).rejects.toBeInstanceOf(StageCodeTakenError);
    expect(await listQualityStages(admin)).toHaveLength(8);
    expect(await auditActions()).toEqual([]);
  });

  it('refuses invalid codes', () => {
    for (const code of ['', 'T', 'TAX', 'T1', 'T ', '1A']) {
      expect(newStageInput.safeParse({ code, name: 'X' }).success).toBe(false);
    }
    expect(newStageInput.safeParse({ code: 'ab', name: 'X' }).data?.code).toBe('AB');
    expect(stageInput.safeParse({ name: '' }).success).toBe(false);
    expect(stageInput.safeParse({ name: 'X', sortOrder: '1.5' }).success).toBe(false);
  });

  it('deactivates and reactivates an unlocked stage, with audit entries', async () => {
    const pa = await byCode('PA');
    expect(await setQualityStageActive(admin, pa.id, false)).toBe(true);
    expect((await byCode('PA')).status).toBe('inactive');
    expect((await activeQualityStages(admin)).map((s) => s.code)).toEqual(['TA', 'FA']);
    expect(await setQualityStageActive(admin, pa.id, true)).toBe(true);
    expect((await byCode('PA')).status).toBe('active');
    expect(await auditActions()).toEqual(['quality_stage.deactivated', 'quality_stage.activated']);
  });

  it('refuses to activate or deactivate a locked stage', async () => {
    const la = await byCode('LA');
    await expect(setQualityStageActive(admin, la.id, true)).rejects.toBeInstanceOf(
      StageLockedError
    );
    await expect(setQualityStageActive(admin, la.id, false)).rejects.toBeInstanceOf(
      StageLockedError
    );
    expect((await byCode('LA')).status).toBe('locked');
    expect(await auditActions()).toEqual([]);
  });

  it('edits name, description and order, keeping the status', async () => {
    const la = await byCode('LA');
    await updateQualityStage(
      admin,
      la.id,
      stageInput.parse({ name: 'Laboratory', description: ' ', sortOrder: '20' })
    );
    expect(await byCode('LA')).toMatchObject({
      name: 'Laboratory',
      description: null,
      sortOrder: 20,
      status: 'locked',
    });
    expect((await listQualityStages(admin)).at(-1)?.code).toBe('LA');
    expect(await auditActions()).toEqual(['quality_stage.updated']);
    expect(await updateQualityStage(admin, 'qs_nope', stageInput.parse({ name: 'X' }))).toBe(false);
  });

  it('is for admins only', async () => {
    const user = tenant(db, 'user');
    const ta = await byCode('TA');
    await expect(
      addQualityStage(user, newStageInput.parse({ code: 'ZZ', name: 'Zed' }))
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      updateQualityStage(user, ta.id, stageInput.parse({ name: 'X' }))
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setQualityStageActive(user, ta.id, false)).rejects.toBeInstanceOf(ForbiddenError);
    expect((await listQualityStages(user)).length).toBe(8);
    expect(await auditActions()).toEqual([]);
  });
});
