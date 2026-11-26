/**
 * The data handle every repository takes (§12: all data access in `src/db/*Repository.ts`), and how a failed
 * call becomes something the user can read. Type-only towards Supabase, so the Node tests can import the
 * repositories' pure parts; the client itself is made in `@/db/supabase` (app only).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/db/database.types';
import { DomainError } from '@/db/errors';

export type Db = SupabaseClient<Database>;

/** What a supabase-js call resolves to, as far as `must` needs it. */
interface Result<T> {
  data: T;
  error: { message: string; code?: string; status?: number } | null;
  status?: number;
}

/**
 * True when the call never reached the database: no connection, the project is paused or down (§5:
 * "Can't reach your data"), as opposed to the database refusing something.
 */
export function isConnectionFailure(error: { message?: string; code?: string } | null | undefined, status?: number): boolean {
  if (!error) return false;
  if (error.code && /^[0-9A-Z]{5}$/.test(error.code)) return false; // a Postgres error: the database answered
  if (status !== undefined && (status === 0 || status >= 500)) return true;
  return /network|fetch|timed? ?out|failed to connect|load failed/i.test(error.message ?? '');
}

/** Session gone (expired, revoked or signed out elsewhere): the app goes back to sign-in. */
export function isSignedOutFailure(error: { message?: string; code?: string } | null | undefined, status?: number): boolean {
  if (!error) return false;
  return status === 401 || error.code === 'PGRST301' || error.code === 'PGRST303' || /jwt expired|invalid jwt/i.test(error.message ?? '');
}

/** The data of a supabase-js call, or a readable error: `connection`, `auth.signedOut`, else the raw one. */
export function must<T>(result: Result<T>): T {
  const { error, status } = result;
  if (!error) return result.data;
  if (isConnectionFailure(error, status)) throw new DomainError('connection');
  if (isSignedOutFailure(error, status)) throw new DomainError('auth.signedOut');
  throw Object.assign(new Error(error.message), { code: error.code });
}

/**
 * Whether `v` can be a row id (a UUID). A route parameter or a stored value that isn't one would make Postgres
 * refuse the query (22P02); the repositories answer "not found" instead.
 */
export const isId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** Postgres' unique violation (a dedupe key, an active name taken). */
export const isUniqueViolation = (error: { code?: string } | null | undefined) => error?.code === '23505';

/** Timestamps come back as `…+00:00`; the app keeps `toISOString()` form so lexical order is time order (§3). */
export const iso = (v: string): string => new Date(v).toISOString();
export const isoOrNull = (v: string | null): string | null => (v === null ? null : iso(v));

/** PostgREST returns at most this many rows per request (Supabase's default `max_rows`). */
export const PAGE_SIZE = 1000;

/**
 * Reads every page of a query: `page(from, to)` runs the same query with `.range(from, to)`. Supabase caps a
 * response at 1000 rows, and a year of transactions can be more.
 */
export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<Result<T[] | null>>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const rows = must(await page(from, from + PAGE_SIZE - 1)) ?? [];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) return out;
  }
}
