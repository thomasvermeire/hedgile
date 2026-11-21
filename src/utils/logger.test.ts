import { describe, it, expect, vi, afterEach } from 'vitest';
import { createLogger } from './logger.js';

describe('createLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes entries at and above its level', () => {
    const out = vi.spyOn(console, 'log').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = createLogger('info');

    logger.info('started', { port: 3000 });
    logger.warn('careful');
    logger.debug('hidden');

    expect(out).toHaveBeenCalledWith('[info] started {"port":3000}');
    expect(err).toHaveBeenCalledWith('[warn] careful');
    expect(out).toHaveBeenCalledTimes(1);
  });

  it('only writes errors at level error', () => {
    const out = vi.spyOn(console, 'log').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = createLogger('error');

    logger.warn('ignored');
    logger.info('ignored');
    logger.error('failed');

    expect(out).not.toHaveBeenCalled();
    expect(err).toHaveBeenCalledTimes(1);
  });

  it('writes everything at level trace', () => {
    const out = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger('trace');

    logger.trace('deep');
    logger.debug('detail');

    expect(out).toHaveBeenCalledTimes(2);
  });
});
