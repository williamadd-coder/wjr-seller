"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SHOPEE_BR_PROFILE } from "@/lib/marketplaces/shopee/profile";

function parseAttributes(raw: string) {
  const attributes: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf(":");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (key && value) attributes[key] = value;
  }
  return attributes;
}

export async function saveShopeeListingData(productId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");

  const { data: product } = await supabase.from("products").select("id").eq("id", productId).single();
  if (!product) redirect("/products");

  const category = String(formData.get("category") ?? "").trim();
  const marketplaceCategoryId = String(formData.get("marketplace_category_id") ?? "").trim();
  const attributes = parseAttributes(String(formData.get("attributes") ?? ""));

  if (!category) redirect(`/products/${productId}?error=${encodeURIComponent("Informe a categoria da Shopee antes de continuar.")}`);

  const { data: current } = await supabase.from("listings").select("id,title,description,keywords").eq("product_id", productId).eq("marketplace", "shopee").limit(1).maybeSingle();
  const payload = {
    product_id: productId,
    marketplace: "shopee",
    category,
    marketplace_category_id: marketplaceCategoryId || null,
    attributes,
    marketplace_rules_version: SHOPEE_BR_PROFILE.version,
    updated_at: new Date().toISOString(),
  };

  const result = current
    ? await supabase.from("listings").update(payload).eq("id", current.id)
    : await supabase.from("listings").insert({ ...payload, title: "", description: "", keywords: [], publication_status: "draft" });

  if (result.error) redirect(`/products/${productId}?error=${encodeURIComponent(result.error.message)}`);
  revalidatePath(`/products/${productId}`);
  revalidatePath(`/products/${productId}/package`);
}
