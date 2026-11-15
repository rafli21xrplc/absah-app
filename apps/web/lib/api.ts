import { ErrorBody, HealthResponse } from '@absah/contracts';
import type { z } from 'zod';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ErrorBody,
  ) {
    super(body.message);
  }
}

/** Fetches a JSON endpoint and validates the response with its contract from absah-api. */
export async function apiGet<S extends z.ZodType>(
  path: string,
  schema: S,
  init?: RequestInit & { baseUrl?: string },
): Promise<z.infer<S>> {
  const res = await fetch(`${init?.baseUrl ?? ''}/api/v1${path}`, { ...init, headers: { accept: 'application/json', ...init?.headers } });
  const json: unknown = await res.json();
  if (!res.ok) throw new ApiError(res.status, ErrorBody.parse(json));
  return schema.parse(json);
}

export const getHealth = (baseUrl?: string) => apiGet('/health', HealthResponse, baseUrl ? { baseUrl } : undefined);
