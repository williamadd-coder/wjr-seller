import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getShopeePublicationReadiness } from "@/lib/marketplaces/shopee/readiness";

export default async function ReadinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");

  const [{ data: product }, { data: analysis }, { data: listing }, { data: pricing }, { data: assets }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).single(),
    supabase.from("market_analyses").select("id").eq("product_id", id).eq("marketplace", "shopee").limit(1).maybeSingle(),
    supabase.from("listings").select("*").eq("product_id", id).eq("marketplace", "shopee").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("pricing_scenarios").select("id").eq("product_id", id).eq("marketplace", "shopee").eq("is_recommended", true).limit(1).maybeSingle(),
    supabase.from("product_assets").select("asset_type").eq("product_id", id).eq("marketplace", "shopee"),
  ]);
  if (!product) notFound();

  const attributes = listing?.attributes && typeof listing.attributes === "object" ? Object.keys(listing.attributes).length : 0;
  const scoreBreakdown = listing?.score_breakdown as { blockers?: string[] } | null;
  const media = assets ?? [];
  const readiness = getShopeePublicationReadiness({
    cost: product.cost,
    stock: product.stock,
    sku: product.sku,
    ean: product.ean,
    weightKg: product.weight_kg,
    widthCm: product.width_cm,
    heightCm: product.height_cm,
    lengthCm: product.length_cm,
    hasMarketEvidence: !!analysis,
    hasPricing: !!pricing,
    category: listing?.category,
    attributeCount: attributes,
    imageCount: media.filter((asset) => asset.asset_type === "image").length,
    hasVideo: media.some((asset) => asset.asset_type === "video"),
    listingScore: listing?.listing_score,
    scoreBlockers: scoreBreakdown?.blockers ?? [],
  });

  return <main className="studioPage">
    <div className="crumbs"><a href="/products">Meus Produtos</a><span>/</span><a href={`/products/${id}`}>{product.name}</a><span>/</span><span>Prontidão</span></div>
    <div className="studioHeader"><div><div className="eyebrow">Checklist de publicação · Shopee</div><h1>{readiness.ready ? "Produto pronto para revisão final" : "Preparando anúncio para publicação"}</h1><p>{readiness.completed} de {readiness.total} etapas concluídas. O WJR Seller IA só libera o status pronto quando os dados necessários estão confirmados.</p></div><div className="scoreBadge"><span>Prontidão</span><strong>{readiness.percentage}%</strong><small>{readiness.ready ? "pronto" : "em preparação"}</small></div></div>
    <section className="formSection"><div className="sectionTitle"><div><div className="eyebrow">Visão ponta a ponta</div><h2>O que falta para o Pacote Final</h2></div><span className={`statusChip ${readiness.ready ? "done" : ""}`}>{readiness.ready ? "Pronto" : `${readiness.total - readiness.completed} pendência(s)`}</span></div>
      <div className="checkList">{readiness.steps.map((step) => <div className={step.ready ? "check ok" : "check"} key={step.key}><span>{step.ready ? "✓" : "!"}</span><div><b>{step.label}</b><small>{step.detail}</small></div></div>)}</div>
      <div className="formActions"><a className="button" href={`/products/${id}`}>← Voltar ao Seller Studio</a><a className="button primary" href={`/products/${id}/package`}>{readiness.ready ? "Revisar Pacote Final Shopee →" : "Ver Pacote Final e pendências →"}</a></div>
    </section>
  </main>;
}
