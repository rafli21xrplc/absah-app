import type { SyncSessionResult } from '@absah/contracts';
import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { isTransient, memoryStore, queuedId, savedLabel, type QueuedSession } from './offline-queue';
import { describeResult, syncPending } from './sync-sessions';

const USER = '0196a000-0000-7000-8000-000000000001';
const item = (n: number, over: Partial<QueuedSession> = {}): QueuedSession => ({
  id: queuedId(USER, `s${n}`),
  userId: USER,
  schoolId: 'sch',
  sessionId: `s${n}`,
  title: `Sesi ${n}`,
  exceptions: [{ enrollmentId: 'e1', status: 'A' }],
  capturedAt: `2026-11-23T00:0${n}:00.000Z`,
  idempotencyKey: `key-${n}`,
  ...over,
});
const result = (outcome: SyncSessionResult['outcome'], corrections = 0): SyncSessionResult => ({ outcome, session: null, corrections: Array.from({ length: corrections }, () => ({}) as never), skipped: 0 });
const apiError = (status: number, message = 'x') => new ApiError(status, { code: 'INTERNAL', message, requestId: '' });

describe('syncPending (PRS-08)', () => {
  it('sends oldest first and removes each session only after the API answered', async () => {
    const store = memoryStore();
    await store.enqueue(item(2));
    await store.enqueue(item(1));
    const order: string[] = [];
    const out = await syncPending(store, USER, (i) => {
      order.push(i.sessionId);
      return Promise.resolve(result(i.sessionId === 's1' ? 'submitted' : 'correction_requested', 2));
    });
    expect(order).toEqual(['s1', 's2']);
    expect(out.map((o) => o.kind)).toEqual(['submitted', 'correction_requested']);
    expect(out[1]?.text).toContain('2 perubahan diajukan sebagai koreksi');
    expect(await store.queue(USER)).toEqual([]);
  });

  it('stops at the first missing signal and keeps the rest, with the same key for the next try', async () => {
    const store = memoryStore();
    await store.enqueue(item(1));
    await store.enqueue(item(2));
    const keys: string[] = [];
    let calls = 0;
    const flaky = (i: QueuedSession) => {
      keys.push(i.idempotencyKey);
      calls += 1;
      return calls === 1 ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve(result('submitted'));
    };
    expect(await syncPending(store, USER, flaky)).toEqual([]);
    expect((await store.queue(USER)).length).toBe(2);
    expect((await syncPending(store, USER, flaky)).length).toBe(2);
    expect(keys).toEqual(['key-1', 'key-1', 'key-2']);
  });

  it('drops a session the API refuses and says why; keeps one that hit a gateway error', async () => {
    const store = memoryStore();
    await store.enqueue(item(1));
    await store.enqueue(item(2));
    const out = await syncPending(store, USER, (i) => Promise.reject(i.sessionId === 's1' ? apiError(404, 'Sesi tidak ditemukan.') : apiError(503)));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'rejected', sessionId: 's1' });
    expect(out[0]?.text).toContain('Sesi tidak ditemukan.');
    expect((await store.queue(USER)).map((i) => i.sessionId)).toEqual(['s2']);
  });

  it('keeps everything when signed out (401) and never sends another user’s sessions', async () => {
    const store = memoryStore();
    await store.enqueue(item(1));
    await store.enqueue(item(2, { id: queuedId('someone-else', 's2'), userId: 'someone-else' }));
    const sent: string[] = [];
    await syncPending(store, USER, (i) => {
      sent.push(i.id);
      return Promise.reject(apiError(401));
    });
    expect(sent).toEqual([queuedId(USER, 's1')]);
    expect((await store.queue(USER)).length).toBe(1);
    expect((await store.queue('someone-else')).length).toBe(1);
  });

  it('a session filled again replaces the earlier entry', async () => {
    const store = memoryStore();
    await store.enqueue(item(1));
    await store.enqueue(item(1, { exceptions: [], idempotencyKey: 'key-new' }));
    const queued = await store.queue(USER);
    expect(queued).toHaveLength(1);
    expect(queued[0]?.idempotencyKey).toBe('key-new');
  });
});

describe('helpers', () => {
  it('tells transient failures from answers', () => {
    expect(isTransient(new TypeError('Failed to fetch'))).toBe(true);
    for (const s of [408, 429, 502, 503, 504]) expect(isTransient(apiError(s))).toBe(true);
    for (const s of [400, 401, 403, 404, 409, 422, 500]) expect(isTransient(apiError(s))).toBe(false);
    expect(isTransient(new Error('boom'))).toBe(false);
  });

  it('describes the three answers', () => {
    expect(describeResult('VII A', result('unchanged')).kind).toBe('unchanged');
    expect(describeResult('VII A', result('submitted')).text).toBe('VII A: presensi terkirim.');
  });

  it('prints the saved time on the school clock', () => {
    expect(savedLabel('2026-11-23T00:41:00.000Z', 'Asia/Jakarta')).toBe('07.41');
    expect(savedLabel('2026-11-23T00:41:00.000Z', 'Asia/Jayapura')).toBe('09.41');
  });

  it('memory store keeps copies until they are cleared', async () => {
    const store = memoryStore();
    await store.keep('k', { a: 1 }, '2026-11-23T00:00:00.000Z');
    expect(await store.cached('k')).toEqual({ value: { a: 1 }, savedAt: '2026-11-23T00:00:00.000Z' });
    await store.clearCached();
    expect(await store.cached('k')).toBeNull();
  });
});
