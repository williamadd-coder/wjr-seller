import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions";
import { optimizeShopee } from "../actions";
import { saveReviewedListing } from "./actions";
import { AutoGenerate } from "./auto-generate";

const money = (value: number | null | undefined) => value == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ generate?: string; error?: string; saved?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");

  const { data: product } = await supabase.from("products").select("*").eq("id", id).single();
  if (!product) notFound();
  const [{ data: analysis }, { data: listing }, { data: pricing }, { data: assets }] = await Promise.all([
    supabase.from("market_analyses").select("*").eq("product_id", id).eq("marketplace", "shopee").order("analyzed_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("listings").select("*").eq("product_id", id).eq("marketplace", "shopee").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("pricing_scenarios").select("*").eq("product_id", id).eq("marketplace", "shopee").eq("is_recommended", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("product_assets").select("*").eq("product_id", id).eq("marketplace", "shopee"),
  ]);

  const attributes = listing?.attributes && typeof listing.attributes === "object" ? Object.keys(listing.attributes).length : 0;
  const images = (assets ?? []).filter((asset) => asset.asset_type === "image").length;
  const blockers: string[] = listing?.score_breakdown?.blockers ?? [];
  const checks = [
    ["Categoria e atributos", !!listing?.category && attributes >= 3],
    ["Preço e margem", !!pricing?.sale_price],
    ["Imagens", images >= 3],
    ["Pacote para envio", !!product.weight_kg && !!product.width_cm && !!product.height_cm && !!product.length_cm],
    ["Score mínimo", Number(listing?.listing_score ?? 0) >= 70 && blockers.length === 0],
  ] as const;
  const readyCount = checks.filter(([, ok]) => ok).length;
  const readiness = Math.round((readyCount / checks.length) * 100);
  const canSave = !!listing && readyCount === checks.length;
  const optimize = optimizeShopee.bind(null, id);
  const save = saveReviewedListing.bind(null, id);

  return <div className="shell">
    <aside className="sidebar"><div className="brand">WJR <span>Seller IA</span></div><nav className="nav"><a href="/">Visão geral</a><a className="active" href="/studio/new">Seller Studio</a><a href="/products">Meus Produtos</a></nav><form action={logout} className="sidebarLogout"><button className="button" type="submit">Sair</button></form></aside>
    <main className="main studioPage">
      <div className="crumbs"><a href="/studio/new">Novo anúncio</a><span>/</span><span>Prévia</span></div>
      <div className="studioHeader"><div><div className="eyebrow">Prévia do anúncio · Shopee</div><h1>{product.name}</h1><p>Revise o anúncio, preço e pendências antes de salvar. O verde significa que os requisitos mínimos do WJR Seller foram atendidos.</p></div><div className="scoreBadge"><span>Score WJR</span><strong>{listing?.listing_score ?? "—"}</strong><small>{readiness}% de prontidão</small></div></div>
      <AutoGenerate productId={id} enabled={query.generate === "1" && !listing} />
      {query.error && <div className="authAlert error">{query.error}</div>}
      {query.saved === "1" && <div className="authAlert">Anúncio salvo em Meus Produtos e marcado como pronto.</div>}

      <section className="formSection"><div className="sectionTitle"><div><div className="eyebrow">Diagnóstico</div><h2>Prontidão para salvar</h2></div><span className={`statusChip ${canSave ? "done" : ""}`}>{canSave ? "Pronto para salvar" : `${readiness}% pronto`}</span></div><div className="checkList">{checks.map(([label, ok]) => <div className={ok ? "check ok" : "check"} key={label}><span>{ok ? "✓" : "!"}</span>{label}</div>)}</div>{blockers.length > 0 && <div className="pendingBox"><b>O que ainda precisa de atenção</b>{blockers.map((item) => <p key={item}>• {item}</p>)}</div>}</section>

      <div className="workspaceGrid"><section className="formSection"><div className="eyebrow">Anúncio sugerido</div><h2>{listing?.title || "Gerando título…"}</h2><p className="note">{listing ? `${listing.title?.length ?? 0}/120 caracteres · ${attributes} atributo(s) confirmado(s)` : "A primeira otimização usa somente evidências confirmadas."}</p>{listing?.description && <div className="previewBlock"><span>Descrição</span><pre>{listing.description}</pre></div>}<div className="formActions"><form action={optimize}><button className="button" type="submit">Recalcular anúncio</button></form><a className="button" href={`/products/${id}`}>Editar detalhes</a></div></section>

      <section className="formSection"><div className="eyebrow">Preço e concorrência</div><h2>{pricing?.sale_price ? money(pricing.sale_price) : "Preço ainda não definido"}</h2>{analysis ? <div className="facts"><div><span>Menor observado</span><b>{money(analysis.price_min)}</b></div><div><span>Mediana</span><b>{money(analysis.price_median)}</b></div><div><span>Maior observado</span><b>{money(analysis.price_max)}</b></div><div><span>Lucro estimado</span><b>{money(pricing?.profit)}</b></div></div> : <p className="note">Ainda não há evidências de concorrência salvas. O sistema não inventa preços de mercado.</p>}<div className="facts"><div><span>Custo</span><b>{money(product.cost)}</b></div><div><span>Preço sugerido</span><b>{money(pricing?.sale_price)}</b></div><div><span>Margem</span><b>{pricing?.margin_pct != null ? `${Number(pricing.margin_pct).toFixed(1)}%` : "—"}</b></div><div><span>Imagens</span><b>{images}</b></div></div><a className="button" href={`/products/${id}`}>Ajustar preço e margem</a></section></div>

      <section className="formSection"><div className="sectionTitle"><div><div className="eyebrow">Decisão final</div><h2>{canSave ? "Cadastro aceitável para salvar" : "Resolva as pendências antes de salvar"}</h2></div></div><p className="note">Salvar não publica automaticamente na Shopee. O anúncio fica organizado em Meus Produtos e o Pacote Final continua disponível para copiar no Seller Center.</p><div className="formActions"><a className="button" href={`/products/${id}/readiness`}>Ver diagnóstico completo</a><a className="button" href={`/products/${id}/package`}>Ver Pacote Final</a>{canSave ? <form action={save}><button className="button primary" type="submit">Salvar anúncio ✓</button></form> : <button className="button" type="button" disabled>Salvar anúncio · pendências</button>}</div></section>
    </main>
  </div>;
}
