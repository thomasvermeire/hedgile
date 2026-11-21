import { describe, expect, it } from 'vitest';
import { constantTimeStringEqual, hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('verifies the right password and refuses a wrong one', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(stored).toMatch(/^pbkdf2\$100000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(await verifyPassword('correct horse battery', stored)).toBe(true);
    expect(await verifyPassword('correct horse batterz', stored)).toBe(false);
  });

  it('salts every hash differently', async () => {
    expect(await hashPassword('same password')).not.toBe(await hashPassword('same password'));
  });

  it('refuses a stored value it does not recognise', async () => {
    expect(await verifyPassword('x', 'plain-text')).toBe(false);
    expect(await verifyPassword('x', 'md5$1$a$b')).toBe(false);
  });

  it('compares strings exactly', () => {
    expect(constantTimeStringEqual('abc', 'abc')).toBe(true);
    expect(constantTimeStringEqual('abc', 'abd')).toBe(false);
    expect(constantTimeStringEqual('abc', 'abcd')).toBe(false);
  });
});
