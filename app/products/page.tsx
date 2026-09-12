import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProductsPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");

  const { data: products } = await supabase
    .from("products")
    .select("id,name,supplier,sku,cost,stock,status,wjr_score,updated_at")
    .order("updated_at", { ascending: false });

  return <main className="studioPage">
    <div className="listHeader"><div><div className="eyebrow">Catálogo central</div><h1>Meus Produtos</h1><p>Uma base única para criar e evoluir anúncios em diferentes marketplaces.</p></div><a className="button primary" href="/studio/new">+ Novo produto</a></div>
    <div className="productList">
      {products?.length ? products.map((p) => <a className="productRow" href={`/products/${p.id}`} key={p.id}>
        <div><strong>{p.name}</strong><span>{p.supplier || "Fornecedor não informado"} · {p.sku || "SKU pendente"}</span></div>
        <div className="rowMetric"><span>Status</span><b>{String(p.status).replaceAll("_", " ")}</b></div>
        <div className="rowMetric"><span>Estoque</span><b>{p.stock ?? "—"}</b></div>
        <div className="rowMetric"><span>Score</span><b className="greenText">{p.wjr_score ?? "—"}</b></div>
      </a>) : <div className="emptyState"><h2>Seu catálogo começa aqui.</h2><p>Cadastre o primeiro produto e o WJR Seller começa a construir a inteligência do anúncio.</p><a className="button primary" href="/studio/new">Cadastrar produto</a></div>}
    </div>
  </main>;
}
