import { buildShopeeSearchTerms, type ProductIntelligenceSeed } from "./intelligence";
import type { PublicCompetitor, ResearchOutcome } from "./public-research";

export type IndexedResearchOptions = { apiKey?: string; fetcher?: typeof fetch; timeoutMs?: number };
// Only canonical Shopee product URLs are evidence; search/category/short links are excluded.
export function shopeeProductUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !["shopee.com.br", "www.shopee.com.br"].includes(url.hostname) || url.username || url.password || url.port) return null;
    const match = url.pathname.match(/^\/product\/(\d+)\/(\d+)\/?$/) ?? url.pathname.match(/-i\.(\d+)\.(\d+)\/?$/);
    if (!match) return null;
    const shopId = Number(match[1]), itemId = Number(match[2]);
    if (![shopId,itemId].every(n => Number.isSafeInteger(n) && n > 0)) return null;
    return { shopId,itemId,url:`https://shopee.com.br/product/${shopId}/${itemId}` };
  } catch { return null; }
}

// An index excerpt is not a live offer. Keep any unambiguous price separately from live prices.
export function indexedPrice(content: string): { value: number; evidence: string } | null {
  const text=content.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
  if (/(?:\b\d+\s*x\b|parcela|frete|cupom|desconto|economize|a partir|por m[eê]s)/i.test(text)) return null;
  const matches=[...text.matchAll(/R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})(?!\d)/g)];
  if (matches.length !== 1) return null;
  const value=Number(matches[0][1].replace(/\./g,"").replace(",","."));
  if (!Number.isFinite(value) || value<=0) return null;
  const pos=matches[0].index ?? 0;
  return {value,evidence:text.slice(Math.max(0,pos-80),Math.min(text.length,pos+matches[0][0].length+80))};
}

export async function researchShopeeIndex(seed: ProductIntelligenceSeed, options: IndexedResearchOptions = {}): Promise<ResearchOutcome> {
  const apiKey=options.apiKey ?? process.env.TAVILY_API_KEY;
  const terms=buildShopeeSearchTerms(seed);
  const query=`site:shopee.com.br ${terms.join(" ")}`;
  const attempt: ResearchOutcome["attempt"]={status:"provider_not_configured",checkedAt:new Date().toISOString(),queries:[query],foundCount:0,comparableCount:0,pricedCount:0,diagnostics:[]};
  if (!apiKey?.trim()) return {attempt,data:null};
  if (!terms.length) return {attempt:{...attempt,status:"invalid_input"},data:null};
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),options.timeoutMs ?? 8000);
  try {
    // One basic query per research attempt; no LLM answer, crawling/extract or auto depth upgrades.
    const response=await (options.fetcher ?? fetch)("https://api.tavily.com/search",{
      method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${apiKey}`},
      body:JSON.stringify({query,topic:"general",search_depth:"basic",max_results:8,include_domains:["shopee.com.br"],include_answer:false,include_raw_content:false,include_images:false,auto_parameters:false}),
      signal:controller.signal,cache:"no-store",redirect:"error",
    });
    if (!response.ok) {
      attempt.status=[401,403].includes(response.status)?"provider_auth_failed":[429,432,433].includes(response.status)?"provider_limit":"unavailable";
      attempt.diagnostics.push({source:"tavily_search",status:attempt.status,code:`HTTP_${response.status}`});
      return {attempt,data:null};
    }
    const body=await response.json();
    if (!Array.isArray(body?.results)) return {attempt:{...attempt,status:"unavailable",diagnostics:[{source:"tavily_search",status:"unavailable",code:"INVALID_RESPONSE"}]},data:null};
    const target=new Set(buildShopeeSearchTerms({name:seed.name}));
    const unique=new Map<string,PublicCompetitor>();
    const observed=new Set<string>();
    for (const result of body.results) {
      const product=shopeeProductUrl(result?.url);
      if (!product || typeof result.title !== "string") continue;
      observed.add(product.url);
      const title=result.title.replace(/<[^>]*>/g," ").trim().slice(0,300);
      const candidate=new Set(buildShopeeSearchTerms({name:title}));
      const hits=[...target].filter(term=>candidate.has(term)).length;
      if (!target.size || hits/target.size<0.5) continue;
      const price=indexedPrice(typeof result.content === "string" ? result.content : "");
      const offer:PublicCompetitor={...product,title,price:null,category:null,categoryId:null,attributes:{},evidenceSource:"tavily_index",observedAt:attempt.checkedAt,indexedPrice:price?.value ?? null,priceEvidence:price?.evidence ?? null};
      // Conflicting duplicate snippets must not create an arbitrary reference price.
      const existing=unique.get(product.url);
      if (existing && existing.indexedPrice !== offer.indexedPrice) { existing.indexedPrice=null;existing.priceEvidence=null; }
      else if (!existing) unique.set(product.url,offer);
    }
    const competitors=[...unique.values()];
    attempt.foundCount=observed.size;attempt.comparableCount=competitors.length;
    attempt.status=competitors.length?"completed":"no_matches";
    attempt.diagnostics.push({source:"tavily_search",status:"ok"});
    if (!competitors.length) return {attempt,data:null};
    // Indexed prices never populate the live market range used by automatic pricing.
    return {attempt,data:{competitors,priceMin:null,priceMedian:null,priceMax:null,category:null,categoryId:null,attributes:{},searchTerms:terms,source:"shopee_indexed_tavily"}};
  } catch {
    attempt.status=controller.signal.aborted?"timeout":"unavailable";
    attempt.diagnostics.push({source:"tavily_search",status:attempt.status});
    return {attempt,data:null};
  } finally {clearTimeout(timer);}
}
