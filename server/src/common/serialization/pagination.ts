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
