"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function numberOrNull(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim().replace(/\s/g, "");
  if (!raw) return null;

  // Seller Studio is BR-first: support 15,99, 1.234,56 and plain 1234.56.
  // When both separators are present, dots are thousands separators and comma is decimal.
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function createProductDraft(formData: FormData) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/studio/new?error=Informe o nome do produto");

  const payload = {
    user_id: userId,
    name,
    supplier: String(formData.get("supplier") ?? "").trim() || null,
    supplier_url: String(formData.get("supplier_url") ?? "").trim() || null,
    sku: String(formData.get("sku") ?? "").trim() || null,
    ean: String(formData.get("ean") ?? "").trim() || null,
    cost: numberOrNull(formData.get("cost")),
    stock: numberOrNull(formData.get("stock")),
    weight_kg: numberOrNull(formData.get("weight_kg")),
    width_cm: numberOrNull(formData.get("width_cm")),
    height_cm: numberOrNull(formData.get("height_cm")),
    length_cm: numberOrNull(formData.get("length_cm")),
    brand: String(formData.get("brand") ?? "").trim() || null,
    model: String(formData.get("model") ?? "").trim() || null,
    source_data: { marketplace: "shopee", ingestion: "seller_studio_manual" },
  };

  const { data, error } = await supabase.from("products").insert(payload).select("id").single();
  if (error) redirect(`/studio/new?error=${encodeURIComponent(error.message)}`);
  redirect(`/products/${data.id}`);
}
