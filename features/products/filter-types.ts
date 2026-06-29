export type SortKey = "popular" | "recent" | "price_asc" | "price_desc";

export interface FilterState {
  sort: SortKey;
  /** 0 means "unset" → treat as the lower price bound (full range). */
  minPrice: number;
  /** 0 means "unset" → treat as the upper price bound (full range). */
  maxPrice: number;
  /** Minimum average rating; 0 = all. */
  minRating: number;
}

export const DEFAULT_FILTERS: FilterState = {
  sort: "popular",
  minPrice: 0,
  maxPrice: 0,
  minRating: 0,
};

export function isPriceActive(f: FilterState): boolean {
  return f.minPrice > 0 || f.maxPrice > 0;
}

export function isNonDefault(f: FilterState): boolean {
  return f.sort !== "popular" || f.minRating > 0 || isPriceActive(f);
}
