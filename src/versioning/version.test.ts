import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatVersionLabel, getAppVersion } from './version';

afterEach(() => vi.unstubAllGlobals());

describe('version label', () => {
  it('shows version and commit', () => {
    expect(formatVersionLabel({ version: '0.2.0', commit: 'abc1234' })).toBe('v0.2.0 · abc1234');
  });

  it('drops an unknown commit', () => {
    expect(formatVersionLabel({ version: '0.2.0', commit: 'dev' })).toBe('v0.2.0');
  });

  it('falls back when the build did not inject values', () => {
    expect(getAppVersion()).toEqual({ version: '0.0.0-dev', commit: 'dev' });
  });

  it('uses the injected values', () => {
    vi.stubGlobal('__APP_VERSION__', '0.2.0');
    vi.stubGlobal('__APP_COMMIT__', 'abc1234');
    expect(getAppVersion()).toEqual({ version: '0.2.0', commit: 'abc1234' });
  });
});
