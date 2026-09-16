import { buildShopeeSearchTerms, type ProductIntelligenceSeed } from "./intelligence";

export type PublicCompetitor = {
  title: string; url: string; price: number | null; shopId: number; itemId: number;
  categoryId: string | null; category: string | null; attributes: Record<string, string>;
};
export type ResearchStatus = "completed" | "blocked" | "timeout" | "unavailable" | "no_matches" | "invalid_input" | "save_failed";
export type ResearchAttempt = {
  status: ResearchStatus; checkedAt: string; queries: string[]; foundCount: number;
  comparableCount: number; pricedCount: number; diagnostics: { source: string; status: string; code?: string }[];
};
export type ShopeePublicResearch = {
  competitors: PublicCompetitor[]; priceMin: number | null; priceMedian: number | null;
  priceMax: number | null; category: string | null; categoryId: string | null;
  attributes: Record<string, string>; searchTerms: string[]; source: string;
};
export type ResearchOutcome = { attempt: ResearchAttempt; data: ShopeePublicResearch | null };
type Row = Record<string, any>;
type SearchResult = { rows: Row[]; source: string; status: "ok" | "blocked" | "timeout" | "unavailable"; code?: string };
const headers = { "user-agent": "WJR-Seller/1.0", accept: "application/json", "accept-language": "pt-BR" };
const words = (s: string) => new Set(buildShopeeSearchTerms({ name: s }));
const overlap = (target: Set<string>, title: string) => {
  const candidate = words(title);
  return target.size ? [...target].filter(w => candidate.has(w)).length / target.size : 0;
};
const id = (v: unknown) => Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : null;
// Shopee API/hydration prices always use units of 1/100000 BRL, including prices <= R$ 1.
export function shopeeMoney(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n / 100000 : null;
}

async function read(url: string, kind: "json" | "html", signal: AbortSignal, fetcher: typeof fetch, timeoutMs: number) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  const timer = setTimeout(abort, timeoutMs);
  try {
    const response = await fetcher(url, { headers: { ...headers, accept: kind === "html" ? "text/html" : headers.accept }, cache: "no-store", signal: controller.signal, redirect: "follow" });
    if ([401, 403, 429].includes(response.status)) return { status: "blocked" as const, code: `HTTP_${response.status}` };
    if (!response.ok) return { status: "unavailable" as const, code: `HTTP_${response.status}` };
    if (/\/verify|\/captcha|\/login/.test(response.url)) return { status: "blocked" as const, code: "ACCESS_CHALLENGE" };
    // Keep the timeout active while consuming the body, not just until headers arrive.
    const body = await response.text();
    if (kind === "html") return { status: "ok" as const, body };
    const json = JSON.parse(body);
    if (json?.error || json?.redirect_to_error_page) return { status: json.redirect_to_error_page || Number(json.error) === 90309999 ? "blocked" as const : "unavailable" as const, code: `SHOPEE_${String(json.error ?? "ACCESS_CHALLENGE").slice(0,40)}` };
    return { status: "ok" as const, json };
  } catch {
    return { status: controller.signal.aborted ? "timeout" as const : "unavailable" as const };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}

// Only accept whole structured item objects. Nearby HTML text can belong to another offer.
export function extractShopeeItems(html: string): Row[] {
  const rows: Row[] = [];
  function walk(value: unknown, depth = 0) {
    if (!value || typeof value !== "object" || depth > 25) return;
    const obj = value as Row;
    if (id(obj.itemid) && id(obj.shopid) && typeof obj.name === "string") rows.push(obj);
    for (const child of Object.values(obj)) walk(child, depth + 1);
  }
  for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(script[1])); } catch { /* Executable scripts are never evaluated. */ }
  }
  return rows;
}

async function search(query: string, signal: AbortSignal, fetcher: typeof fetch, timeoutMs: number): Promise<SearchResult> {
  const base = `https://shopee.com.br/api/v4/search/search_items?by=relevancy&keyword=${encodeURIComponent(query)}&limit=60&newest=0&order=desc&page_type=search&scenario=PAGE_GLOBAL_SEARCH&version=2`;
  const api = await read(base, "json", signal, fetcher, timeoutMs);
  if (api.status === "blocked" || api.status === "timeout") return { rows: [], source: "shopee_public_api", status: api.status, code: api.code };
  if (api.status === "ok" && Array.isArray(api.json?.items)) return { rows: api.json.items.map((r: Row) => r.item_basic ?? r.item ?? r), source: "shopee_public_api", status: "ok" };
  const html = await read(`https://shopee.com.br/search?keyword=${encodeURIComponent(query)}`, "html", signal, fetcher, timeoutMs);
  const rows = html.status === "ok" ? extractShopeeItems(html.body ?? "") : [];
  return { rows, source: "shopee_public_html", status: rows.length ? "ok" : html.status === "ok" ? "unavailable" : html.status, code: html.status === "ok" && !rows.length ? "NO_STRUCTURED_ITEMS" : html.code };
}

export async function researchShopeePublic(seed: ProductIntelligenceSeed, options: { fetcher?: typeof fetch; timeoutMs?: number; budgetMs?: number } = {}): Promise<ResearchOutcome> {
  const searchTerms = buildShopeeSearchTerms(seed);
  const queries = [...new Set([[seed.name, seed.brand, seed.model].filter(Boolean).join(" ").trim(), seed.name?.trim(), searchTerms.slice(0,6).join(" ")].filter(Boolean))];
  const attempt: ResearchAttempt = { status: "invalid_input", checkedAt: new Date().toISOString(), queries, foundCount: 0, comparableCount: 0, pricedCount: 0, diagnostics: [] };
  if (!searchTerms.length) return { attempt, data: null };
  const fetcher = options.fetcher ?? fetch, timeoutMs = options.timeoutMs ?? 5000;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), options.budgetMs ?? 18000);
  try {
    const rows: Row[] = [];
    const sources = new Set<string>();
    for (const query of queries) {
      const result = await search(query, controller.signal, fetcher, timeoutMs);
      attempt.diagnostics.push({ source: result.source, status: result.status, ...(result.code ? { code: result.code } : {}) });
      rows.push(...result.rows);
      if (result.rows.length) sources.add(result.source);
      // A refusal is not absence of competitors, and must not trigger bypass attempts.
      if (result.status === "blocked" || controller.signal.aborted || rows.length >= 60) break;
    }
    const unique = new Map<string, Row>();
    for (const row of rows) if (id(row.shopid) && id(row.itemid) && typeof row.name === "string") unique.set(`${row.shopid}:${row.itemid}`, row);
    attempt.foundCount = unique.size;
    const target = words(seed.name);
    const candidates = [...unique.values()].map(raw => ({ raw, score: overlap(target, raw.name) })).filter(c => c.score >= 0.5).sort((a,b) => b.score - a.score).slice(0,12);
    if (!candidates.length) {
      const failures = attempt.diagnostics.map(d => d.status);
      attempt.status = failures.includes("blocked") ? "blocked" : failures.includes("timeout") ? "timeout" : failures.includes("unavailable") ? "unavailable" : "no_matches";
      return { attempt, data: null };
    }
    // Search evidence stands on its own; optional detail failures never erase competitors/prices.
    const competitors: PublicCompetitor[] = candidates.map(({raw}) => ({ title: raw.name, url: `https://shopee.com.br/product/${raw.shopid}/${raw.itemid}`, price: shopeeMoney(raw.price_min ?? raw.price), shopId: Number(raw.shopid), itemId: Number(raw.itemid), categoryId: null, category: null, attributes: {} }));
    // Only three detail requests, concurrently, within the overall deadline.
    await Promise.all(competitors.slice(0,3).map(async competitor => {
      if (controller.signal.aborted) return;
      const result = await read(`https://shopee.com.br/api/v4/pdp/get_pc?item_id=${competitor.itemId}&shop_id=${competitor.shopId}`, "json", controller.signal, fetcher, Math.min(timeoutMs,3000));
      if (result.status !== "ok") return;
      const item = result.json?.data?.item ?? result.json?.data;
      if (!item || id(item.itemid) !== competitor.itemId || id(item.shopid) !== competitor.shopId) return;
      const cats = item.categories ?? item.category_path;
      const last = Array.isArray(cats) ? cats[cats.length - 1] : null;
      competitor.categoryId = last?.catid != null ? String(last.catid) : null;
      competitor.category = typeof (last?.display_name ?? last?.name) === "string" ? (last.display_name ?? last.name) : null;
    }));
    const prices = competitors.map(c => c.price).filter((v): v is number => v != null).sort((a,b) => a-b);
    const votes = new Map<string, { count: number; category: string; id: string | null }>();
    for (const c of competitors) if (c.category) { const key = `${c.categoryId}|${c.category}`; const prev = votes.get(key); votes.set(key, { count: (prev?.count ?? 0)+1, category:c.category, id:c.categoryId }); }
    const category = [...votes.values()].sort((a,b) => b.count-a.count)[0];
    Object.assign(attempt, { status:"completed", comparableCount:competitors.length, pricedCount:prices.length });
    return { attempt, data: { competitors, priceMin:prices[0] ?? null, priceMedian:prices.length ? (prices[Math.floor((prices.length-1)/2)]+prices[Math.floor(prices.length/2)])/2 : null, priceMax:prices[prices.length-1] ?? null, category:category?.category ?? null, categoryId:category?.id ?? null, attributes:{}, searchTerms, source:sources.size > 1 ? "shopee_public_mixed" : [...sources][0] } };
  } finally { clearTimeout(timer); }
}
