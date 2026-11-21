import { beforeEach, describe, expect, it } from 'vitest';
import { listAttachments } from '../master-data/attachments.server';
import { companyInput, listCompanies } from '../master-data/companies.server';
import { seedOrgWithUser } from '../test/context';
import { createTestD1 } from '../test/d1';
import { createTestR2 } from '../test/r2';
import type { Tenant } from '../tenancy/tenant';
import type { Extractor } from './claude.server';
import {
  confirmCompanyDraft,
  createDraft,
  discardDraft,
  DraftClosedError,
  getDraft,
  InvalidDocumentError,
} from './drafts.server';
import { companyKind, normaliseFields } from './kinds.server';

const pdf = (body = 'hello') =>
  new File([`%PDF-1.7\n${body}`], 'Rival letter.pdf', { type: 'application/pdf' });

const fakeExtractor: Extractor = {
  async extract() {
    return {
      model: 'claude-opus-5-5',
      fields: {
        name: { value: 'Rival Metals GmbH', confidence: 0.95, evidence: 'Rival Metals GmbH' },
        country: { value: 'DE', confidence: 0.7, evidence: 'Hamburg, Germany' },
        vatNumber: { value: null, confidence: 0, evidence: null },
        address: { value: 'Hafenstr. 1, Hamburg', confidence: 0.9, evidence: 'Hafenstr. 1' },
      },
    };
  },
};

describe('Laimon drafts', () => {
  let db: D1Database;
  let bucket: ReturnType<typeof createTestR2>;
  let tenant: Tenant;

  beforeEach(async () => {
    db = createTestD1();
    bucket = createTestR2();
    await seedOrgWithUser(db, {
      orgId: 'org_drafts_test',
      orgName: 'Hedgile',
      userId: 'u1',
      email: 'a@x.test',
    });
    tenant = {
      db,
      organisationId: 'org_drafts_test',
      organisationName: 'Hedgile',
      userId: 'u1',
      email: 'a@x.test',
      userName: null,
      role: 'user',
    };
  });

  it('dropping a PDF returns a draft with field-level confidence, and saves nothing else', async () => {
    const id = await createDraft(tenant, bucket, fakeExtractor, companyKind, pdf());
    const draft = await getDraft(tenant, id);
    expect(draft?.status).toBe('draft');
    expect(draft?.fields.name).toEqual({
      value: 'Rival Metals GmbH',
      confidence: 0.95,
      evidence: 'Rival Metals GmbH',
    });
    expect(draft?.fields.vatNumber?.confidence).toBe(0);
    expect(await listCompanies(tenant)).toEqual([]);
    expect(bucket.keys()).toHaveLength(1);
    const audit = await db
      .prepare('SELECT action, details FROM audit_log WHERE object_id = ?')
      .bind(id)
      .first<{ action: string; details: string }>();
    expect(audit?.action).toBe('laimon.extracted');
    expect(JSON.parse(audit?.details ?? '{}')).toMatchObject({
      kind: 'company',
      filename: 'Rival letter.pdf',
      model: 'claude-opus-5-5',
    });
  });

  it('confirming creates the company from the checked values, with the PDF attached', async () => {
    const id = await createDraft(tenant, bucket, fakeExtractor, companyKind, pdf());
    const companyId = await confirmCompanyDraft(
      tenant,
      id,
      companyInput.parse({
        name: 'Rival Metals GmbH',
        country: 'DE',
        vatNumber: 'DE123456789',
        address: 'Hafenstr. 1, Hamburg',
      })
    );
    const [company] = await listCompanies(tenant);
    expect(company).toMatchObject({ id: companyId, vatNumber: 'DE123456789' });
    const [attachment] = await listAttachments(tenant, 'company');
    expect(attachment).toMatchObject({
      objectId: companyId,
      filename: 'Rival letter.pdf',
      contentType: 'application/pdf',
    });
    expect(bucket.keys()).toEqual([attachment?.r2Key]);
    expect((await getDraft(tenant, id))?.status).toBe('confirmed');
    const audit = await db
      .prepare("SELECT details FROM audit_log WHERE action = 'company.created' AND object_id = ?")
      .bind(companyId)
      .first<string>('details');
    expect(JSON.parse(audit ?? '{}')).toEqual({
      source: 'laimon',
      draftId: id,
      changedFields: ['vatNumber'],
    });
  });

  it('a draft can be confirmed only once', async () => {
    const id = await createDraft(tenant, bucket, fakeExtractor, companyKind, pdf());
    const input = companyInput.parse({ name: 'Rival' });
    await confirmCompanyDraft(tenant, id, input);
    await expect(confirmCompanyDraft(tenant, id, input)).rejects.toThrow(DraftClosedError);
    expect(await listCompanies(tenant)).toHaveLength(1);
  });

  it('discarding removes the stored PDF and saves nothing', async () => {
    const id = await createDraft(tenant, bucket, fakeExtractor, companyKind, pdf());
    expect(await discardDraft(tenant, bucket, id)).toBe(true);
    expect(bucket.keys()).toEqual([]);
    expect((await getDraft(tenant, id))?.status).toBe('discarded');
    expect(await listCompanies(tenant)).toEqual([]);
  });

  it('refuses a file that is not a PDF, and stores nothing', async () => {
    const notPdf = new File(['<html>'], 'x.pdf', { type: 'application/pdf' });
    await expect(createDraft(tenant, bucket, fakeExtractor, companyKind, notPdf)).rejects.toThrow(
      InvalidDocumentError
    );
    expect(bucket.keys()).toEqual([]);
  });

  it('removes the stored PDF when reading fails', async () => {
    const failing: Extractor = { extract: () => Promise.reject(new Error('boom')) };
    await expect(createDraft(tenant, bucket, failing, companyKind, pdf())).rejects.toThrow('boom');
    expect(bucket.keys()).toEqual([]);
  });

  it('normalises what the model returns', () => {
    expect(
      normaliseFields(companyKind, {
        name: { value: '  ACME  ', confidence: 1.4, evidence: ' ' },
        country: { value: '', confidence: 0.9, evidence: 'x' },
      })
    ).toEqual({
      name: { value: 'ACME', confidence: 1, evidence: null },
      country: { value: null, confidence: 0, evidence: 'x' },
      vatNumber: { value: null, confidence: 0, evidence: null },
      address: { value: null, confidence: 0, evidence: null },
    });
  });
});
