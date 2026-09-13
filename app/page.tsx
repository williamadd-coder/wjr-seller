import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./actions";

const scorePillars = [
  ["Título", "Busca + clareza + intenção"], ["Atributos", "Categoria completa e estruturada"], ["Mídia", "Capa, benefícios, prova visual e vídeo"], ["Oferta", "Preço, estoque e competitividade"], ["Confiança", "SKU, EAN e logística consistente"], ["Conversão", "Métricas reais para aprender e melhorar"],
];

export default async function Home() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");

  const [{ count: productCount }, { data: products }, { data: listings }] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("products").select("id,status,wjr_score").order("updated_at", { ascending: false }),
    supabase.from("listings").select("product_id,listing_score,publication_status").eq("marketplace", "shopee"),
  ]);
  const readyCount = (products ?? []).filter((p) => p.status === "ready" || p.status === "published").length;
  const scores = (listings ?? []).map((l) => l.listing_score).filter((v): v is number => typeof v === "number");
  const averageScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const needsReview = (products ?? []).filter((p) => p.status === "needs_review").length;

  return <div className="shell">
    <aside className="sidebar"><div className="brand">WJR <span>Seller IA</span></div><nav className="nav"><a className="active" href="/">Visão geral</a><a href="/studio/new">Seller Studio</a><a href="/products">Meus Produtos</a><a href="#score">Score WJR</a></nav><form action={logout} className="sidebarLogout"><button className="button" type="submit">Sair</button></form></aside>
    <main className="main"><section className="hero"><div className="eyebrow">Conversion-first commerce intelligence</div><h1>Cadastre para converter. Aprenda com cada venda.</h1><p>O WJR Seller transforma dados confirmados do produto em um cadastro completo e adaptado ao marketplace, mantendo evidências, margem e pendências visíveis antes da publicação.</p><div className="cta"><a className="button primary" href="/studio/new">Otimizar novo produto</a><a className="button" href="/products">Abrir Meus Produtos</a></div></section>
    <section className="grid"><article className="card"><span>Produtos</span><strong>{productCount ?? 0}</strong><p>Base cadastrada na sua conta.</p></article><article className="card"><span>Prontos</span><strong>{readyCount}</strong><p>{needsReview ? `${needsReview} ainda precisam de revisão.` : "Nenhuma pendência crítica registrada."}</p></article><article className="card"><span>Score WJR médio</span><strong>{averageScore ?? "—"}</strong><p>Média dos anúncios Shopee já otimizados.</p></article></section>
    <section className="section" id="studio"><div className="eyebrow">Seller Studio</div><h2>Pipeline de otimização</h2><div className="steps"><div className="step"><b>1. Produto</b><span>Fornecedor, evidências, custo, estoque, SKU, EAN e logística.</span></div><div className="step"><b>2. Mercado + oferta</b><span>Concorrentes observados, faixa de preço, taxas, lucro e margem.</span></div><div className="step"><b>3. Cadastro campeão</b><span>Score, conteúdo, mídia, pendências e Pacote Final Shopee.</span></div></div></section>
    <section className="section" id="score"><div className="eyebrow">Score WJR</div><h2>Não é só preencher campos</h2><div className="scoreGrid">{scorePillars.map(([name, detail]) => <article className="scoreItem" key={name}><b>{name}</b><span>{detail}</span></article>)}</div><p className="note">O score mede qualidade e prontidão do cadastro. Não promete ranking: usa regras versionadas, evidências e, futuramente, performance real para orientar melhorias.</p></section></main>
  </div>;
}
