"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const number = (value: FormDataEntryValue | null) => {
  if (value == null || String(value).trim() === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

export async function saveMarketEvidence(productId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");

  const rows = [1, 2, 3].map((index) => ({
    title: String(formData.get(`competitor_${index}_title`) ?? "").trim(),
    url: String(formData.get(`competitor_${index}_url`) ?? "").trim(),
    price: number(formData.get(`competitor_${index}_price`)),
  })).filter((item) => item.title || item.url || item.price != null);

  const prices = rows.map((item) => item.price).filter((value): value is number => value != null && value > 0).sort((a, b) => a - b);
  const median = prices.length ? (prices.length % 2 ? prices[(prices.length - 1) / 2] : (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2) : null;
  const rationale = prices.length
    ? `Faixa calculada com ${prices.length} preço(s) concorrente(s) informado(s) e mantidos como evidência rastreável.`
    : "Concorrentes registrados sem preços suficientes para calcular uma faixa de mercado.";

  const { error } = await supabase.from("market_analyses").insert({
    product_id: productId,
    marketplace: "shopee",
    competitors: rows,
    price_min: prices[0] ?? null,
    price_median: median,
    price_max: prices[prices.length - 1] ?? null,
    rationale,
    source: "seller_studio_manual_evidence",
    search_terms: [],
    competitor_patterns: { sample_size: rows.length, priced_sample_size: prices.length },
    conversion_insights: [],
  });
  if (error) redirect(`/products/${productId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/products/${productId}`);
}

export async function savePricingScenario(productId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");
  const { data: product } = await supabase.from("products").select("cost").eq("id", productId).single();
  if (!product) redirect("/products");

  const salePrice = number(formData.get("sale_price"));
  const feePct = number(formData.get("marketplace_fee_pct")) ?? 0;
  const taxesPct = number(formData.get("taxes_pct")) ?? 0;
  const otherCosts = number(formData.get("other_costs")) ?? 0;
  const cost = product.cost == null ? null : Number(product.cost);
  if (!salePrice || salePrice <= 0 || cost == null) redirect(`/products/${productId}?error=${encodeURIComponent("Informe custo e preço de venda válidos para calcular a margem.")}`);

  const marketplaceFee = salePrice * feePct / 100;
  const taxes = salePrice * taxesPct / 100;
  const profit = salePrice - cost - marketplaceFee - taxes - otherCosts;
  const marginPct = salePrice > 0 ? profit / salePrice * 100 : 0;

  await supabase.from("pricing_scenarios").update({ is_recommended: false }).eq("product_id", productId).eq("marketplace", "shopee");
  const { error } = await supabase.from("pricing_scenarios").insert({
    product_id: productId,
    marketplace: "shopee",
    sale_price: salePrice,
    product_cost: cost,
    marketplace_fee: marketplaceFee,
    taxes,
    other_costs: otherCosts,
    profit,
    margin_pct: marginPct,
    is_recommended: true,
  });
  if (error) redirect(`/products/${productId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/products/${productId}`);
  revalidatePath(`/products/${productId}/package`);
}
