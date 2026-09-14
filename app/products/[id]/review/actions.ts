"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function saveReviewedListing(productId: string) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");

  const [{ data: product }, { data: listing }, { data: pricing }, { data: assets }] = await Promise.all([
    supabase.from("products").select("*").eq("id", productId).single(),
    supabase.from("listings").select("*").eq("product_id", productId).eq("marketplace", "shopee").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("pricing_scenarios").select("sale_price").eq("product_id", productId).eq("marketplace", "shopee").eq("is_recommended", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("product_assets").select("asset_type").eq("product_id", productId).eq("marketplace", "shopee"),
  ]);

  if (!product || !listing) redirect(`/products/${productId}/review?error=${encodeURIComponent("Gere a otimização antes de salvar.")}`);
  const attributes = listing.attributes && typeof listing.attributes === "object" ? Object.keys(listing.attributes).length : 0;
  const images = (assets ?? []).filter((asset) => asset.asset_type === "image").length;
  const blockers: string[] = listing.score_breakdown?.blockers ?? [];
  const problems = [
    !listing.category || attributes < 3 ? "Confirme a categoria e pelo menos 3 atributos aplicáveis." : null,
    !pricing?.sale_price ? "Defina o preço de venda e a margem." : null,
    images < 3 ? "Adicione pelo menos 3 imagens do produto." : null,
    !product.weight_kg || !product.width_cm || !product.height_cm || !product.length_cm ? "Confirme peso e dimensões do pacote." : null,
    Number(listing.listing_score ?? 0) < 70 ? "O Score WJR precisa chegar a pelo menos 70." : null,
    blockers.length ? blockers[0] : null,
  ].filter(Boolean);

  if (problems.length) redirect(`/products/${productId}/review?error=${encodeURIComponent(String(problems[0]))}`);

  const now = new Date().toISOString();
  const listingResult = await supabase.from("listings").update({ publication_status: "ready", updated_at: now }).eq("id", listing.id);
  if (listingResult.error) redirect(`/products/${productId}/review?error=${encodeURIComponent(listingResult.error.message)}`);
  const productResult = await supabase.from("products").update({ status: "ready", wjr_score: listing.listing_score, updated_at: now }).eq("id", productId);
  if (productResult.error) redirect(`/products/${productId}/review?error=${encodeURIComponent(productResult.error.message)}`);

  revalidatePath(`/products/${productId}/review`);
  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
  redirect(`/products/${productId}/review?saved=1`);
}
