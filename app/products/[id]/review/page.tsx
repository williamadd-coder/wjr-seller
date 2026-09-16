import { ResearchPanel } from "./research-panel";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { optimizeShopee } from "../actions";
import { updateListingContent } from "./actions";
import { AutoGenerate } from "./auto-generate";
import { AttributesEditor } from "./attributes-editor";
import { getShopeePublicationReadiness } from "@/lib/marketplaces/shopee/readiness";
import { buildShopeeIntelligencePlan } from "@/lib/marketplaces/shopee/intelligence";

const BUCKET = "product-media";
const money = (v: number | null | undefined) => v == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ generate?: string; error?: string; saved?: string; updated?: string }> }) {
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

  const attrs = listing?.attributes && typeof listing.attributes === "object" ? (listing.attributes as Record<string, string>) : {};
  const attrKeys = Object.keys(attrs);
  const images = (assets ?? []).filter((a) => a.asset_type === "image");
  const imageCount = images.length;
  const source = product.source_data && typeof product.source_data === "object" ? (product.source_data as Record<string, any>) : {};
  const specs = source.product_specs && typeof source.product_specs === "object" ? source.product_specs : {};
  const intelligence = buildShopeeIntelligencePlan({ name: product.name, brand: product.brand, model: product.model, supplierDescription: source.supplier_description });
  const readiness = getShopeePublicationReadiness({ cost: product.cost, stock: product.stock, sku: product.sku, ean: product.ean, weightKg: product.weight_kg, widthCm: product.width_cm, heightCm: product.height_cm, lengthCm: product.length_cm, productWeightKg: specs.weight_kg, productWidthCm: specs.width_cm, productHeightCm: specs.height_cm, productLengthCm: specs.length_cm, supplierDescription: source.supplier_description, hasMarketEvidence: !!analysis, hasPricing: !!pricing, category: listing?.category, attributeCount: attrKeys.length, imageCount, hasVideo: (assets ?? []).some((a) => a.asset_type === "video"), listingScore: listing?.listing_score, scoreBlockers: listing?.score_breakdown?.blockers ?? [] });
  const missingLabels = readiness.steps.filter((s) => s.blocking && !s.ready).map((s) => s.label);

  const signedImages = await Promise.all(images.map(async (asset) => {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(asset.storage_path, 3600);
    return { id: asset.id, url: data?.signedUrl ?? null, name: asset.metadata?.name ?? "Imagem do produto" };
  }));

  const update = updateListingContent.bind(null, id);
  const optimize = optimizeShopee.bind(null, id);

  return <main className="main studioPage">
    <div className="crumbs"><a href="/products">Anúncios</a><span>/</span><span>Prévia</span></div>
    <div className="studioHeader">
      <div><div className="eyebrow">Prévia do anúncio · Shopee</div><h1>Prévia do Anúncio Otimizado</h1><p>Revise e ajuste o que a IA preparou. As alterações são salvas no anúncio quando você clica em Salvar Rascunho ou Publicar Anúncio.</p></div>
      <div className="reviewHeaderActions">
        <button form="listingForm" name="intent" value="draft" className="button" type="submit">Salvar Rascunho</button>
        <button form="listingForm" name="intent" value="publish" className="button primary" type="submit">Publicar Anúncio</button>
      </div>
    </div>
    <AutoGenerate productId={id} enabled={query.generate === "1" && !listing} />
    {query.error && <div className="authAlert error">{query.error}</div>}
    {query.updated === "1" && <div className="authAlert">Alterações salvas.</div>}
    {query.saved === "1" && <div className="authAlert">Anúncio publicado.</div>}

    <section className="formSection">
      <div className="sectionTitle"><div><div className="eyebrow">Percentual de Prontidão</div></div><span className="progressLabel">{readiness.percentage}%</span></div>
      <div className="progressTrack"><div className="progressFill" style={{ width: `${readiness.percentage}%` }} /></div>
      {missingLabels.length > 0
        ? <p className="note">Campos obrigatórios faltantes: {missingLabels.join(", ")} · <a href={`/products/${id}/readiness`}>Entender preparação</a></p>
        : <p className="note">Todas as etapas obrigatórias estão concluídas. <a href={`/products/${id}/readiness`}>Ver diagnóstico completo</a></p>}
    </section>

    <form id="listingForm" action={update}>
      <div className="workspaceGrid reviewGrid">
        <div className="reviewMain">
          <section className="formSection">
            <div className="eyebrow">Título Melhorado</div>
            <label className="fieldLabel">Título Original</label>
            <div className="previewBlock readOnly">{product.name}</div>
            <label className="fieldLabel">Título Otimizado (edite se necessário)</label>
            <input name="title" defaultValue={listing?.title ?? ""} maxLength={120} placeholder="Gere o anúncio para preencher automaticamente" />
          </section>

          <section className="formSection">
            <div className="eyebrow">Descrição Melhorada</div>
            <label className="fieldLabel">Descrição Original</label>
            <div className="previewBlock readOnly"><pre>{source.supplier_description || "Sem descrição original informada pelo fornecedor."}</pre></div>
            <label className="fieldLabel">Descrição Otimizada (edite se necessário)</label>
            <textarea name="description" defaultValue={listing?.description ?? ""} rows={10} placeholder="Gere o anúncio para preencher automaticamente" />
          </section>

          <section className="formSection">
            <div className="eyebrow">Atributos da Categoria</div>
            <p className="note">Atributos confirmados do anúncio. A sugestão automática dos atributos que a Shopee exige por categoria é a próxima etapa (pesquisa de categoria).</p>
            <AttributesEditor initial={attrs} />
          </section>

          <section className="formSection">
            <div className="sectionTitle"><div className="eyebrow">Imagens Melhoradas</div><span className="statusChip">{imageCount} imagem(ns)</span></div>
            <p className="note">Geração de imagens e vídeo otimizados para conversão pela IA: em breve. Por enquanto, veja as imagens originais enviadas na primeira etapa.</p>
            {imageCount > 0
              ? <div className="imageGrid">{signedImages.map((img) => <div className="imageCardWrap" key={img.id}>
                  <div className="imageSlot filled">{img.url && <img src={img.url} alt={img.name} />}</div>
                  <div className="imageCardMeta"><span>Original</span><span className="statusChip">Aguardando revisão</span></div>
                  <button type="button" className="button compact" disabled title="Geração de imagem por IA: em breve">Melhorar</button>
                </div>)}</div>
              : <p className="note">Nenhuma imagem enviada ainda. <a href={`/products/${id}`}>Adicionar imagens</a></p>}
          </section>

          <div className="formActions">
            <button className="button" type="submit" name="intent" value="draft">Salvar Rascunho</button>
            <button className="button primary" type="submit" name="intent" value="publish">Publicar Anúncio</button>
          </div>
        </div>

        <div className="reviewSidebar">
          <section className="formSection">
            <div className="eyebrow">Categoria Sugerida</div>
            <label className="fieldLabel">Categoria</label>
            <input name="category" defaultValue={listing?.category ?? ""} placeholder="Ex.: Roupas > Camisetas" />
          </section>

          <section className="formSection">
            <div className="eyebrow">Sugestão de Preço e Margens</div>
            <div className="facts">
              <div><span>Preço Sugerido</span><b>{money(pricing?.sale_price)}</b></div>
              <div><span>Preço Concorrência (mín)</span><b>{money(analysis?.price_min)}</b></div>
              <div><span>Preço Concorrência (máx)</span><b>{money(analysis?.price_max)}</b></div>
              <div><span>Margem</span><b>{pricing?.margin_pct != null ? `${Number(pricing.margin_pct).toFixed(1)}%` : "—"}</b></div>
            </div>
            <a className="button compact" href={`/products/${id}`}>Editar preço</a>
          </section>

          <section className="formSection">
            <div className="eyebrow">Resumo da Otimização</div>
            <div className="summaryStats">
              <div><span>Título otimizado</span><b>{listing?.keywords?.length ?? 0} palavra(s)-chave detectada(s)</b></div>
              <div><span>Descrição completa</span><b>{attrKeys.length} atributo(s) preenchido(s)</b></div>
              <div><span>Imagens</span><b>{imageCount} imagem(ns) processada(s)</b></div>
            </div>
          </section>
        </div>
      </div>
    </form>

    <ResearchPanel productId={id} analysis={analysis} attempt={listing?.optimization_notes?.publicResearchAttempt} terms={intelligence.searchTerms} />

    <section className="formSection">
      <div className="sectionTitle"><div><div className="eyebrow">Regerar com IA</div><h2>Recalcular do zero</h2></div></div>
      <p className="note">Substitui título, descrição, atributos e preço pelas evidências do produto, descartando as edições manuais feitas acima.</p>
      <form action={optimize}><button className="button" type="submit">Recalcular anúncio</button></form>
    </section>
  </main>;
}
