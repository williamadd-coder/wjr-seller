import { createClient } from "@supabase/supabase-js";
import { researchShopeeMarket, marketPriceRange } from "../../lib/marketplaces/shopee/market-research";
import { mergeSuggestedAttributes } from "../../lib/marketplaces/shopee/attribute-merge";
import { preserveResearchAttempt } from "../../lib/marketplaces/shopee/optimization-notes";
import { scoreListing } from "../../lib/marketplaces/scoring";
import { scoreFields } from "../../lib/marketplaces/shopee/score-fields";
import { buildShopeeIntelligencePlan } from "../../lib/marketplaces/shopee/intelligence";
import { generateShopeeCopy } from "../../lib/marketplaces/shopee/copywriting";

/**
 * Runs the Shopee market research off the request/response cycle entirely, as a Netlify Background
 * Function (up to 15 min, not the ~26s a normal Next.js server action gets). The caller
 * (startShopeeResearch) marks the listing "pending" and fires this without waiting for it to finish;
 * this function writes the final "done"/"error" state itself, and the review page picks it up by
 * polling. Authenticates as the requesting user (their access token, not a service key) so normal
 * RLS policies apply — same access a logged-in request would have.
 */
export default async (req: Request) => {
  const { productId, accessToken } = await req.json();
  if (!productId || !accessToken) return new Response("missing productId or accessToken", { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } }, auth: { persistSession: false } }
  );

  const finish = async (listingId: string, previousNotes: unknown, patch: Record<string, unknown>) => {
    const notes = preserveResearchAttempt(previousNotes, {
      ...(previousNotes && typeof previousNotes === "object" ? previousNotes : {}),
      ...patch,
    });
    await supabase.from("listings").update({ optimization_notes: notes, updated_at: new Date().toISOString() }).eq("id", listingId);
  };

  try {
    const { data: product } = await supabase.from("products").select("*").eq("id", productId).single();
    const { data: listing } = await supabase.from("listings").select("*").eq("product_id", productId).eq("marketplace", "shopee").order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (!product || !listing) return new Response("product or listing not found", { status: 404 });

    const source = product.source_data && typeof product.source_data === "object" ? product.source_data : {};
    const current: Record<string, string> = listing.attributes && typeof listing.attributes === "object" ? { ...listing.attributes } : {};
    const plan = buildShopeeIntelligencePlan({ name: product.name, brand: product.brand, model: product.model, supplierDescription: source.supplier_description });

    const { data: research, error } = await researchShopeeMarket({
      name: product.name, brand: product.brand, model: product.model, ean: product.ean,
      supplierDescription: source.supplier_description, confirmedAttributes: current, searchTerms: plan.searchTerms,
    });
    if (error || !research) {
      await finish(listing.id, listing.optimization_notes, { aiMarketResearch: { status: "error", message: error ?? "A IA não retornou a pesquisa.", finishedAt: new Date().toISOString() } });
      return new Response("research failed", { status: 200 });
    }

    const competitors = research.competitors.filter((item) => item.title?.trim() || item.url?.trim());
    const range = marketPriceRange(competitors);
    if (competitors.length) {
      await supabase.from("market_analyses").insert({
        product_id: productId, marketplace: "shopee", competitors,
        price_min: range.min, price_median: range.median, price_max: range.max,
        rationale: research.summary, source: "ai_web_research", search_terms: research.searchTerms,
        competitor_patterns: { sample_size: competitors.length, priced_sample_size: range.sampleSize, category_path: research.categoryPath, category_confidence: research.categoryConfidence },
        conversion_insights: research.conversionInsights,
      });
    }

    const category = research.categoryConfidence === "baixa" ? (listing.category ?? null) : (research.categoryPath.trim() || listing.category || null);
    const merged = mergeSuggestedAttributes(current, research.attributes);

    // Never overwrite copy the seller already edited by hand — same rule the attribute merge follows.
    const notesObj = listing.optimization_notes && typeof listing.optimization_notes === "object" ? listing.optimization_notes : {};
    let title = listing.title ?? "";
    let description = listing.description ?? "";
    let benefits: string[] = [];
    if (!notesObj.manuallyEdited) {
      const { data: copy } = await generateShopeeCopy({
        name: product.name, brand: product.brand, model: product.model, categoryPath: category,
        confirmedAttributes: merged, supplierDescription: source.supplier_description, itemsIncluded: source.items_included,
        weightKg: product.weight_kg, widthCm: product.width_cm, heightCm: product.height_cm, lengthCm: product.length_cm,
        competitorTitles: competitors.map((c) => c.title).filter(Boolean).slice(0, 8),
        conversionInsights: research.conversionInsights,
      });
      if (copy) { title = copy.title; description = copy.description; benefits = copy.benefits; }
    }

    const [{ data: assets }, { data: pricing }] = await Promise.all([
      supabase.from("product_assets").select("asset_type").eq("product_id", productId).eq("marketplace", "shopee"),
      supabase.from("pricing_scenarios").select("sale_price").eq("product_id", productId).eq("marketplace", "shopee").eq("is_recommended", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const score = scoreListing({
      marketplace: "shopee", title, description,
      keywords: listing.keywords ?? [], attributes: merged,
      categoryId: listing.marketplace_category_id ?? category ?? undefined,
      imageCount: (assets ?? []).filter((a: any) => a.asset_type === "image").length,
      hasVideo: (assets ?? []).some((a: any) => a.asset_type === "video"),
      price: pricing?.sale_price == null ? undefined : Number(pricing.sale_price),
      stock: product.stock ?? undefined, sku: product.sku ?? undefined, ean: product.ean ?? undefined,
      weightKg: product.weight_kg ?? undefined,
      dimensions: { widthCm: product.width_cm ?? undefined, heightCm: product.height_cm ?? undefined, lengthCm: product.length_cm ?? undefined },
    });

    await supabase.from("listings").update({
      title, description, category, attributes: merged, ...scoreFields(score), updated_at: new Date().toISOString(),
      optimization_notes: preserveResearchAttempt(listing.optimization_notes, {
        ...notesObj,
        blockers: score.blockers, recommendations: score.recommendations, aiBenefits: benefits,
        aiMarketResearch: {
          status: "done", categoryPath: research.categoryPath, categoryConfidence: research.categoryConfidence, categoryReason: research.categoryReason,
          searchTerms: research.searchTerms, competitorCount: competitors.length, pricedCount: range.sampleSize,
          priceMin: range.min, priceMax: range.max, conversionInsights: research.conversionInsights,
          competitors: competitors.slice(0, 6), finishedAt: new Date().toISOString(),
        },
      }),
    }).eq("id", listing.id);
    await supabase.from("products").update({ wjr_score: score.total, status: score.total >= 70 ? "ready" : "needs_review", updated_at: new Date().toISOString() }).eq("id", productId);

    return new Response("ok", { status: 200 });
  } catch (err) {
    // Best-effort: try to at least flip the status to "error" so the page stops polling instead of spinning forever.
    try {
      const { data: listing } = await supabase.from("listings").select("id,optimization_notes").eq("product_id", productId).eq("marketplace", "shopee").order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (listing) await finish(listing.id, listing.optimization_notes, { aiMarketResearch: { status: "error", message: "Falha inesperada na pesquisa. Tente novamente.", finishedAt: new Date().toISOString() } });
    } catch {}
    return new Response("unexpected error", { status: 500 });
  }
};
