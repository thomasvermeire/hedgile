import { describe, it, expect } from 'vitest';
import { ConfigError, getConfig } from './env.js';

const valid = {
  APP_ENV: 'test',
  LAIMONID_ISSUER: 'https://id.example.com',
  LAIMONID_CLIENT_ID: 'hedgile',
  LAIMONID_CLIENT_SECRET: 'secret',
  SESSION_SECRET: 'x'.repeat(32),
};

describe('getConfig', () => {
  it('returns typed settings with defaults', () => {
    const config = getConfig({ ...valid, BOOTSTRAP_ADMIN_EMAILS: ' A@x.com, b@y.com ,' });
    expect(config.LOG_LEVEL).toBe('info');
    expect(config.LAIMON_MODEL).toBe('claude-opus-5-5');
    expect(config.BOOTSTRAP_ADMIN_EMAILS).toEqual(['a@x.com', 'b@y.com']);
    expect(config.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it('treats an empty Anthropic key as no key', () => {
    expect(getConfig({ ...valid, ANTHROPIC_API_KEY: '' }).ANTHROPIC_API_KEY).toBeUndefined();
  });

  it('caches per env object', () => {
    const env = { ...valid };
    expect(getConfig(env)).toBe(getConfig(env));
  });

  it('names every invalid setting', () => {
    try {
      getConfig({ ...valid, SESSION_SECRET: 'short', LAIMONID_ISSUER: 'not a url' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const settings = (error as ConfigError).problems.map((p) => p.setting).sort();
      expect(settings).toEqual(['LAIMONID_ISSUER', 'SESSION_SECRET']);
    }
  });

  it('refuses a missing LaimonID client', () => {
    const { LAIMONID_CLIENT_ID: _omit, ...rest } = valid;
    expect(() => getConfig(rest)).toThrow(ConfigError);
  });
});
