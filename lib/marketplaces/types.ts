export type Marketplace = "shopee" | "mercado_livre" | "amazon" | "magalu" | "tiktok_shop";

export type ScoreDimension = {
  score: number;
  weight: number;
  issues: string[];
  wins: string[];
};

export type ListingScore = {
  total: number;
  title: ScoreDimension;
  attributes: ScoreDimension;
  description: ScoreDimension;
  media: ScoreDimension;
  offer: ScoreDimension;
  trust: ScoreDimension;
  completeness: ScoreDimension;
  blockers: string[];
  recommendations: string[];
};

export type ListingDraft = {
  marketplace: Marketplace;
  title: string;
  categoryId?: string;
  description: string;
  keywords: string[];
  attributes: Record<string, unknown>;
  imageCount: number;
  hasVideo: boolean;
  price?: number;
  stock?: number;
  sku?: string;
  ean?: string;
  weightKg?: number;
  dimensions?: { widthCm?: number; heightCm?: number; lengthCm?: number };
};
