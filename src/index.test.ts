import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { APP_INFO, initialize, healthCheck, createTradeId } from './index.js';

describe('Hedgile Application', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = {
      NODE_ENV: 'test',
      PORT: '3000',
      LOG_LEVEL: 'info',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('APP_INFO', () => {
    it('should have correct application metadata', () => {
      expect(APP_INFO.name).toBe('Hedgile');
      expect(APP_INFO.version).toBe('0.1.0');
      expect(APP_INFO.description.toLowerCase()).toContain('nickel');
    });
  });

  describe('initialize', () => {
    it('should initialize without throwing when environment is valid', () => {
      expect(() => initialize()).not.toThrow();
    });

    it('should log initialization message', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      initialize();

      expect(consoleSpy).toHaveBeenCalled();
      expect(
        consoleSpy.mock.calls.some((call: unknown[]) =>
          (call as unknown[]).some((arg: unknown) => String(arg).includes('Hedgile'))
        )
      ).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe('healthCheck', () => {
    it('should return health check information', () => {
      const health = healthCheck();

      expect(health).toHaveProperty('status', 'ok');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('name', 'Hedgile');
      expect(health).toHaveProperty('version', '0.1.0');
    });

    it('should return a valid ISO timestamp', () => {
      const health = healthCheck();
      const timestamp = (health as { timestamp: string }).timestamp;

      // Check if it's a valid ISO date string
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });
  });

  describe('createTradeId', () => {
    it('should generate a unique ID each time', () => {
      const id1 = createTradeId();
      const id2 = createTradeId();

      expect(id1).not.toBe(id2);
    });

    it('should generate a valid UUID v4 format', () => {
      const id = createTradeId();
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      expect(id).toMatch(uuidPattern);
    });
  });
});
