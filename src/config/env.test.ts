import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { envSchema, validateEnv } from './env.js';

describe('Environment Configuration', () => {
  describe('envSchema', () => {
    it('should validate development environment', () => {
      const result = envSchema.parse({
        NODE_ENV: 'development',
        PORT: 3000,
        LOG_LEVEL: 'debug',
      });

      expect(result.NODE_ENV).toBe('development');
      expect(result.PORT).toBe(3000);
      expect(result.LOG_LEVEL).toBe('debug');
    });

    it('should validate production environment with defaults', () => {
      const result = envSchema.parse({
        NODE_ENV: 'production',
      });

      expect(result.NODE_ENV).toBe('production');
      expect(result.PORT).toBe(3000);
      expect(result.LOG_LEVEL).toBe('info');
    });

    it('should coerce PORT from string to number', () => {
      const result = envSchema.parse({
        PORT: '8080',
      });

      expect(result.PORT).toBe(8080);
    });

    it('should reject invalid NODE_ENV', () => {
      expect(() =>
        envSchema.parse({
          NODE_ENV: 'invalid',
        })
      ).toThrow();
    });

    it('should reject negative PORT', () => {
      expect(() =>
        envSchema.parse({
          PORT: -1,
        })
      ).toThrow();
    });

    it('should reject invalid LOG_LEVEL', () => {
      expect(() =>
        envSchema.parse({
          LOG_LEVEL: 'invalid',
        })
      ).toThrow();
    });
  });

  describe('validateEnv', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalEnv = process.env;
      process.env = {};
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should validate current environment', () => {
      process.env.NODE_ENV = 'test';
      process.env.PORT = '4000';
      process.env.LOG_LEVEL = 'warn';

      const result = validateEnv();

      expect(result.NODE_ENV).toBe('test');
      expect(result.PORT).toBe(4000);
      expect(result.LOG_LEVEL).toBe('warn');
    });

    it('should use defaults when variables are not set', () => {
      const result = validateEnv();

      expect(result.NODE_ENV).toBe('development');
      expect(result.PORT).toBe(3000);
      expect(result.LOG_LEVEL).toBe('info');
    });

    it('should throw when required validation fails', () => {
      process.env.PORT = '-1';

      expect(() => validateEnv()).toThrow();
    });
  });
});
