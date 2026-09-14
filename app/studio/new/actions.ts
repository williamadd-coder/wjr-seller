"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function numberOrNull(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim().replace(/\s/g, "");
  if (!raw) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim() || null;

export async function createProductDraft(formData: FormData) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/studio/new?error=Informe o nome do produto");

  const sourceData = {
    marketplace: "shopee", ingestion: "seller_studio_manual",
    ncm: text(formData, "ncm"), items_included: text(formData, "items_included"), supplier_description: text(formData, "supplier_description"),
    product_specs: { weight_kg: numberOrNull(formData.get("product_weight_kg")), width_cm: numberOrNull(formData.get("product_width_cm")), height_cm: numberOrNull(formData.get("product_height_cm")), length_cm: numberOrNull(formData.get("product_length_cm")) },
  };
  const payload = {
    user_id: userId, name, supplier: text(formData, "supplier"), supplier_url: text(formData, "supplier_url"), sku: text(formData, "sku"), ean: text(formData, "ean"),
    cost: numberOrNull(formData.get("cost")), stock: null, brand: text(formData, "brand"), model: text(formData, "model"),
    weight_kg: numberOrNull(formData.get("package_weight_kg")), width_cm: numberOrNull(formData.get("package_width_cm")), height_cm: numberOrNull(formData.get("package_height_cm")), length_cm: numberOrNull(formData.get("package_length_cm")),
    source_data: sourceData,
  };
  const { data, error } = await supabase.from("products").insert(payload).select("id").single();
  if (error) redirect(`/studio/new?error=${encodeURIComponent(error.message)}`);
  redirect(`/products/${data.id}?generate=1`);
}
