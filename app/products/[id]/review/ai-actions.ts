"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { scoreListing } from "@/lib/marketplaces/scoring";
import { scoreFields } from "@/lib/marketplaces/shopee/score-fields";
import { preserveResearchAttempt } from "@/lib/marketplaces/shopee/optimization-notes";
import { suggestShopeeClassification } from "@/lib/marketplaces/shopee/classification";
import { mergeSuggestedAttributes } from "@/lib/marketplaces/shopee/attribute-merge";
import { planShopeeImages, type ImageInput } from "@/lib/marketplaces/shopee/image-plan";
import { generateMarketingImageSet } from "@/lib/marketplaces/shopee/generate-marketing-images";

const BUCKET = "product-media";
const MAX_ANALYZED_IMAGES = 5;
const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const fail = (productId: string, message: string) => redirect(`/products/${productId}/review?error=${encodeURIComponent(message)}`);

/** Accepts "89,90" and "89.90"; empty means "field not present in this submission", so keep the stored value. */
function numberOrNull(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw);
  return Number.isFinite(parsed) ? parsed : null;
}

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

  const merged = mergeSuggestedAttributes(current, suggestion!.attributes);
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

/**
 * Kicks off the Shopee market research and returns immediately — the actual AI call (which can take
 * well over the ~26s a server action gets) runs in a Netlify Background Function, not here. Marks the
 * listing "pending" so the review page's poller picks up the result once the background function
 * writes it, whether that takes 20 seconds or two minutes.
 */
export async function startShopeeResearch(productId: string, formData?: FormData) {
  const { supabase, product, listing } = await loadContext(productId);
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) fail(productId, "Sessão expirada. Entre novamente e tente de novo.");

  // This button lives inside the same <form> as title/description/Oferta e Envio — save whatever the
  // seller already typed there too, so clicking "Pesquisar" never discards unsaved edits.
  if (formData) {
    const basics = {
      cost: numberOrNull(formData.get("cost")) ?? product.cost,
      stock: numberOrNull(formData.get("stock")) ?? product.stock,
      weight_kg: numberOrNull(formData.get("weight_kg")) ?? product.weight_kg,
      width_cm: numberOrNull(formData.get("width_cm")) ?? product.width_cm,
      height_cm: numberOrNull(formData.get("height_cm")) ?? product.height_cm,
      length_cm: numberOrNull(formData.get("length_cm")) ?? product.length_cm,
    };
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    await supabase.from("products").update({ ...basics, updated_at: new Date().toISOString() }).eq("id", productId);
    await supabase.from("listings").update({
      ...(title ? { title } : {}), ...(description ? { description } : {}), ...(category ? { category } : {}),
      updated_at: new Date().toISOString(),
    }).eq("id", listing.id);
  }

  const notes = preserveResearchAttempt(listing.optimization_notes, {
    ...(listing.optimization_notes && typeof listing.optimization_notes === "object" ? listing.optimization_notes : {}),
    aiMarketResearch: { status: "pending", startedAt: new Date().toISOString() },
  });
  const result = await supabase.from("listings").update({ optimization_notes: notes }).eq("id", listing.id);
  if (result.error) fail(productId, result.error.message);

  // process.env.URL/DEPLOY_PRIME_URL aren't populated in this Next.js runtime, unlike classic Netlify
  // Functions — the incoming request's own host always matches the deploy actually serving this page.
  const host = (await headers()).get("host");
  const base = host ? `https://${host}` : (process.env.DEPLOY_PRIME_URL || process.env.URL || "");
  try {
    const response = await fetch(`${base}/.netlify/functions/shopee-market-research-background`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId, accessToken }),
    });
    if (!response.ok && response.status !== 202) throw new Error(`status ${response.status}`);
  } catch (err) {
    // Roll the status back from "pending" — otherwise the poller spins and the button stays disabled forever.
    await supabase.from("listings").update({ optimization_notes: preserveResearchAttempt(notes, { ...notes, aiMarketResearch: { status: "error", message: "Não foi possível iniciar a pesquisa.", finishedAt: new Date().toISOString() } }) }).eq("id", listing.id);
    fail(productId, `Não foi possível iniciar a pesquisa agora. Tente novamente em instantes. (${err instanceof Error ? err.message : "erro desconhecido"} · base=${base || "vazio"})`);
  }

  revalidatePath(`/products/${productId}/review`);
  redirect(`/products/${productId}/review?researching=1`);
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

const humanizeLabel = (k: string) => k.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Builds the "secondary images that sell" set (capa, benefícios, medidas, o que acompanha) as new
 * product photos — template-based (see generate-marketing-images.ts), using the seller's own uploaded
 * photo, so the product shown is always exactly what's being sold.
 */
export async function generateMarketingImages(productId: string) {
  const { supabase, product, listing } = await loadContext(productId);
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: assets } = await supabase.from("product_assets").select("id,storage_path,metadata").eq("product_id", productId).eq("marketplace", "shopee").eq("asset_type", "image").order("created_at", { ascending: true }).limit(MAX_ANALYZED_IMAGES);
  if (!assets?.length) fail(productId, "Envie ao menos uma imagem do produto antes de gerar as imagens de marketing.");

  const notes = listing.optimization_notes && typeof listing.optimization_notes === "object" ? (listing.optimization_notes as any) : {};
  const coverIndex: number = notes.aiImagePlan?.coverIndex ?? 0;
  const cover = assets![Math.min(coverIndex, assets!.length - 1)];
  const { data: file } = await supabase.storage.from(BUCKET).download(cover.storage_path);
  if (!file) fail(productId, "Não foi possível ler a imagem do produto. Reenvie e tente novamente.");
  const contentType = SUPPORTED_IMAGE_TYPES.find((type) => type === (file!.type || cover.metadata?.content_type)) ?? "image/jpeg";
  const photoDataUrl = `data:${contentType};base64,${Buffer.from(await file!.arrayBuffer()).toString("base64")}`;

  const source = product.source_data && typeof product.source_data === "object" ? (product.source_data as Record<string, any>) : {};
  const rawIncluded = source.items_included;
  const includedItems: string[] = (Array.isArray(rawIncluded) ? rawIncluded : String(rawIncluded ?? "").split(/\n|;/)).map((s: string) => String(s).trim()).filter(Boolean);

  const benefits: string[] = Array.isArray(notes.aiBenefits) && notes.aiBenefits.length
    ? notes.aiBenefits
    : Object.entries((listing.attributes && typeof listing.attributes === "object" ? listing.attributes : {}) as Record<string, string>)
        .filter(([, v]) => String(v ?? "").trim()).slice(0, 4).map(([k, v]) => `${humanizeLabel(k)}: ${v}`);

  const specs = [
    product.weight_kg ? { label: "Peso do pacote", value: `${product.weight_kg} kg` } : null,
    product.width_cm ? { label: "Largura", value: `${product.width_cm} cm` } : null,
    product.height_cm ? { label: "Altura", value: `${product.height_cm} cm` } : null,
    product.length_cm ? { label: "Comprimento", value: `${product.length_cm} cm` } : null,
  ].filter((s): s is { label: string; value: string } => s !== null);

  let slides;
  try {
    slides = await generateMarketingImageSet({ productName: product.name, photoDataUrl, benefits, specs, includedItems });
  } catch (err) {
    fail(productId, `Não foi possível gerar as imagens agora. Tente novamente. (${err instanceof Error ? err.message : "erro desconhecido"})`);
  }

  for (const slide of slides!) {
    const path = `${userId}/${productId}/marketing/${crypto.randomUUID()}-${slide.key}.png`;
    const { error: storageError } = await supabase.storage.from(BUCKET).upload(path, slide.buffer, { contentType: "image/png", upsert: false });
    if (storageError) continue;
    await supabase.from("product_assets").insert({
      product_id: productId, asset_type: "image", storage_path: path, marketplace: "shopee",
      metadata: { name: `${slide.key}.png`, content_type: "image/png", generated: true, template: slide.key, label: slide.label },
    });
  }

  revalidatePath(`/products/${productId}/review`);
  redirect(`/products/${productId}/review?imagesGenerated=1`);
}
