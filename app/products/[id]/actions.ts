"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { scoreListing } from "@/lib/marketplaces/scoring";

function buildTitle(product: Record<string, any>) {
  const parts = [product.brand, product.name, product.model].filter(Boolean);
  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 120);
}

function buildDescription(product: Record<string, any>) {
  const details = [
    `Conheça ${product.name}, uma opção pensada para quem busca praticidade e uma compra bem informada.`,
    "",
    "DESTAQUES DO PRODUTO",
    product.brand ? `- Marca: ${product.brand}` : null,
    product.model ? `- Modelo: ${product.model}` : null,
    product.ean ? `- EAN: ${product.ean}` : null,
    product.weight_kg ? `- Peso do pacote: ${product.weight_kg} kg` : null,
    product.width_cm && product.height_cm && product.length_cm ? `- Dimensões do pacote: ${product.width_cm} x ${product.height_cm} x ${product.length_cm} cm` : null,
    "",
    "Antes de publicar, confirme materiais, medidas do produto, conteúdo da embalagem, indicação de uso, idade recomendada e demais características específicas. Não incluímos informações que não estejam sustentadas pela fonte do produto.",
  ].filter((line) => line !== null);
  return details.join("\n");
}

export async function optimizeShopee(productId: string) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");

  const { data: product } = await supabase.from("products").select("*").eq("id", productId).single();
  if (!product) redirect("/products");

  const [{ data: pricing }, { data: assets }, { data: currentListing }] = await Promise.all([
    supabase.from("pricing_scenarios").select("sale_price").eq("product_id", productId).eq("marketplace", "shopee").eq("is_recommended", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("product_assets").select("asset_type").eq("product_id", productId).eq("marketplace", "shopee"),
    supabase.from("listings").select("id,category,marketplace_category_id").eq("product_id", productId).eq("marketplace", "shopee").limit(1).maybeSingle(),
  ]);

  const title = buildTitle(product);
  const description = buildDescription(product);
  const attributes = Object.fromEntries(Object.entries({ marca: product.brand, modelo: product.model, ean: product.ean }).filter(([, value]) => Boolean(value)));
  const keywords = product.name.toLowerCase().split(/\s+/).filter((word: string) => word.length > 3).slice(0, 8);
  const imageCount = (assets ?? []).filter((asset) => asset.asset_type === "image").length;
  const hasVideo = (assets ?? []).some((asset) => asset.asset_type === "video");
  const price = pricing?.sale_price == null ? undefined : Number(pricing.sale_price);

  const score = scoreListing({
    marketplace: "shopee",
    title,
    categoryId: currentListing?.marketplace_category_id ?? currentListing?.category ?? undefined,
    description,
    keywords,
    attributes,
    imageCount,
    hasVideo,
    price,
    stock: product.stock ?? undefined,
    sku: product.sku ?? undefined,
    ean: product.ean ?? undefined,
    weightKg: product.weight_kg ?? undefined,
    dimensions: { widthCm: product.width_cm ?? undefined, heightCm: product.height_cm ?? undefined, lengthCm: product.length_cm ?? undefined },
  });

  const listingPayload = {
    product_id: productId,
    marketplace: "shopee",
    title,
    description,
    keywords,
    attributes,
    publication_status: "draft",
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
    optimization_notes: { blockers: score.blockers, recommendations: score.recommendations },
    optimization_version: "shopee-conversion-v2",
    last_optimized_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const result = currentListing ? await supabase.from("listings").update(listingPayload).eq("id", currentListing.id) : await supabase.from("listings").insert(listingPayload);
  if (result.error) redirect(`/products/${productId}?error=${encodeURIComponent(result.error.message)}`);

  const nextStatus = score.blockers.length === 0 && score.completeness.score >= 90 ? "ready" : "needs_review";
  const productUpdate = await supabase.from("products").update({ wjr_score: score.total, status: nextStatus, updated_at: new Date().toISOString() }).eq("id", productId);
  if (productUpdate.error) redirect(`/products/${productId}?error=${encodeURIComponent(productUpdate.error.message)}`);

  revalidatePath(`/products/${productId}`);
  revalidatePath(`/products/${productId}/package`);
  revalidatePath("/products");
}
