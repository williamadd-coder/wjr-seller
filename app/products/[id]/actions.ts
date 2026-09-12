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

  const title = buildTitle(product);
  const description = buildDescription(product);
  const attributes = Object.fromEntries(Object.entries({ marca: product.brand, modelo: product.model, ean: product.ean }).filter(([, value]) => Boolean(value)));
  const keywords = product.name.toLowerCase().split(/\s+/).filter((word: string) => word.length > 3).slice(0, 8);
  const score = scoreListing({ marketplace: "shopee", title, description, keywords, attributes, imageCount: 0, hasVideo: false, price: undefined, stock: product.stock ?? undefined, sku: product.sku ?? undefined, ean: product.ean ?? undefined, weightKg: product.weight_kg ?? undefined, dimensions: { widthCm: product.width_cm ?? undefined, heightCm: product.height_cm ?? undefined, lengthCm: product.length_cm ?? undefined } });

  const listingPayload = {
    product_id: productId,
    marketplace: "shopee",
    title,
    description,
    keywords,
    attributes,
    publication_status: "draft",
    listing_score: score.total,
    title_score: score.title.score,
    attribute_score: score.attributes.score,
    description_score: score.description.score,
    media_score: score.media.score,
    offer_score: score.offer.score,
    trust_score: score.trust.score,
    completeness_score: score.completeness.score,
    score_breakdown: score,
    optimization_notes: { blockers: score.blockers, recommendations: score.recommendations },
    optimization_version: "shopee-conversion-v1",
    last_optimized_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase.from("listings").select("id").eq("product_id", productId).eq("marketplace", "shopee").limit(1).maybeSingle();
  const result = existing ? await supabase.from("listings").update(listingPayload).eq("id", existing.id) : await supabase.from("listings").insert(listingPayload);
  if (result.error) redirect(`/products/${productId}?error=${encodeURIComponent(result.error.message)}`);

  await supabase.from("products").update({ wjr_score: score.total, status: "analyzing" }).eq("id", productId);
  revalidatePath(`/products/${productId}`);
}
