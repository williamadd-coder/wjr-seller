import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { optimizeShopee } from "./actions";
import { saveMarketEvidence, savePricingScenario } from "./market/actions";

const money = (value: number | null) => value == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params; const query = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");
  const { data: product } = await supabase.from("products").select("*").eq("id", id).single();
  if (!product) notFound();
  const [{ data: analysis }, { data: listing }, { data: pricing }] = await Promise.all([
    supabase.from("market_analyses").select("*").eq("product_id", id).eq("marketplace", "shopee").order("analyzed_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("listings").select("*").eq("product_id", id).eq("marketplace", "shopee").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("pricing_scenarios").select("*").eq("product_id", id).eq("marketplace", "shopee").eq("is_recommended", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const checks = [["Custo informado", product.cost != null], ["Estoque informado", product.stock != null], ["SKU", !!product.sku], ["EAN", !!product.ean], ["Peso", product.weight_kg != null], ["Dimensões completas", product.width_cm != null && product.height_cm != null && product.length_cm != null]] as const;
  const readiness = Math.round(checks.filter(([, ok]) => ok).length / checks.length * 100);
  const optimize = optimizeShopee.bind(null, id);
  const saveMarket = saveMarketEvidence.bind(null, id);
  const savePricing = savePricingScenario.bind(null, id);
  const scoreBreakdown = listing?.score_breakdown as any;

  return <main className="studioPage">
    <div className="crumbs"><a href="/products">Meus Produtos</a><span>/</span><span>{product.name}</span></div>
    {query.error && <div className="authAlert error">{query.error}</div>}
    <div className="studioHeader"><div><div className="eyebrow">Workspace · Shopee</div><h1>{product.name}</h1><p>{product.supplier || "Fornecedor pendente"} · SKU {product.sku || "pendente"} · EAN {product.ean || "pendente"}</p></div><div className="scoreBadge"><span>Score WJR</span><strong>{listing?.listing_score ?? product.wjr_score ?? "—"}</strong><small>qualidade do cadastro</small></div></div>

    <div className="workspaceGrid"><section className="formSection"><div className="sectionTitle"><div><div className="eyebrow">Etapa 1</div><h2>Base do produto</h2></div><span className="progressLabel">{readiness}% pronta</span></div><div className="facts"><div><span>Custo</span><b>{money(product.cost)}</b></div><div><span>Estoque</span><b>{product.stock ?? "—"}</b></div><div><span>Peso</span><b>{product.weight_kg ? `${product.weight_kg} kg` : "—"}</b></div><div><span>Pacote</span><b>{product.width_cm && product.height_cm && product.length_cm ? `${product.width_cm} × ${product.height_cm} × ${product.length_cm} cm` : "—"}</b></div></div><div className="checkList">{checks.map(([label, ok]) => <div className={ok ? "check ok" : "check"} key={label}><span>{ok ? "✓" : "!"}</span>{label}</div>)}</div></section>

    <section className="formSection intelligence"><div className="sectionTitle"><div><div className="eyebrow">Etapa 2</div><h2>Inteligência de mercado</h2></div><span className={`statusChip ${analysis ? "done" : ""}`}>{analysis ? "Com evidência" : "Aguardando"}</span></div>{analysis && <><div className="facts"><div><span>Preço mínimo</span><b>{money(analysis.price_min)}</b></div><div><span>Mediana</span><b>{money(analysis.price_median)}</b></div><div><span>Preço máximo</span><b>{money(analysis.price_max)}</b></div><div><span>Amostra</span><b>{Array.isArray(analysis.competitors) ? analysis.competitors.length : 0} anúncio(s)</b></div></div><p className="note">{analysis.rationale}</p></>}
      <form action={saveMarket} className="evidenceForm"><p className="note">Cole anúncios concorrentes observados. O WJR Seller calcula a faixa somente a partir desses dados; não inventa preços ou vendas.</p>{[1,2,3].map((n)=><div className="evidenceRow" key={n}><input name={`competitor_${n}_title`} placeholder={`Concorrente ${n} · título`} /><input name={`competitor_${n}_url`} placeholder="Link do anúncio" /><input name={`competitor_${n}_price`} inputMode="decimal" placeholder="Preço R$" /></div>)}<button className="button" type="submit">Salvar evidências e analisar</button></form>
    </section></div>

    <section className="formSection pricingPanel"><div className="sectionTitle"><div><div className="eyebrow">Etapa 2.5 · Oferta</div><h2>Preço, lucro e margem</h2></div>{pricing && <span className="statusChip done">Margem {Number(pricing.margin_pct).toFixed(1)}%</span>}</div>{pricing && <div className="facts pricingFacts"><div><span>Preço recomendado</span><b>{money(pricing.sale_price)}</b></div><div><span>Taxa marketplace</span><b>{money(pricing.marketplace_fee)}</b></div><div><span>Lucro</span><b>{money(pricing.profit)}</b></div><div><span>Margem</span><b>{Number(pricing.margin_pct).toFixed(1)}%</b></div></div>}
      <form action={savePricing} className="pricingForm"><label>Preço de venda<input name="sale_price" inputMode="decimal" required placeholder="Ex.: 89,90" /></label><label>Taxa marketplace (%)<input name="marketplace_fee_pct" inputMode="decimal" placeholder="Informe a taxa confirmada" /></label><label>Impostos (%)<input name="taxes_pct" inputMode="decimal" placeholder="0" /></label><label>Outros custos (R$)<input name="other_costs" inputMode="decimal" placeholder="0,00" /></label><button className="button primary" type="submit">Calcular e recomendar cenário</button></form><p className="note">As taxas não são presumidas. Informe o percentual efetivamente aplicável à sua operação/conta para evitar margem fictícia.</p>
    </section>

    <section className="formSection conversionPanel"><div className="sectionTitle"><div><div className="eyebrow">Etapa 3 · Motor de conversão</div><h2>Cadastro otimizado para Shopee</h2></div>{listing && <span className="statusChip done">Score {listing.listing_score}</span>}</div>
      {!listing ? <div className="emptyInline"><p>Gere a primeira versão estruturada usando somente os dados confirmados do produto. Campos sem evidência ficam como pendência, em vez de serem inventados.</p><form action={optimize}><button className="button primary" type="submit">Gerar primeira otimização</button></form></div> : <div className="listingPreview"><div className="previewBlock"><span>Título · {listing.title?.length ?? 0}/120</span><h3>{listing.title}</h3></div><div className="scoreMiniGrid"><div><span>Título</span><b>{listing.title_score ?? "—"}</b></div><div><span>Atributos</span><b>{listing.attribute_score ?? "—"}</b></div><div><span>Descrição</span><b>{listing.description_score ?? "—"}</b></div><div><span>Mídia</span><b>{listing.media_score ?? "—"}</b></div><div><span>Oferta</span><b>{listing.offer_score ?? "—"}</b></div><div><span>Confiança</span><b>{listing.trust_score ?? "—"}</b></div></div><div className="previewBlock"><span>Descrição gerada</span><pre>{listing.description}</pre></div>{scoreBreakdown?.blockers?.length > 0 && <div className="pendingBox"><b>Pendências que impedem um cadastro mais forte</b>{scoreBreakdown.blockers.map((item: string) => <p key={item}>• {item}</p>)}</div>}<div className="formActions"><form action={optimize}><button className="button" type="submit">Recalcular otimização</button></form><a className="button primary" href={`/products/${id}/package`}>Abrir Pacote Final Shopee →</a></div></div>}
    </section>
    <section className="formSection flowSection"><div className="eyebrow">Pipeline de conversão</div><h2>Da evidência ao anúncio pronto</h2><div className="flowSteps"><div className="flowStep active"><b>01</b><span>Produto</span><small>evidências</small></div><div className={`flowStep ${analysis ? "active" : ""}`}><b>02</b><span>Mercado</span><small>concorrência</small></div><div className={`flowStep ${listing ? "active" : ""}`}><b>03</b><span>Conversão</span><small>conteúdo + oferta</small></div><div className={`flowStep ${listing ? "active" : ""}`}><b>04</b><span>Pacote final</span><small>Shopee</small></div></div></section>
  </main>;
}
