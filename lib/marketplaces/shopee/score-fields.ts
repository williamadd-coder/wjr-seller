import type { ListingScore } from "@/lib/marketplaces/types";

/** Single source of truth for how a score maps onto the listings columns. */
export function scoreFields(score: ListingScore) {
  return {
    listing_score: score.total,
    conversion_score: score.total,
    seo_score: Math.round((score.title.score + score.attributes.score + score.completeness.score) / 3),
    content_score: Math.round((score.title.score + score.description.score + score.attributes.score) / 3),
    title_score: score.title.score,
    attribute_score: score.attributes.score,
    description_score: score.description.score,
    media_score: score.media.score,
    offer_score: score.offer.score,
    trust_score: score.trust.score,
    completeness_score: score.completeness.score,
    score_breakdown: score,
  };
}
