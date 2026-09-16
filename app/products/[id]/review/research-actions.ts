"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { researchShopeeMarket } from "@/lib/marketplaces/shopee/market-research";
import { saveResearchEvidence } from "@/lib/marketplaces/shopee/research-evidence";

export async function retryShopeeResearch(productId: string) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");
  const { data: product } = await supabase.from("products").select("name,brand,model").eq("id",productId).single();
  if (!product) redirect("/products");
  const outcome = await saveResearchEvidence(supabase,productId,await researchShopeeMarket(product));
  const { data: listing, error: readError } = await supabase.from("listings").select("id,optimization_notes").eq("product_id",productId).eq("marketplace","shopee").order("updated_at",{ascending:false}).limit(1).maybeSingle();
  if (readError || !listing) redirect(`/products/${productId}/review?error=${encodeURIComponent("Não foi possível registrar a tentativa. Gere o anúncio e tente novamente.")}`);
  const { data: saved, error } = await supabase.from("listings").update({ optimization_notes:{ ...listing.optimization_notes, publicResearchAttempt:outcome.attempt } }).eq("id",listing.id).select("id").single();
  if (error || !saved) redirect(`/products/${productId}/review?error=${encodeURIComponent("Não foi possível salvar o estado da pesquisa. Tente novamente.")}`);
  // Research-only retry never changes copy, score, publication status or the approved price.
  revalidatePath(`/products/${productId}/review`);
  revalidatePath(`/products/${productId}`);
  revalidatePath(`/products/${productId}/package`);
}
