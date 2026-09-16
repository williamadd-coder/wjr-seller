"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { scoreListing } from "@/lib/marketplaces/scoring";
import { preserveResearchAttempt } from "@/lib/marketplaces/shopee/optimization-notes";

function publishBlockers(product: any, listing: any, pricing: any, images: number) {
  const attributes = listing.attributes && typeof listing.attributes === "object" ? Object.keys(listing.attributes).length : 0;
  const blockers: string[] = listing.score_breakdown?.blockers ?? [];
  return [
    !listing.category || attributes < 3 ? "Confirme a categoria e pelo menos 3 atributos aplicáveis." : null,
    !pricing?.sale_price ? "Defina o preço de venda e a margem." : null,
    images < 3 ? "Adicione pelo menos 3 imagens do produto." : null,
    !product.weight_kg || !product.width_cm || !product.height_cm || !product.length_cm ? "Confirme peso e dimensões do pacote." : null,
    Number(listing.listing_score ?? 0) < 70 ? "O Score WJR precisa chegar a pelo menos 70." : null,
    blockers.length ? blockers[0] : null,
  ].filter(Boolean);
}

export async function updateListingContent(productId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");

  const { data: product } = await supabase.from("products").select("*").eq("id", productId).single();
  if (!product) redirect("/products");
  const { data: listing } = await supabase.from("listings").select("id,marketplace_category_id,optimization_notes").eq("product_id", productId).eq("marketplace", "shopee").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (!listing) redirect(`/products/${productId}/review?error=${encodeURIComponent("Gere o anúncio antes de editar.")}`);

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const keys = formData.getAll("attr_key").map(String);
  const values = formData.getAll("attr_value").map(String);
  const attributes: Record<string, string> = {};
  keys.forEach((key, i) => { const k = key.trim(), v = (values[i] ?? "").trim(); if (k && v) attributes[k] = v; });
  const intent = String(formData.get("intent") ?? "draft");

  if (!title) redirect(`/products/${productId}/review?error=${encodeURIComponent("O título não pode ficar vazio.")}`);
  if (!description) redirect(`/products/${productId}/review?error=${encodeURIComponent("A descrição não pode ficar vazia.")}`);

  const [{ data: assets }, { data: pricing }] = await Promise.all([
    supabase.from("product_assets").select("asset_type").eq("product_id", productId).eq("marketplace", "shopee"),
    supabase.from("pricing_scenarios").select("sale_price").eq("product_id", productId).eq("marketplace", "shopee").eq("is_recommended", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const keywords = Array.from(new Set(`${title} ${description}`.toLowerCase().split(/[^\p{L}\p{N}+]+/u).filter((w) => w.length > 2))).slice(0, 16);
  const imageCount = (assets ?? []).filter((a) => a.asset_type === "image").length;
  const hasVideo = (assets ?? []).some((a) => a.asset_type === "video");
  const price = pricing?.sale_price == null ? undefined : Number(pricing.sale_price);
  const categoryId = listing.marketplace_category_id ?? (category || undefined);
  const score = scoreListing({ marketplace: "shopee", title, categoryId, description, keywords, attributes, imageCount, hasVideo, price, stock: product.stock ?? undefined, sku: product.sku ?? undefined, ean: product.ean ?? undefined, weightKg: product.weight_kg ?? undefined, dimensions: { widthCm: product.width_cm ?? undefined, heightCm: product.height_cm ?? undefined, lengthCm: product.length_cm ?? undefined } });
  const optimizationNotes = preserveResearchAttempt(listing.optimization_notes, { ...(listing.optimization_notes && typeof listing.optimization_notes === "object" ? listing.optimization_notes : {}), blockers: score.blockers, recommendations: score.recommendations, manuallyEdited: true });

  const payload = {
    title, description, category: category || null, attributes, keywords,
    listing_score: score.total, conversion_score: score.total,
    seo_score: Math.round((score.title.score + score.attributes.score + score.completeness.score) / 3),
    content_score: Math.round((score.title.score + score.description.score + score.attributes.score) / 3),
    title_score: score.title.score, attribute_score: score.attributes.score, description_score: score.description.score,
    media_score: score.media.score, offer_score: score.offer.score, trust_score: score.trust.score, completeness_score: score.completeness.score,
    score_breakdown: score, optimization_notes: optimizationNotes, updated_at: new Date().toISOString(),
  };
  const result = await supabase.from("listings").update(payload).eq("id", listing.id);
  if (result.error) redirect(`/products/${productId}/review?error=${encodeURIComponent(result.error.message)}`);
  await supabase.from("products").update({ wjr_score: score.total, status: score.total >= 70 ? "ready" : "needs_review", updated_at: new Date().toISOString() }).eq("id", productId);

  if (intent === "publish") {
    const { data: freshListing } = await supabase.from("listings").select("*").eq("id", listing.id).single();
    const problems = publishBlockers(product, freshListing, pricing, imageCount);
    if (problems.length) redirect(`/products/${productId}/review?error=${encodeURIComponent(String(problems[0]))}`);
    const now = new Date().toISOString();
    await supabase.from("listings").update({ publication_status: "ready", updated_at: now }).eq("id", listing.id);
    await supabase.from("products").update({ status: "ready", updated_at: now }).eq("id", productId);
    revalidatePath(`/products/${productId}/review`);
    revalidatePath(`/products/${productId}`);
    revalidatePath("/products");
    redirect(`/products/${productId}/review?saved=1`);
  }

  revalidatePath(`/products/${productId}/review`);
  revalidatePath(`/products/${productId}`);
  revalidatePath(`/products/${productId}/package`);
  redirect(`/products/${productId}/review?updated=1`);
}
