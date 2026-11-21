import { describe, it, expect } from 'vitest';
import {
  createId,
  generateId,
  type Trade,
  type TradeStatus,
  type Valuation,
  type Position,
  type CreateTradeInput,
  type UpdateTradeInput,
} from './trade.js';

describe('Trade Types', () => {
  describe('createId', () => {
    it('should create a typed ID from a string', () => {
      const id = createId('test-123');
      expect(id).toBe('test-123');
      expect(typeof id).toBe('string');
    });
  });

  describe('generateId', () => {
    it('should generate a unique ID each time', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('should generate a valid UUID v4 format', () => {
      const id = generateId();
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      // where x is any hex digit and y is one of 8, 9, A, or B
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(id).toMatch(uuidPattern);
    });
  });

  describe('Trade interface', () => {
    it('should allow creating a valid trade object', () => {
      const trade: Trade = {
        id: createId('trade-1'),
        type: 'buy',
        quantity: 100,
        price: 25000,
        tradeDate: '2024-01-15',
        settlementDate: '2024-02-15',
        contractId: 'CONTRACT-001',
        counterparty: 'Metals Co',
        status: 'confirmed',
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      };

      expect(trade.type).toBe('buy');
      expect(trade.quantity).toBe(100);
      expect(trade.price).toBe(25000);
    });

    it('should allow all trade statuses', () => {
      const statuses: TradeStatus[] = ['pending', 'confirmed', 'settled', 'cancelled', 'invoiced'];
      statuses.forEach((status) => {
        const trade: Trade = {
          id: createId('trade-1'),
          type: 'sell',
          quantity: 50,
          price: 26000,
          tradeDate: '2024-01-15',
          settlementDate: '2024-02-15',
          contractId: 'CONTRACT-002',
          counterparty: 'Trading Inc',
          status,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
        };
        expect(trade.status).toBe(status);
      });
    });
  });

  describe('Valuation interface', () => {
    it('should allow creating a valid valuation object', () => {
      const valuation: Valuation = {
        id: createId('valuation-1'),
        valuationDate: '2024-01-15',
        marketValue: 2500000,
        unrealizedPnL: 50000,
        realizedPnL: 25000,
        totalPnL: 75000,
        currency: 'USD',
      };

      expect(valuation.marketValue).toBe(2500000);
      expect(valuation.totalPnL).toBe(75000);
    });
  });

  describe('Position interface', () => {
    it('should allow creating a valid position object', () => {
      const position: Position = {
        date: '2024-01-15',
        boughtQuantity: 100,
        soldQuantity: 50,
        netPosition: 50,
        averageBuyPrice: 25000,
        averageSellPrice: 26000,
      };

      expect(position.netPosition).toBe(50);
    });

    it('should allow null for average prices when no trades', () => {
      const position: Position = {
        date: '2024-01-15',
        boughtQuantity: 0,
        soldQuantity: 0,
        netPosition: 0,
        averageBuyPrice: null,
        averageSellPrice: null,
      };

      expect(position.averageBuyPrice).toBeNull();
      expect(position.averageSellPrice).toBeNull();
    });
  });

  describe('CreateTradeInput interface', () => {
    it('should allow creating a valid trade input', () => {
      const input: CreateTradeInput = {
        type: 'buy',
        quantity: 100,
        price: 25000,
        tradeDate: '2024-01-15',
        settlementDate: '2024-02-15',
        contractId: 'CONTRACT-001',
        counterparty: 'Metals Co',
      };

      expect(input.type).toBe('buy');
      expect(input.contractId).toBe('CONTRACT-001');
    });
  });

  describe('UpdateTradeInput interface', () => {
    it('should allow partial updates', () => {
      const input: UpdateTradeInput = {
        id: createId('trade-1'),
        quantity: 150,
        status: 'confirmed',
      };

      expect(input.id).toBe('trade-1');
      expect(input.quantity).toBe(150);
      expect(input.status).toBe('confirmed');
    });
  });
});
