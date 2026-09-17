"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { scoreListing } from "@/lib/marketplaces/scoring";
import { scoreFields } from "@/lib/marketplaces/shopee/score-fields";
import { preserveResearchAttempt } from "@/lib/marketplaces/shopee/optimization-notes";
import { suggestShopeeClassification } from "@/lib/marketplaces/shopee/classification";
import { planShopeeImages, type ImageInput } from "@/lib/marketplaces/shopee/image-plan";

const BUCKET = "product-media";
const MAX_ANALYZED_IMAGES = 5;
const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const fail = (productId: string, message: string) => redirect(`/products/${productId}/review?error=${encodeURIComponent(message)}`);

async function loadContext(productId: string) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");
  const { data: product } = await supabase.from("products").select("*").eq("id", productId).single();
  if (!product) redirect("/products");
  const { data: listing } = await supabase.from("listings").select("*").eq("product_id", productId).eq("marketplace", "shopee").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (!listing) fail(productId, "Gere o anúncio antes de pedir a sugestão da IA.");
  return { supabase, product, listing: listing! };
}

export async function suggestCategoryAndAttributes(productId: string) {
  const { supabase, product, listing } = await loadContext(productId);
  const source = product.source_data && typeof product.source_data === "object" ? (product.source_data as Record<string, any>) : {};
  const current: Record<string, string> = listing.attributes && typeof listing.attributes === "object" ? { ...(listing.attributes as Record<string, string>) } : {};

  const { data: suggestion, error } = await suggestShopeeClassification({
    name: product.name, brand: product.brand, model: product.model, ean: product.ean,
    supplierDescription: source.supplier_description, confirmedAttributes: current,
  });
  if (error || !suggestion) fail(productId, error ?? "A IA não retornou uma sugestão.");

  // Suggestions never overwrite what the seller already confirmed.
  const merged = { ...current };
  for (const attribute of suggestion!.attributes) {
    const name = attribute.name.trim();
    if (name && attribute.value.trim() && !merged[name]) merged[name] = attribute.value.trim();
  }
  const category = listing.category?.trim() ? listing.category : suggestion!.categoryPath;

  const [{ data: assets }, { data: pricing }] = await Promise.all([
    supabase.from("product_assets").select("asset_type").eq("product_id", productId).eq("marketplace", "shopee"),
    supabase.from("pricing_scenarios").select("sale_price").eq("product_id", productId).eq("marketplace", "shopee").eq("is_recommended", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const score = scoreListing({
    marketplace: "shopee", title: listing.title ?? "", description: listing.description ?? "",
    keywords: listing.keywords ?? [], attributes: merged,
    categoryId: listing.marketplace_category_id ?? category ?? undefined,
    imageCount: (assets ?? []).filter((a) => a.asset_type === "image").length,
    hasVideo: (assets ?? []).some((a) => a.asset_type === "video"),
    price: pricing?.sale_price == null ? undefined : Number(pricing.sale_price),
    stock: product.stock ?? undefined, sku: product.sku ?? undefined, ean: product.ean ?? undefined,
    weightKg: product.weight_kg ?? undefined,
    dimensions: { widthCm: product.width_cm ?? undefined, heightCm: product.height_cm ?? undefined, lengthCm: product.length_cm ?? undefined },
  });

  const notes = preserveResearchAttempt(listing.optimization_notes, {
    ...(listing.optimization_notes && typeof listing.optimization_notes === "object" ? listing.optimization_notes : {}),
    blockers: score.blockers, recommendations: score.recommendations,
    aiClassification: { ...suggestion, generatedAt: new Date().toISOString() },
  });

  const result = await supabase.from("listings").update({
    category, attributes: merged, optimization_notes: notes, ...scoreFields(score), updated_at: new Date().toISOString(),
  }).eq("id", listing.id);
  if (result.error) fail(productId, result.error.message);
  await supabase.from("products").update({ wjr_score: score.total, status: score.total >= 70 ? "ready" : "needs_review", updated_at: new Date().toISOString() }).eq("id", productId);

  revalidatePath(`/products/${productId}/review`);
  revalidatePath(`/products/${productId}`);
  redirect(`/products/${productId}/review?suggested=1`);
}

export async function analyzeProductImages(productId: string) {
  const { supabase, product, listing } = await loadContext(productId);
  const { data: assets } = await supabase.from("product_assets").select("id,storage_path,metadata").eq("product_id", productId).eq("marketplace", "shopee").eq("asset_type", "image").order("created_at", { ascending: true }).limit(MAX_ANALYZED_IMAGES);
  if (!assets?.length) fail(productId, "Envie ao menos uma imagem do produto antes de pedir a análise.");

  const images: ImageInput[] = [];
  for (const asset of assets!) {
    const { data: file } = await supabase.storage.from(BUCKET).download(asset.storage_path);
    if (!file) continue;
    const mediaType = SUPPORTED_IMAGE_TYPES.find((type) => type === (file.type || asset.metadata?.content_type));
    if (!mediaType) continue;
    images.push({ mediaType, base64: Buffer.from(await file.arrayBuffer()).toString("base64") });
  }
  if (!images.length) fail(productId, "Não foi possível ler as imagens enviadas. Reenvie as imagens do produto.");

  const { data: plan, error } = await planShopeeImages(images, product.name);
  if (error || !plan) fail(productId, error ?? "A IA não retornou uma análise das imagens.");

  const notes = preserveResearchAttempt(listing.optimization_notes, {
    ...(listing.optimization_notes && typeof listing.optimization_notes === "object" ? listing.optimization_notes : {}),
    aiImagePlan: { ...plan, analyzedCount: images.length, generatedAt: new Date().toISOString() },
  });
  const result = await supabase.from("listings").update({ optimization_notes: notes, updated_at: new Date().toISOString() }).eq("id", listing.id);
  if (result.error) fail(productId, result.error.message);

  revalidatePath(`/products/${productId}/review`);
  redirect(`/products/${productId}/review?analyzed=1`);
}
