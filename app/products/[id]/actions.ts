"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { scoreListing } from "@/lib/marketplaces/scoring";
import { SHOPEE_BR_PROFILE } from "@/lib/marketplaces/shopee/profile";

const STOPWORDS = new Set(["com","para","uma","uns","das","dos","de","da","do","e","em","a","o"]);
function clean(value: unknown) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function humanize(key: string) { return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function confirmedTextAttributes(attributes: Record<string, unknown>) {
  return Object.entries(attributes).filter(([, value]) => ["string","number","boolean"].includes(typeof value) && clean(value));
}
function buildTitle(product: Record<string, any>, attributes: Record<string, unknown>) {
  const useful = confirmedTextAttributes(attributes)
    .filter(([key]) => !["ean","sku","marca","brand","modelo","model"].includes(key.toLowerCase()))
    .slice(0, 3).map(([, value]) => clean(value));
  const candidates = [product.brand, product.name, product.model, ...useful].map(clean).filter(Boolean);
  const unique = candidates.filter((value, index) => candidates.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index);
  return unique.join(" ").replace(/\s+/g, " ").trim().slice(0, SHOPEE_BR_PROFILE.listing.title.maxLength);
}
function buildKeywords(product: Record<string, any>, attributes: Record<string, unknown>) {
  const source = [product.name, product.brand, product.model, ...confirmedTextAttributes(attributes).map(([, value]) => value)].map(clean).filter(Boolean).join(" ").toLowerCase();
  return Array.from(new Set(source.split(/[^\p{L}\p{N}+]+/u).filter((word) => word.length > 2 && !STOPWORDS.has(word)))).slice(0, 16);
}
function buildDescription(product: Record<string, any>, attributes: Record<string, unknown>) {
  const facts = confirmedTextAttributes(attributes).filter(([key]) => !["ean","sku"].includes(key.toLowerCase())).slice(0, 12);
  const lines = [
    product.name.toUpperCase(),
    "",
    `Veja os detalhes confirmados de ${product.name} e confira se ele atende ao que você procura antes da compra.`,
    "",
    "CARACTERÍSTICAS CONFIRMADAS",
    ...facts.map(([key, value]) => `• ${humanize(key)}: ${clean(value)}`),
    product.ean ? `• EAN/GTIN: ${product.ean}` : null,
    product.weight_kg ? `• Peso do pacote: ${product.weight_kg} kg` : null,
    product.width_cm && product.height_cm && product.length_cm ? `• Dimensões do pacote: ${product.width_cm} x ${product.height_cm} x ${product.length_cm} cm` : null,
    "",
    "COMPRA BEM INFORMADA",
    "As informações acima usam somente dados confirmados no cadastro. Características ainda não comprovadas devem ser validadas antes da publicação para evitar promessas incorretas no anúncio.",
  ];
  return lines.filter((line) => line !== null).join("\n").slice(0, SHOPEE_BR_PROFILE.listing.description.maxLength);
}

export async function optimizeShopee(productId: string) {
 const supabase=await createClient(); const {data:claimsData}=await supabase.auth.getClaims(); if(!claimsData?.claims?.sub) redirect("/login");
 const {data:product}=await supabase.from("products").select("*").eq("id",productId).single(); if(!product) redirect("/products");
 const [{data:pricing},{data:assets},{data:currentListing}]=await Promise.all([
  supabase.from("pricing_scenarios").select("sale_price").eq("product_id",productId).eq("marketplace","shopee").eq("is_recommended",true).order("created_at",{ascending:false}).limit(1).maybeSingle(),
  supabase.from("product_assets").select("asset_type").eq("product_id",productId).eq("marketplace","shopee"),
  supabase.from("listings").select("id,category,marketplace_category_id,attributes").eq("product_id",productId).eq("marketplace","shopee").limit(1).maybeSingle(),
 ]);
 const baseAttributes=Object.fromEntries(Object.entries({marca:product.brand,modelo:product.model,ean:product.ean}).filter(([,value])=>Boolean(value)));
 const confirmedAttributes=currentListing?.attributes && typeof currentListing.attributes==="object" ? currentListing.attributes : {};
 const attributes={...baseAttributes,...confirmedAttributes};
 const title=buildTitle(product,attributes); const description=buildDescription(product,attributes); const keywords=buildKeywords(product,attributes);
 const imageCount=(assets??[]).filter((a)=>a.asset_type==="image").length; const hasVideo=(assets??[]).some((a)=>a.asset_type==="video"); const price=pricing?.sale_price==null?undefined:Number(pricing.sale_price);
 const score=scoreListing({marketplace:"shopee",title,categoryId:currentListing?.marketplace_category_id??currentListing?.category??undefined,description,keywords,attributes,imageCount,hasVideo,price,stock:product.stock??undefined,sku:product.sku??undefined,ean:product.ean??undefined,weightKg:product.weight_kg??undefined,dimensions:{widthCm:product.width_cm??undefined,heightCm:product.height_cm??undefined,lengthCm:product.length_cm??undefined}});
 const listingPayload={product_id:productId,marketplace:"shopee",title,description,keywords,attributes,publication_status:"draft",listing_score:score.total,conversion_score:score.total,seo_score:Math.round((score.title.score+score.attributes.score+score.completeness.score)/3),content_score:Math.round((score.title.score+score.description.score+score.attributes.score)/3),title_score:score.title.score,attribute_score:score.attributes.score,description_score:score.description.score,media_score:score.media.score,offer_score:score.offer.score,trust_score:score.trust.score,completeness_score:score.completeness.score,score_breakdown:score,optimization_notes:{blockers:score.blockers,recommendations:score.recommendations,evidencePolicy:"confirmed-only-copy"},marketplace_rules_version:SHOPEE_BR_PROFILE.version,optimization_version:"shopee-conversion-v3",last_optimized_at:new Date().toISOString(),updated_at:new Date().toISOString()};
 const result=currentListing?await supabase.from("listings").update(listingPayload).eq("id",currentListing.id):await supabase.from("listings").insert(listingPayload); if(result.error) redirect(`/products/${productId}?error=${encodeURIComponent(result.error.message)}`);
 const nextStatus=score.blockers.length===0&&score.completeness.score>=90?"ready":"needs_review"; const productUpdate=await supabase.from("products").update({wjr_score:score.total,status:nextStatus,updated_at:new Date().toISOString()}).eq("id",productId); if(productUpdate.error) redirect(`/products/${productId}?error=${encodeURIComponent(productUpdate.error.message)}`);
 revalidatePath(`/products/${productId}`); revalidatePath(`/products/${productId}/package`); revalidatePath(`/products/${productId}/readiness`); revalidatePath("/products");
}
