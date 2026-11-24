import { ErrorBody, HealthResponse } from '@absah/contracts';
import type { z } from 'zod';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ErrorBody,
  ) {
    super(body.message);
  }

  get code() {
    return this.body.code;
  }
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Active school (X-School-Id). */
  schoolId?: string | null;
  /** Idempotency-Key: one per user action, reused when the same action is retried. */
  idempotencyKey?: string;
  /** Action link token (ORT-01), sent as `Authorization: Link <token>` instead of a session. */
  linkToken?: string;
  baseUrl?: string;
  signal?: AbortSignal;
  /** Send no cookies at all (anonymous TPPK report): the request carries nothing about who sent it. */
  anonymous?: boolean;
}

/** Calls /api/v1 and validates the response with its contract from absah-api. */
export async function api<S extends z.ZodType>(path: string, schema: S, options: ApiOptions = {}): Promise<z.infer<S>> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.schoolId) headers['x-school-id'] = options.schoolId;
  if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey;
  if (options.linkToken) headers.authorization = `Link ${options.linkToken}`;
  const res = await fetch(`${options.baseUrl ?? ''}/api/v1${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    // A link page has no session to send; leaving cookies out keeps the link the only credential.
    credentials: options.linkToken || options.anonymous ? 'omit' : 'same-origin',
    signal: options.signal,
  });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = ErrorBody.safeParse(json);
    throw new ApiError(
      res.status,
      parsed.success ? parsed.data : { code: 'INTERNAL', message: 'Terjadi kesalahan. Coba lagi.', requestId: '' },
    );
  }
  return schema.parse(json);
}

/** Kept for existing callers: GET with a contract. */
export function apiGet<S extends z.ZodType>(path: string, schema: S, init?: { baseUrl?: string }): Promise<z.infer<S>> {
  return api(path, schema, { baseUrl: init?.baseUrl });
}

export const getHealth = (baseUrl?: string) => apiGet('/health', HealthResponse, baseUrl ? { baseUrl } : undefined);

/** A fresh Idempotency-Key for one user action. */
export const newIdempotencyKey = () => crypto.randomUUID();

/** First validation message for a field path, for inline form errors. */
export function fieldError(err: unknown, path: string): string | undefined {
  if (!(err instanceof ApiError) || !Array.isArray(err.body.details)) return undefined;
  const hit = (err.body.details as { path?: unknown; message?: unknown }[]).find((d) => d.path === path);
  return typeof hit?.message === 'string' ? hit.message : undefined;
}
