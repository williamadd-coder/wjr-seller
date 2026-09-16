import type { ProductIntelligenceSeed } from "./intelligence";
import { researchShopeePublic, type ResearchOutcome } from "./public-research";
import { researchShopeeIndex, type IndexedResearchOptions } from "./indexed-research";

export async function researchShopeeMarket(seed: ProductIntelligenceSeed, options: {
  direct?: (seed: ProductIntelligenceSeed) => Promise<ResearchOutcome>;
  indexed?: IndexedResearchOptions;
} = {}): Promise<ResearchOutcome> {
  const direct=await (options.direct ?? researchShopeePublic)(seed);
  if (direct.data || direct.attempt.status === "invalid_input") return direct;
  const indexed=await researchShopeeIndex(seed,options.indexed);
  // Keep the actionable direct failure visible when no search provider has been connected yet.
  if (indexed.attempt.status === "provider_not_configured") return {...direct,attempt:{...direct.attempt,diagnostics:[...direct.attempt.diagnostics,{source:"tavily_search",status:"provider_not_configured"}]}};
  return {...indexed,attempt:{...indexed.attempt,queries:[...direct.attempt.queries,...indexed.attempt.queries],diagnostics:[...direct.attempt.diagnostics,...indexed.attempt.diagnostics]}};
}
