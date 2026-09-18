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
  const media = assets ?? [];
  const source = product.source_data && typeof product.source_data === "object" ? (product.source_data as Record<string, any>) : {};
  const specs = source.product_specs && typeof source.product_specs === "object" ? source.product_specs : {};
  // Same inputs as the preview page, or the two screens disagree on the percentage.
  const readiness = getShopeePublicationReadiness({
    cost: product.cost, stock: product.stock, sku: product.sku, ean: product.ean,
    weightKg: product.weight_kg, widthCm: product.width_cm, heightCm: product.height_cm, lengthCm: product.length_cm,
    productWeightKg: specs.weight_kg, productWidthCm: specs.width_cm, productHeightCm: specs.height_cm, productLengthCm: specs.length_cm,
    supplierDescription: source.supplier_description,
    hasMarketEvidence: !!analysis, hasPricing: !!pricing, category: listing?.category, attributeCount: attributes,
    imageCount: media.filter((asset) => asset.asset_type === "image").length,
    hasVideo: media.some((asset) => asset.asset_type === "video"),
    listingScore: listing?.listing_score, scoreBlockers: (listing?.score_breakdown as { blockers?: string[] } | null)?.blockers ?? [],
  });
  const blockers = readiness.steps.filter((step) => step.blocking);

  return <main className="main studioPage">
    <div className="crumbs"><a href={`/products/${id}/review`}>Prévia do anúncio</a><span>/</span><span>Diagnóstico completo</span></div>
    <div className="studioHeader">
      <div>
        <div className="eyebrow">Diagnóstico de publicação · Shopee</div>
        <h1>{readiness.ready ? "Produto pronto para revisão final" : "Preparando anúncio para publicação"}</h1>
        <p>{readiness.completed} de {readiness.total} verificações obrigatórias concluídas.</p>
      </div>
      <div className="scoreBadge"><span>Prontidão</span><strong>{readiness.percentage}%</strong><small>{readiness.ready ? "pronto" : "em preparação"}</small></div>
    </div>
    <section className="formSection">
      <div className="sectionTitle">
        <div><div className="eyebrow">Checklist detalhado</div><h2>O que realmente pode bloquear</h2></div>
        <span className={`statusChip ${readiness.ready ? "done" : ""}`}>{readiness.ready ? "Pronto" : `${readiness.total - readiness.completed} pendência(s)`}</span>
      </div>
      <div className="checkList">{blockers.map((step) => <div className={step.ready ? "check ok" : "check"} key={step.key}><span>{step.ready ? "✓" : "!"}</span><div><b>{step.label}</b><small>{step.detail}</small></div></div>)}</div>
      <div className="formActions"><a className="button" href={`/products/${id}/review`}>← Voltar à prévia</a></div>
    </section>
  </main>;
}
