/**
 * "A user of another organisation sees no Hedgile data": every tenant-scoped
 * read and write, tried from a second organisation against Hedgile's records.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { getAttachment, listAttachments } from '../master-data/attachments.server';
import {
  createCompany,
  getCompany,
  listCompanies,
  updateCompany,
  companyInput,
} from '../master-data/companies.server';
import {
  createMaterial,
  getMaterial,
  listMaterials,
  updateMaterial,
} from '../master-data/materials.server';
import {
  addReference,
  createMetal,
  deleteMetal,
  getMetal,
  getMetalReference,
  listMetals,
  metalInput,
  metalUsage,
  referenceInput,
  renameMetal,
  updateReference,
} from '../markets/markets.server';
import {
  addHoliday,
  getCalendar,
  holidayInput,
  listCalendars,
  removeHoliday,
  setWeekdays,
  weekdaysInput,
} from '../calendars/calendars.server';
import { getReference, listActiveReferences } from '../master-data/references.server';
import { getParameter, parameterHistory, setParameter } from '../parameters/parameters.server';
import { getTestMode, setTestMode } from '../posting/test-mode.server';
import { changeRole, listMembers } from '../settings/members.server';
import { getDraft, discardDraft } from '../laimon/drafts.server';
import {
  activeQualityStages,
  addQualityStage,
  getQualityStage,
  listQualityStages,
  newStageInput,
  setQualityStageActive,
  stageInput,
  updateQualityStage,
} from '../quality/stages.server';
import { getProvenance, provenanceStatement } from '../provenance/provenance.server';
import { createTestD1, runSqlFile } from '../test/d1';
import { createTestR2 } from '../test/r2';
import { seedOrgWithUser } from '../test/context';
import type { Tenant } from './tenant';

function tenant(db: D1Database, organisationId: string, userId: string): Tenant {
  return {
    db,
    organisationId,
    organisationName: organisationId,
    userId,
    email: `${userId}@x.test`,
    userName: null,
    role: 'admin',
  };
}

describe('organisation isolation', () => {
  let db: D1Database;
  let hedgile: Tenant;
  let other: Tenant;

  beforeEach(async () => {
    db = createTestD1();
    await seedOrgWithUser(db, {
      orgId: 'org_hedgile',
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
    await runSqlFile(db, 'db/reset-demo.sql');
    hedgile = tenant(db, 'org_hedgile', 'u_h');
    other = tenant(db, 'org_rival', 'u_r');
    await db.batch([
      db.prepare(
        "INSERT INTO attachments (id, organisation_id, object_type, object_id, r2_key, filename, content_type, size) VALUES ('att_h', 'org_hedgile', 'company', 'co_hedgile_limited', 'k', 'a.pdf', 'application/pdf', 1)"
      ),
      db.prepare(
        "INSERT INTO extraction_drafts (id, organisation_id, user_id, kind, status, r2_key, filename, content_type, size, fields) VALUES ('drf_h', 'org_hedgile', 'u_h', 'company', 'draft', 'k2', 'b.pdf', 'application/pdf', 1, '{}')"
      ),
      provenanceStatement(hedgile, {
        objectType: 'line',
        objectId: 'l1',
        field: 'amount',
        value: 61500,
        trigger: 'quantity',
        mode: 'automatic',
        formula: 'price × quantity',
        inputs: [
          { name: 'price', value: 12300 },
          { name: 'quantity', value: 5 },
        ],
      }),
    ]);
  });

  it('Hedgile sees its own data', async () => {
    expect((await listCompanies(hedgile)).map((c) => c.name)).toEqual(['Hedgile Limited']);
    expect(await listMaterials(hedgile)).toHaveLength(2);
    expect(await listActiveReferences(hedgile)).toHaveLength(2);
    expect(await getAttachment(hedgile, 'att_h')).not.toBeNull();
    expect(await getDraft(hedgile, 'drf_h')).not.toBeNull();
    expect((await getProvenance(hedgile, 'line', 'l1', 'amount'))?.latest.value).toBe('61500');
  });

  it('another organisation lists none of it', async () => {
    expect(await listCompanies(other)).toEqual([]);
    expect(await listMaterials(other)).toEqual([]);
    expect(await listActiveReferences(other)).toEqual([]);
    expect(await listAttachments(other, 'company')).toEqual([]);
    expect((await listMembers(other)).map((m) => m.email)).toEqual(['r@x.test']);
  });

  it('another organisation cannot open it by id', async () => {
    expect(await getCompany(other, 'co_hedgile_limited')).toBeNull();
    expect(await getMaterial(other, 'mat_ni_cathode')).toBeNull();
    expect(await getReference(other, 'ref_lme_ni_cash')).toBeNull();
    expect(await getAttachment(other, 'att_h')).toBeNull();
    expect(await getDraft(other, 'drf_h')).toBeNull();
    expect(await getProvenance(other, 'line', 'l1', 'amount')).toBeNull();
  });

  it('another organisation cannot change it', async () => {
    expect(
      await updateCompany(other, 'co_hedgile_limited', companyInput.parse({ name: 'Taken' }))
    ).toBe(false);
    expect(
      await updateMaterial(other, 'mat_ni_cathode', { code: 'X', name: 'Taken', metal: 'Zinc' })
    ).toBe(false);
    expect(await changeRole(other, 'mem_u_h', 'user')).toBe(false);
    expect(await discardDraft(other, createTestR2(), 'drf_h')).toBe(false);
    expect((await getCompany(hedgile, 'co_hedgile_limited'))?.name).toBe('Hedgile Limited');
    expect((await getMaterial(hedgile, 'mat_ni_cathode'))?.name).toBe('Nickel cathodes');
    expect((await getDraft(hedgile, 'drf_h'))?.status).toBe('draft');
  });

  it("another organisation cannot read or change Hedgile's test mode", async () => {
    await setTestMode(other, true);
    expect(await getTestMode(other)).toBe(true);
    expect(await getTestMode(hedgile)).toBe(false);
    await setTestMode(hedgile, true);
    await setTestMode(other, false);
    expect(await getTestMode(hedgile)).toBe(true);
  });

  it("another organisation cannot read or change Hedgile's parameters", async () => {
    const key = 'three_way_match_tolerance_pct';
    expect(await getParameter(hedgile, key)).toBe(5);
    await setParameter(other, key, 9);
    expect(await getParameter(other, key)).toBe(9);
    expect(await getParameter(hedgile, key)).toBe(5);
    expect(await parameterHistory(hedgile, key)).toEqual([]);
    await setParameter(hedgile, key, 2);
    await setParameter(other, key, 8);
    expect(await getParameter(hedgile, key)).toBe(2);
    expect((await parameterHistory(hedgile, key)).map((c) => c.newValue)).toEqual([2]);
    expect((await parameterHistory(other, key)).map((c) => c.newValue)).toEqual([8, 9]);
  });

  it("each organisation's new records stay its own", async () => {
    await createCompany(other, companyInput.parse({ name: 'Rival Metals', country: 'DE' }));
    await createMaterial(other, { code: 'NI-CATH', name: 'Their cathodes', metal: 'Nickel' });
    expect((await listCompanies(hedgile)).map((c) => c.name)).toEqual(['Hedgile Limited']);
    expect((await listMaterials(hedgile)).find((m) => m.code === 'NI-CATH')?.name).toBe(
      'Nickel cathodes'
    );
  });

  it("another organisation cannot see or change Hedgile's metals and references", async () => {
    expect(await listMetals(hedgile)).toHaveLength(2);
    expect(await listMetals(other)).toEqual([]);
    expect(await getMetal(other, 'mtl_ni')).toBeNull();
    expect(await getMetalReference(other, 'ref_lme_ni_cash')).toBeNull();
    expect(await metalUsage(other, 'mtl_ni')).toEqual([]);
    expect(await renameMetal(other, 'mtl_ni', 'Taken')).toBe(false);
    expect(await deleteMetal(other, 'mtl_ni')).toBe(false);
    const ref = referenceInput.parse({ name: 'Mine', source: 'X', sourceType: 'manual' });
    expect(await addReference(other, 'mtl_ni', ref)).toBeNull();
    expect(await updateReference(other, 'ref_lme_ni_cash', ref)).toBe(false);
    expect((await getMetal(hedgile, 'mtl_ni'))?.name).toBe('Nickel');
    expect((await getMetalReference(hedgile, 'ref_lme_ni_cash'))?.name).toBe(
      'LME Nickel Cash Settlement'
    );
    // The same symbol is free in another organisation.
    await createMetal(other, metalInput.parse({ symbol: 'Ni', name: 'Nickel' }));
    expect((await listMetals(hedgile)).map((m) => m.id)).toEqual(['mtl_co', 'mtl_ni']);
  });

  it("another organisation cannot read or change Hedgile's publication calendars", async () => {
    expect(await getCalendar(other, 'ref_lme_ni_cash')).toBeNull();
    expect(await listCalendars(other)).toEqual([]);
    expect(
      await setWeekdays(other, 'ref_lme_ni_cash', weekdaysInput.parse({ weekdays: [1] }))
    ).toBe(false);
    expect(
      await addHoliday(other, 'ref_lme_ni_cash', holidayInput.parse({ date: '2019-06-03' }))
    ).toBe(false);
    expect(await removeHoliday(other, 'ref_lme_ni_cash', '2019-01-01')).toBe(false);
    const lme = await getCalendar(hedgile, 'ref_lme_ni_cash');
    expect(lme?.weekdays).toEqual([1, 2, 3, 4, 5]);
    expect(lme?.holidays).toHaveLength(8);
  });

  it('quality stages: another organisation sees and changes none of them', async () => {
    expect(await listQualityStages(hedgile)).toHaveLength(8);
    expect(await listQualityStages(other)).toEqual([]);
    expect(await activeQualityStages(other)).toEqual([]);
    expect(await getQualityStage(other, 'qs_ta')).toBeNull();
    expect(await setQualityStageActive(other, 'qs_ta', false)).toBe(false);
    expect(await updateQualityStage(other, 'qs_ta', stageInput.parse({ name: 'Hacked' }))).toBe(
      false
    );
    expect((await getQualityStage(hedgile, 'qs_ta'))?.status).toBe('active');
    expect((await getQualityStage(hedgile, 'qs_ta'))?.name).toBe('Typical');
    // The same code is free in another organisation, and stays its own.
    await addQualityStage(other, newStageInput.parse({ code: 'TA', name: 'Their TA' }));
    expect((await listQualityStages(other)).map((s) => s.name)).toEqual(['Their TA']);
    expect(await listQualityStages(hedgile)).toHaveLength(8);
  });
});
