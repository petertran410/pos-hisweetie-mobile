import { describe, expect, it } from '@jest/globals';
import { base64url, toBase64url } from '../base64';

describe('base64url', () => {
  it('encodes 16 random bytes into a 22-char device id', () => {
    const id = base64url(new Uint8Array(16).fill(255));
    expect(id).toHaveLength(22);
    expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it('matches the RFC 4648 test vectors (no padding)', () => {
    const enc = (s: string) => base64url(new TextEncoder().encode(s));
    expect(enc('f')).toBe('Zg');
    expect(enc('fo')).toBe('Zm8');
    expect(enc('foo')).toBe('Zm9v');
    expect(enc('foobar')).toBe('Zm9vYmFy');
  });

  it('converts base64 to base64url for PKCE challenges', () => {
    expect(toBase64url('ab+/cd==')).toBe('ab-_cd');
  });
});
