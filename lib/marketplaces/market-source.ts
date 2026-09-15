export type MarketObservation = {
  marketplace: string;
  title: string;
  url: string;
  price: number | null;
  category?: string | null;
  attributes?: Record<string, string | number | boolean | null>;
  observedAt: string;
  source: string;
};

export type MarketResearchRequest = {
  marketplace: string;
  searchTerms: string[];
  productName: string;
  brand?: string | null;
  model?: string | null;
};

export type MarketResearchResult = {
  observations: MarketObservation[];
  sourceName: string;
  collectedAt: string;
  warnings: string[];
};

/**
 * Contract for runtime market research providers.
 * Implementations must return traceable public observations. They must not
 * synthesize sales, rankings, reviews, prices or category evidence.
 */
export interface MarketResearchSource {
  name: string;
  search(request: MarketResearchRequest): Promise<MarketResearchResult>;
}

export function validateMarketObservation(value: MarketObservation) {
  if (!value.title.trim()) throw new Error("Market observation requires a title.");
  if (!/^https?:\/\//i.test(value.url)) throw new Error("Market observation requires a public URL.");
  if (value.price != null && (!Number.isFinite(value.price) || value.price <= 0)) throw new Error("Observed price must be positive.");
  if (!value.observedAt) throw new Error("Market observation requires collection date.");
  if (!value.source.trim()) throw new Error("Market observation requires a source identifier.");
  return value;
}
