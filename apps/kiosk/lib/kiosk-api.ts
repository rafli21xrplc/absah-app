import { ErrorBody, KIOSK_AUTH_SCHEME } from '@absah/contracts';

/** Anything with parse(): the Zod contracts from absah-api. */
interface Contract<T> {
  parse(data: unknown): T;
}

export class KioskApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface KioskCall {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Device token from pairing; absent only for POST /kiosk/pair. */
  token?: string;
  idempotencyKey?: string;
}

export type KioskApi = <T>(path: string, contract: Contract<T>, call?: KioskCall) => Promise<T>;

/**
 * Calls absah-api directly (the kiosk is a static export on its own origin; the API allows it via
 * KIOSK_ORIGINS). No cookies: the device token travels in `Authorization: Kiosk <token>`.
 * A network failure throws a TypeError, which callers treat as "offline".
 */
export function createKioskApi(baseUrl: string): KioskApi {
  return async (path, contract, call = {}) => {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (call.body !== undefined) headers['content-type'] = 'application/json';
    if (call.token) headers.authorization = `${KIOSK_AUTH_SCHEME} ${call.token}`;
    if (call.idempotencyKey) headers['idempotency-key'] = call.idempotencyKey;
    const res = await fetch(`${baseUrl}/api/v1${path}`, {
      method: call.method ?? 'GET',
      headers,
      body: call.body === undefined ? undefined : JSON.stringify(call.body),
      credentials: 'omit',
      cache: 'no-store',
    });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const err = ErrorBody.safeParse(json);
      throw new KioskApiError(res.status, err.success ? err.data.code : 'INTERNAL', err.success ? err.data.message : 'Server bermasalah.');
    }
    return contract.parse(json);
  };
}

export const apiBaseUrl = () => process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
/** 401 means the kiosk was revoked (or its token is wrong): back to pairing. */
export const isRevoked = (err: unknown) => err instanceof KioskApiError && err.status === 401;
