import type { QuoteRequest } from "../../lib/types";

export interface CreateQuotePayload {
  productId: string;
  dimensions?: { width: number; height: number };
  notes?: string;
  openingType?: string;
  images?: string[];
}

export type QuotesResponse = QuoteRequest[];
