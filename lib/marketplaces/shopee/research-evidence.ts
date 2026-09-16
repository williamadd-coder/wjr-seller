import type { ResearchOutcome } from "./public-research";

/** Keep failed attempts out of market_analyses so pricing keeps the last valid evidence. */
export async function saveResearchEvidence(supabase: any, productId: string, outcome: ResearchOutcome): Promise<ResearchOutcome> {
  if (!outcome.data) return outcome;
  const data = outcome.data;
  const result = await supabase.from("market_analyses").insert({
    product_id: productId, marketplace: "shopee", competitors: data.competitors,
    price_min: data.priceMin, price_median: data.priceMedian, price_max: data.priceMax,
    rationale: `${data.source === "shopee_indexed_tavily" ? "Pesquisa em índice externo; preços atuais não verificados." : "Pesquisa pública direta."} Amostra com ${data.competitors.length} anúncio(s) comparável(is) e ${outcome.attempt.pricedCount} preço(s) observado(s).`,
    source: data.source, search_terms: data.searchTerms,
    competitor_patterns: { sample_size: data.competitors.length, priced_sample_size: outcome.attempt.pricedCount, found_count: outcome.attempt.foundCount, category: data.category, category_id: data.categoryId, research_attempt: outcome.attempt },
    conversion_insights: [],
  }).select("id").single();
  if (result.error || !result.data?.id) {
    // Never claim success or use unsaved observations to change the recommendation.
    console.error("shopee_research_save_failed", { code: result.error?.code ?? "NO_INSERTED_ROW" });
    return { data:null, attempt:{ ...outcome.attempt, status:"save_failed" } };
  }
  return outcome;
}
