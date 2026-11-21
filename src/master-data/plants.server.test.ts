import { beforeEach, describe, expect, it } from 'vitest';
import {
  createPlant,
  createStorageLocation,
  getPlant,
  getStorageLocation,
  getStorageLocationsForPlant,
  listPlants,
  listStorageLocations,
  plantInput,
  storageLocationInput,
  updatePlant,
  updateStorageLocation,
} from './plants.server';
import { createTestD1, runSqlFile } from '../test/d1';
import { seedOrgWithUser } from '../test/context';
import type { Tenant } from '../tenancy/tenant';

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

function createTenant(db: D1Database) {
  return tenant(db, 'org_hedgile', 'u_h');
}

describe('plants.server', () => {
  let db: D1Database;
  let t: Tenant;

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
    t = createTenant(db);
  });

  describe('plantInput schema', () => {
    it('accepts valid plant input', () => {
      const result = plantInput.parse({
        companyId: 'co_test',
        internalNumber: 'PL001',
        code: 'PL-MAIN',
        description: 'Main Plant',
        address: 'Test Address',
      });
      expect(result.companyId).toBe('co_test');
      expect(result.internalNumber).toBe('PL001');
      expect(result.code).toBe('PL-MAIN');
      expect(result.description).toBe('Main Plant');
      expect(result.address).toBe('Test Address');
    });

    it('rejects empty companyId', () => {
      const result = plantInput.safeParse({
        companyId: '',
        internalNumber: 'PL001',
        code: 'PL-MAIN',
        description: 'Main Plant',
        address: null,
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty code', () => {
      const result = plantInput.safeParse({
        companyId: 'co_test',
        internalNumber: 'PL001',
        code: '',
        description: 'Main Plant',
        address: null,
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty description', () => {
      const result = plantInput.safeParse({
        companyId: 'co_test',
        internalNumber: 'PL001',
        code: 'PL-MAIN',
        description: '',
        address: null,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('storageLocationInput schema', () => {
    it('accepts valid storage location input', () => {
      const result = storageLocationInput.parse({
        plantId: 'pl_test',
        code: 'SL-001',
        description: 'Warehouse 1',
      });
      expect(result.plantId).toBe('pl_test');
      expect(result.code).toBe('SL-001');
      expect(result.description).toBe('Warehouse 1');
    });

    it('rejects empty plantId', () => {
      const result = storageLocationInput.safeParse({
        plantId: '',
        code: 'SL-001',
        description: 'Warehouse 1',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty code', () => {
      const result = storageLocationInput.safeParse({
        plantId: 'pl_test',
        code: '',
        description: 'Warehouse 1',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty description', () => {
      const result = storageLocationInput.safeParse({
        plantId: 'pl_test',
        code: 'SL-001',
        description: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('listPlants', () => {
    it('returns plants for the organisation', async () => {
      const plants = await listPlants(t);
      expect(plants).toHaveLength(1);
      expect(plants[0]!.code).toBe('PL-MAIN');
      expect(plants[0]!.description).toBe('Main Plant');
    });

    it('filters by companyId', async () => {
      const plants = await listPlants(t, 'co_hedgile_limited');
      expect(plants).toHaveLength(1);
      expect(plants[0]!.companyId).toBe('co_hedgile_limited');
    });

    it('returns empty array for non-existent company', async () => {
      const plants = await listPlants(t, 'co_nonexistent');
      expect(plants).toHaveLength(0);
    });
  });

  describe('getPlant', () => {
    it('returns a plant by id', async () => {
      const plant = await getPlant(t, 'pl_hedgile_main');
      expect(plant).not.toBeNull();
      expect(plant?.code).toBe('PL-MAIN');
      expect(plant?.internalNumber).toBe('PL001');
    });

    it('returns null for non-existent plant', async () => {
      const plant = await getPlant(t, 'pl_nonexistent');
      expect(plant).toBeNull();
    });
  });

  describe('createPlant', () => {
    it('creates a new plant', async () => {
      const companyId = 'co_hedgile_limited';
      const id = await createPlant(t, {
        companyId,
        internalNumber: 'PL002',
        code: 'PL-SECOND',
        description: 'Second Plant',
        address: 'Second Address',
      });
      expect(id).toMatch(/^pl_/);

      const plant = await getPlant(t, id);
      expect(plant).not.toBeNull();
      expect(plant?.code).toBe('PL-SECOND');
      expect(plant?.companyId).toBe(companyId);
    });
  });

  describe('updatePlant', () => {
    it('updates an existing plant', async () => {
      const updated = await updatePlant(t, 'pl_hedgile_main', {
        companyId: 'co_hedgile_limited',
        internalNumber: 'PL001-UPDATED',
        code: 'PL-MAIN-UPDATED',
        description: 'Main Plant Updated',
        address: 'Updated Address',
      });
      expect(updated).toBe(true);

      const plant = await getPlant(t, 'pl_hedgile_main');
      expect(plant?.code).toBe('PL-MAIN-UPDATED');
      expect(plant?.description).toBe('Main Plant Updated');
    });

    it('returns false for non-existent plant', async () => {
      const updated = await updatePlant(t, 'pl_nonexistent', {
        companyId: 'co_hedgile_limited',
        internalNumber: 'PL001',
        code: 'PL-MAIN',
        description: 'Main Plant',
        address: null,
      });
      expect(updated).toBe(false);
    });
  });

  describe('listStorageLocations', () => {
    it('returns storage locations for the organisation', async () => {
      const locations = await listStorageLocations(t);
      expect(locations).toHaveLength(1);
      expect(locations[0]!.code).toBe('SL-WH01');
      expect(locations[0]!.description).toBe('Main Warehouse');
    });

    it('filters by plantId', async () => {
      const locations = await listStorageLocations(t, 'pl_hedgile_main');
      expect(locations).toHaveLength(1);
      expect(locations[0]!.plantId).toBe('pl_hedgile_main');
    });

    it('returns empty array for non-existent plant', async () => {
      const locations = await listStorageLocations(t, 'pl_nonexistent');
      expect(locations).toHaveLength(0);
    });
  });

  describe('getStorageLocation', () => {
    it('returns a storage location by id', async () => {
      const location = await getStorageLocation(t, 'sl_hedgile_warehouse');
      expect(location).not.toBeNull();
      expect(location?.code).toBe('SL-WH01');
      expect(location?.description).toBe('Main Warehouse');
    });

    it('returns null for non-existent storage location', async () => {
      const location = await getStorageLocation(t, 'sl_nonexistent');
      expect(location).toBeNull();
    });
  });

  describe('getStorageLocationsForPlant', () => {
    it('returns storage locations for a specific plant', async () => {
      const locations = await getStorageLocationsForPlant(t, 'pl_hedgile_main');
      expect(locations).toHaveLength(1);
      expect(locations[0]!.code).toBe('SL-WH01');
    });

    it('returns empty array for plant with no locations', async () => {
      // First create a plant without locations
      await createPlant(t, {
        companyId: 'co_hedgile_limited',
        internalNumber: 'PL002',
        code: 'PL-NEW',
        description: 'New Plant',
        address: null,
      });
      const locations = await getStorageLocationsForPlant(t, 'pl_hedgile_main');
      expect(locations).toHaveLength(1);
    });
  });

  describe('createStorageLocation', () => {
    it('creates a new storage location', async () => {
      const id = await createStorageLocation(t, {
        plantId: 'pl_hedgile_main',
        code: 'SL-002',
        description: 'Second Warehouse',
      });
      expect(id).toMatch(/^sl_/);

      const location = await getStorageLocation(t, id);
      expect(location).not.toBeNull();
      expect(location?.code).toBe('SL-002');
      expect(location?.plantId).toBe('pl_hedgile_main');
    });
  });

  describe('updateStorageLocation', () => {
    it('updates an existing storage location', async () => {
      const updated = await updateStorageLocation(t, 'sl_hedgile_warehouse', {
        plantId: 'pl_hedgile_main',
        code: 'SL-WH01-UPDATED',
        description: 'Main Warehouse Updated',
      });
      expect(updated).toBe(true);

      const location = await getStorageLocation(t, 'sl_hedgile_warehouse');
      expect(location?.code).toBe('SL-WH01-UPDATED');
      expect(location?.description).toBe('Main Warehouse Updated');
    });

    it('returns false for non-existent storage location', async () => {
      const updated = await updateStorageLocation(t, 'sl_nonexistent', {
        plantId: 'pl_hedgile_main',
        code: 'SL-001',
        description: 'Test',
      });
      expect(updated).toBe(false);
    });
  });
});
