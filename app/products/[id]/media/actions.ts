"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateShopeeMedia } from "@/lib/marketplaces/shopee/media";

const BUCKET = "product-media";

function safeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-");
}

export async function uploadProductMedia(productId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: product } = await supabase.from("products").select("id").eq("id", productId).single();
  if (!product) redirect("/products");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) redirect(`/products/${productId}?error=${encodeURIComponent("Selecione uma imagem ou vídeo válido.")}`);

  const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : null;
  if (!kind) redirect(`/products/${productId}?error=${encodeURIComponent("Formato não suportado. Use JPG, PNG, WEBP, MP4 ou WEBM.")}`);

  const allowed = kind === "image" ? ["image/jpeg", "image/png", "image/webp"] : ["video/mp4", "video/webm"];
  if (!allowed.includes(file.type)) redirect(`/products/${productId}?error=${encodeURIComponent("Formato não suportado para o pacote Shopee.")}`);

  const validation = validateShopeeMedia({ kind, name: file.name, sizeBytes: file.size });
  if (validation.blockers.length) redirect(`/products/${productId}?error=${encodeURIComponent(validation.blockers.join(" "))}`);

  const path = `${userId}/${productId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error: storageError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (storageError) redirect(`/products/${productId}?error=${encodeURIComponent(storageError.message)}`);

  const { error: assetError } = await supabase.from("product_assets").insert({
    product_id: productId,
    asset_type: kind,
    storage_path: path,
    marketplace: "shopee",
    metadata: { name: file.name, size_bytes: file.size, content_type: file.type, validation },
  });
  if (assetError) {
    await supabase.storage.from(BUCKET).remove([path]);
    redirect(`/products/${productId}?error=${encodeURIComponent(assetError.message)}`);
  }

  revalidatePath(`/products/${productId}`);
  revalidatePath(`/products/${productId}/package`);
}

export async function deleteProductMedia(productId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");

  const assetId = String(formData.get("asset_id") ?? "");
  const { data: asset } = await supabase.from("product_assets").select("id,storage_path").eq("id", assetId).eq("product_id", productId).single();
  if (!asset) redirect(`/products/${productId}?error=${encodeURIComponent("Mídia não encontrada.")}`);

  const { error: storageError } = await supabase.storage.from(BUCKET).remove([asset.storage_path]);
  if (storageError) redirect(`/products/${productId}?error=${encodeURIComponent(storageError.message)}`);
  const { error } = await supabase.from("product_assets").delete().eq("id", asset.id);
  if (error) redirect(`/products/${productId}?error=${encodeURIComponent(error.message)}`);

  revalidatePath(`/products/${productId}`);
  revalidatePath(`/products/${productId}/package`);
}
