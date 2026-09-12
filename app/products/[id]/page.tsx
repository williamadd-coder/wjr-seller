import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { optimizeShopee } from "./actions";

const money = (value: number | null) => value == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params; const query = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");
  const { data: product } = await supabase.from("products").select("*").eq("id", id).single();
  if (!product) notFound();
  const { data: analysis } = await supabase.from("market_analyses").select("*").eq("product_id", id).eq("marketplace", "shopee").order("analyzed_at", { ascending: false }).limit(1).maybeSingle();
  const { data: listing } = await supabase.from("listings").select("*").eq("product_id", id).eq("marketplace", "shopee").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  const checks = [["Custo informado", product.cost != null], ["Estoque informado", product.stock != null], ["SKU", !!product.sku], ["EAN", !!product.ean], ["Peso", product.weight_kg != null], ["Dimensões completas", product.width_cm != null && product.height_cm != null && product.length_cm != null]] as const;
  const readiness = Math.round(checks.filter(([, ok]) => ok).length / checks.length * 100);
  const optimize = optimizeShopee.bind(null, id);
  const scoreBreakdown = listing?.score_breakdown as any;

  return <main className="studioPage">
    <div className="crumbs"><a href="/products">Meus Produtos</a><span>/</span><span>{product.name}</span></div>
    {query.error && <div className="authAlert error">{query.error}</div>}
    <div className="studioHeader"><div><div className="eyebrow">Workspace · Shopee</div><h1>{product.name}</h1><p>{product.supplier || "Fornecedor pendente"} · SKU {product.sku || "pendente"} · EAN {product.ean || "pendente"}</p></div><div className="scoreBadge"><span>Score WJR</span><strong>{listing?.listing_score ?? product.wjr_score ?? "—"}</strong><small>qualidade do cadastro</small></div></div>
    <div className="workspaceGrid"><section className="formSection"><div className="sectionTitle"><div><div className="eyebrow">Etapa 1</div><h2>Base do produto</h2></div><span className="progressLabel">{readiness}% pronta</span></div><div className="facts"><div><span>Custo</span><b>{money(product.cost)}</b></div><div><span>Estoque</span><b>{product.stock ?? "—"}</b></div><div><span>Peso</span><b>{product.weight_kg ? `${product.weight_kg} kg` : "—"}</b></div><div><span>Pacote</span><b>{product.width_cm && product.height_cm && product.length_cm ? `${product.width_cm} × ${product.height_cm} × ${product.length_cm} cm` : "—"}</b></div></div><div className="checkList">{checks.map(([label, ok]) => <div className={ok ? "check ok" : "check"} key={label}><span>{ok ? "✓" : "!"}</span>{label}</div>)}</div></section>
    <section className="formSection intelligence"><div className="sectionTitle"><div><div className="eyebrow">Etapa 2</div><h2>Inteligência de mercado</h2></div><span className={`statusChip ${analysis ? "done" : ""}`}>{analysis ? "Analisado" : "Aguardando pesquisa"}</span></div>{analysis ? <><div className="facts"><div><span>Preço mínimo</span><b>{money(analysis.price_min)}</b></div><div><span>Mediana</span><b>{money(analysis.price_median)}</b></div><div><span>Preço máximo</span><b>{money(analysis.price_max)}</b></div></div><p className="note">{analysis.rationale || "Análise registrada."}</p></> : <p className="note">A análise competitiva será preenchida apenas com evidência de mercado. O sistema não inventa preço, demanda ou concorrentes.</p>}</section></div>
    <section className="formSection conversionPanel"><div className="sectionTitle"><div><div className="eyebrow">Etapa 3 · Motor de conversão</div><h2>Cadastro otimizado para Shopee</h2></div>{listing && <span className="statusChip done">Score {listing.listing_score}</span>}</div>
      {!listing ? <div className="emptyInline"><p>Gere a primeira versão estruturada usando somente os dados confirmados do produto. Campos sem evidência ficam como pendência, em vez de serem inventados.</p><form action={optimize}><button className="button primary" type="submit">Gerar primeira otimização</button></form></div> : <div className="listingPreview"><div className="previewBlock"><span>Título · {listing.title?.length ?? 0}/120</span><h3>{listing.title}</h3></div><div className="scoreMiniGrid"><div><span>Título</span><b>{listing.title_score ?? "—"}</b></div><div><span>Atributos</span><b>{listing.attribute_score ?? "—"}</b></div><div><span>Descrição</span><b>{listing.description_score ?? "—"}</b></div><div><span>Mídia</span><b>{listing.media_score ?? "—"}</b></div><div><span>Oferta</span><b>{listing.offer_score ?? "—"}</b></div><div><span>Confiança</span><b>{listing.trust_score ?? "—"}</b></div></div><div className="previewBlock"><span>Descrição gerada</span><pre>{listing.description}</pre></div>{scoreBreakdown?.blockers?.length > 0 && <div className="pendingBox"><b>Pendências que impedem um cadastro mais forte</b>{scoreBreakdown.blockers.map((item: string) => <p key={item}>• {item}</p>)}</div>}<form action={optimize}><button className="button" type="submit">Recalcular otimização</button></form></div>}
    </section>
    <section className="formSection flowSection"><div className="eyebrow">Pipeline de conversão</div><h2>Da evidência ao anúncio pronto</h2><div className="flowSteps"><div className="flowStep active"><b>01</b><span>Produto</span><small>evidências</small></div><div className={`flowStep ${analysis ? "active" : ""}`}><b>02</b><span>Mercado</span><small>concorrência</small></div><div className={`flowStep ${listing ? "active" : ""}`}><b>03</b><span>Conversão</span><small>conteúdo + oferta</small></div><div className="flowStep"><b>04</b><span>Pacote final</span><small>Shopee</small></div></div></section>
  </main>;
}
