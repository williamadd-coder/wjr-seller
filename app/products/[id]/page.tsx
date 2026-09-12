import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const money = (value: number | null) => value == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");

  const { data: product } = await supabase.from("products").select("*").eq("id", id).single();
  if (!product) notFound();
  const { data: analysis } = await supabase.from("market_analyses").select("*").eq("product_id", id).eq("marketplace", "shopee").order("analyzed_at", { ascending: false }).limit(1).maybeSingle();
  const { data: listing } = await supabase.from("listings").select("*").eq("product_id", id).eq("marketplace", "shopee").order("updated_at", { ascending: false }).limit(1).maybeSingle();

  const checks = [
    ["Custo informado", product.cost != null], ["Estoque informado", product.stock != null], ["SKU", !!product.sku], ["EAN", !!product.ean],
    ["Peso", product.weight_kg != null], ["Dimensões completas", product.width_cm != null && product.height_cm != null && product.length_cm != null],
  ] as const;
  const readiness = Math.round(checks.filter(([, ok]) => ok).length / checks.length * 100);

  return <main className="studioPage">
    <div className="crumbs"><a href="/products">Meus Produtos</a><span>/</span><span>{product.name}</span></div>
    <div className="studioHeader"><div><div className="eyebrow">Workspace · Shopee</div><h1>{product.name}</h1><p>{product.supplier || "Fornecedor pendente"} · SKU {product.sku || "pendente"} · EAN {product.ean || "pendente"}</p></div><div className="scoreBadge"><span>Score WJR</span><strong>{listing?.listing_score ?? product.wjr_score ?? "—"}</strong><small>qualidade do cadastro</small></div></div>
    <div className="workspaceGrid">
      <section className="formSection"><div className="sectionTitle"><div><div className="eyebrow">Etapa 1</div><h2>Base do produto</h2></div><span className="progressLabel">{readiness}% pronta</span></div><div className="facts"><div><span>Custo</span><b>{money(product.cost)}</b></div><div><span>Estoque</span><b>{product.stock ?? "—"}</b></div><div><span>Peso</span><b>{product.weight_kg ? `${product.weight_kg} kg` : "—"}</b></div><div><span>Pacote</span><b>{product.width_cm && product.height_cm && product.length_cm ? `${product.width_cm} × ${product.height_cm} × ${product.length_cm} cm` : "—"}</b></div></div><div className="checkList">{checks.map(([label, ok]) => <div className={ok ? "check ok" : "check"} key={label}><span>{ok ? "✓" : "!"}</span>{label}</div>)}</div></section>
      <section className="formSection intelligence"><div className="sectionTitle"><div><div className="eyebrow">Etapa 2</div><h2>Inteligência de mercado</h2></div><span className={`statusChip ${analysis ? "done" : ""}`}>{analysis ? "Analisado" : "Pendente"}</span></div>{analysis ? <><div className="facts"><div><span>Preço mínimo</span><b>{money(analysis.price_min)}</b></div><div><span>Mediana</span><b>{money(analysis.price_median)}</b></div><div><span>Preço máximo</span><b>{money(analysis.price_max)}</b></div></div><p className="note">{analysis.rationale || "Análise registrada. Use os sinais de mercado para orientar a oferta e o conteúdo."}</p></> : <div className="emptyInline"><p>A próxima análise vai cruzar categoria, termos de busca, concorrentes, preços e padrões observáveis de conversão.</p><button className="button primary" disabled>Analisar mercado · próxima entrega</button></div>}</section>
    </div>
    <section className="formSection flowSection"><div className="eyebrow">Pipeline de conversão</div><h2>Da evidência ao anúncio pronto</h2><div className="flowSteps"><div className="flowStep active"><b>01</b><span>Produto</span><small>evidências</small></div><div className="flowStep"><b>02</b><span>Mercado</span><small>concorrência</small></div><div className="flowStep"><b>03</b><span>Conversão</span><small>conteúdo + oferta</small></div><div className="flowStep"><b>04</b><span>Pacote final</span><small>Shopee</small></div></div></section>
  </main>;
}
