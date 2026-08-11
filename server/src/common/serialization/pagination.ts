/**
 * Matches the mobile app's PaginatedResponse<T> (lib/types.ts) exactly.
 * NOTE: only some endpoints use this wrapper (/categories/:id/products,
 * /products/search). Others return bare arrays — do not wrap those.
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  hasMore: boolean;
}

export function buildPaginated<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  return {
    items,
    total,
    page,
    hasMore: page * limit < total,
  };
}

/**
 * Upper bound for a single page. Guards against a caller asking for the whole
 * table in one request; paginate instead (see `hasMore`).
 */
export const MAX_PAGE_SIZE = 200;

/** Coerces an untrusted `limit` query param into [1, MAX_PAGE_SIZE]. */
export function clampLimit(limit: number, fallback: number): number {
  const n = Number(limit);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), MAX_PAGE_SIZE);
}

/**
 * PostgREST truncates every response at its `max-rows` setting — 1000 on
 * Supabase — and a wider `.range()` does NOT lift it (verified: a 2036-row
 * table returns 1000 for both an un-ranged select and `.range(0, 99999)`).
 * The only way past it is to page in chunks of this size.
 */
export const PGREST_MAX_ROWS = 1000;

/**
 * Reads every row a query matches, chunk by chunk, defeating the `max-rows`
 * truncation above. Use for aggregates and exports — anything whose correctness
 * depends on seeing the whole table rather than a page of it.
 *
 * `queryPage` must rebuild the query per call (filters included) and MUST apply
 * a deterministic total order; without one, rows can repeat or vanish across
 * chunk boundaries. Order by a unique column, or add one as a tiebreaker.
 */
export async function fetchAllRows<T>(
  queryPage: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PGREST_MAX_ROWS) {
    const { data } = await queryPage(from, from + PGREST_MAX_ROWS - 1);
    const batch = data ?? [];
    all.push(...batch);
    if (batch.length < PGREST_MAX_ROWS) return all;
  }
}

/** Converts a 1-based page + limit into a Postgres range [from, to]. */
export function pageRange(
  page: number,
  limit: number,
): { from: number; to: number } {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, limit);
  const from = (safePage - 1) * safeLimit;
  return { from, to: from + safeLimit - 1 };
}
