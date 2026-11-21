import { describe, expect, it } from 'vitest';
import { otherPushSchools, pushAvailability, pushFlagKey, subscribeBody, urlBase64ToBytes, type PushEnv } from './push';

const env = (over: Partial<PushEnv> = {}): PushEnv => ({ hasServiceWorker: true, hasPushManager: true, hasNotification: true, permission: 'default', publicKey: 'BKey', ...over });

describe('pushAvailability', () => {
  it('is ready when the browser can and the server allows', () => {
    expect(pushAvailability(env())).toBe('ready');
    expect(pushAvailability(env({ permission: 'granted' }))).toBe('ready');
  });

  it('names the first thing in the way', () => {
    expect(pushAvailability(env({ hasPushManager: false }))).toBe('unsupported');
    expect(pushAvailability(env({ hasNotification: false, permission: null }))).toBe('unsupported');
    expect(pushAvailability(env({ publicKey: null }))).toBe('off');
    expect(pushAvailability(env({ permission: 'denied' }))).toBe('denied');
    // An unsupported browser is unsupported even if the server is off.
    expect(pushAvailability(env({ hasServiceWorker: false, publicKey: null }))).toBe('unsupported');
  });
});

describe('urlBase64ToBytes', () => {
  it('decodes base64url without padding', () => {
    expect([...urlBase64ToBytes('AQID')]).toEqual([1, 2, 3]);
    expect([...urlBase64ToBytes('-_8')]).toEqual([251, 255]);
  });
});

describe('subscribeBody', () => {
  const keys = { p256dh: Buffer.alloc(65, 3).toString('base64url'), auth: Buffer.alloc(16, 3).toString('base64url') };

  it('passes a complete subscription', () => {
    expect(subscribeBody({ endpoint: 'https://push.example.test/abc', keys })).toEqual({ endpoint: 'https://push.example.test/abc', keys });
  });

  it('refuses one the API would refuse', () => {
    expect(subscribeBody({ endpoint: 'https://push.example.test/abc' })).toBeNull();
    expect(subscribeBody({ endpoint: 'http://push.example.test/abc', keys })).toBeNull();
    expect(subscribeBody({ keys })).toBeNull();
  });
});

describe('otherPushSchools', () => {
  const storage = (keys: string[]) => ({ length: keys.length, key: (i: number) => keys[i] ?? null });

  it('lists the other schools this browser is registered for, not this one or unrelated keys', () => {
    const s = storage([pushFlagKey('a'), pushFlagKey('b'), 'absah.schoolId', pushFlagKey('c')]);
    expect(otherPushSchools(s, 'b')).toEqual(['a', 'c']);
    expect(otherPushSchools(storage([pushFlagKey('a')]), 'a')).toEqual([]);
  });
});
