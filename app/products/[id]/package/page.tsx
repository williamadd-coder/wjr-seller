import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildShopeeFinalPackage } from "@/lib/marketplaces/shopee/package";
import { CopyButton } from "./copy-button";

const display = (value: any) => typeof value === "number" ? String(value).replace(".", ",") : String(value ?? "PENDENTE");

export default async function FinalPackagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");

  const { data: product } = await supabase.from("products").select("*").eq("id", id).single();
  if (!product) notFound();
  const { data: listing } = await supabase.from("listings").select("*").eq("product_id", id).eq("marketplace", "shopee").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (!listing) redirect(`/products/${id}?error=${encodeURIComponent("Gere a otimização antes do pacote final")}`);
  const { data: analysis } = await supabase.from("market_analyses").select("*").eq("product_id", id).eq("marketplace", "shopee").order("analyzed_at", { ascending: false }).limit(1).maybeSingle();
  const { data: pricing } = await supabase.from("pricing_scenarios").select("*").eq("product_id", id).eq("marketplace", "shopee").eq("is_recommended", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data: assets } = await supabase.from("product_assets").select("*").eq("product_id", id).eq("marketplace", "shopee").order("created_at", { ascending: true });
  const pack = buildShopeeFinalPackage(product, listing, analysis, pricing, assets ?? []);
  const completePackage = pack.fields.map(([label, value]) => `${label}:\n${display(value)}`).join("\n\n");

  return <main className="studioPage">
    <div className="crumbs"><a href={`/products/${id}`}>{product.name}</a><span>/</span><span>Pacote Final Shopee</span></div>
    <div className="studioHeader"><div><div className="eyebrow">Etapa 4 · Publicação manual</div><h1>Pacote Final para cadastrar na Shopee</h1><p>Informações organizadas para copiar e preencher o anúncio. Campos sem evidência permanecem marcados como pendentes.</p></div><div className="scoreBadge"><span>Prontidão</span><strong>{pack.ready ? "100%" : "—"}</strong><small>{pack.ready ? "pronto para revisão" : `${pack.pending.length} pendência(s)`}</small></div></div>
    <section className="formSection packageSection"><div className="sectionTitle"><div><div className="eyebrow">Ordem de cadastro</div><h2>Dados do anúncio</h2></div><div className="packageActions"><span className={`statusChip ${pack.ready ? "done" : ""}`}>{pack.ready ? "Pronto" : "Em preparação"}</span><CopyButton value={completePackage} label="Copiar pacote completo" /></div></div><div className="packageFields">{pack.fields.map(([label, value]) => { const text = display(value); return <div className="packageField" key={String(label)}><div className="packageFieldHead"><span>{label}</span><CopyButton value={text} /></div><div>{text}</div></div> })}</div></section>
    <div className="workspaceGrid"><section className="formSection"><div className="eyebrow">Mídia</div><h2>Imagens e vídeo</h2><div className="facts"><div><span>Imagens</span><b>{pack.media.images.length}</b></div><div><span>Vídeos</span><b>{pack.media.videos.length}</b></div></div><p className="note">As imagens do pacote devem ser próprias para marketplace, quadradas e com arquivo abaixo de 2 MB. O vídeo deve demonstrar movimento/uso real quando aplicável.</p></section><section className="formSection"><div className="eyebrow">Revisão final</div><h2>Pendências</h2>{pack.pending.length ? <div className="pendingBox">{pack.pending.map((item) => <p key={item}>• {item}</p>)}</div> : <p className="note">Nenhuma pendência estrutural detectada. Faça a revisão humana final antes de publicar.</p>}</section></div>
  </main>;
}
