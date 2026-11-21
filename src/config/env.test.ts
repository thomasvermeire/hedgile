import { describe, it, expect } from 'vitest';
import { ConfigError, getConfig } from './env.js';

const valid = { APP_ENV: 'test', SESSION_SECRET: 'x'.repeat(32) };

describe('getConfig', () => {
  it('returns typed settings with defaults', () => {
    const config = getConfig({ ...valid });
    expect(config.LOG_LEVEL).toBe('info');
    expect(config.LAIMON_MODEL).toBe('claude-opus-5-5');
    expect(config.ANTHROPIC_API_KEY).toBeUndefined();
    expect(config.BOOTSTRAP_ADMIN_EMAIL).toBeUndefined();
  });

  it('treats empty optional settings as not set', () => {
    const config = getConfig({
      ...valid,
      ANTHROPIC_API_KEY: '',
      BOOTSTRAP_ADMIN_EMAIL: ' ',
      BOOTSTRAP_ADMIN_PASSWORD: '',
    });
    expect(config.ANTHROPIC_API_KEY).toBeUndefined();
    expect(config.BOOTSTRAP_ADMIN_EMAIL).toBeUndefined();
    expect(config.BOOTSTRAP_ADMIN_PASSWORD).toBeUndefined();
  });

  it('accepts a bootstrap admin', () => {
    const config = getConfig({
      ...valid,
      BOOTSTRAP_ADMIN_EMAIL: 'boss@x.test',
      BOOTSTRAP_ADMIN_PASSWORD: 'long-enough-1',
    });
    expect(config.BOOTSTRAP_ADMIN_EMAIL).toBe('boss@x.test');
  });

  it('caches per env object', () => {
    const env = { ...valid };
    expect(getConfig(env)).toBe(getConfig(env));
  });

  it('names every invalid setting', () => {
    try {
      getConfig({
        SESSION_SECRET: 'short',
        BOOTSTRAP_ADMIN_EMAIL: 'not an email',
        BOOTSTRAP_ADMIN_PASSWORD: 'short',
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const settings = (error as ConfigError).problems.map((p) => p.setting).sort();
      expect(settings).toEqual([
        'BOOTSTRAP_ADMIN_EMAIL',
        'BOOTSTRAP_ADMIN_PASSWORD',
        'SESSION_SECRET',
      ]);
    }
  });
});
