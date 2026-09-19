import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { optimizeShopee } from "../actions";
import { updateListingContent } from "./actions";
import { analyzeProductImages, startShopeeResearch } from "./ai-actions";
import { AutoGenerate } from "./auto-generate";
import { ResearchPoller } from "./research-poller";
import { AttributesEditor } from "./attributes-editor";
import { AiActionButton } from "./ai-buttons";
import { getShopeePublicationReadiness } from "@/lib/marketplaces/shopee/readiness";

const BUCKET = "product-media";
const money = (v: number | null | undefined) => v == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ generate?: string; error?: string; saved?: string; updated?: string; analyzed?: string; researching?: string }> }) {
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
  const readiness = getShopeePublicationReadiness({ cost: product.cost, stock: product.stock, sku: product.sku, ean: product.ean, weightKg: product.weight_kg, widthCm: product.width_cm, heightCm: product.height_cm, lengthCm: product.length_cm, productWeightKg: specs.weight_kg, productWidthCm: specs.width_cm, productHeightCm: specs.height_cm, productLengthCm: specs.length_cm, supplierDescription: source.supplier_description, hasMarketEvidence: !!analysis, hasPricing: !!pricing, category: listing?.category, attributeCount: attrKeys.length, imageCount, hasVideo: (assets ?? []).some((a) => a.asset_type === "video"), listingScore: listing?.listing_score, scoreBlockers: listing?.score_breakdown?.blockers ?? [] });
  const missingLabels = readiness.steps.filter((s) => s.blocking && !s.ready).map((s) => s.label);

  const signedImages = await Promise.all(images.map(async (asset) => {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(asset.storage_path, 3600);
    return { id: asset.id, url: data?.signedUrl ?? null, name: asset.metadata?.name ?? "Imagem do produto" };
  }));

  const update = updateListingContent.bind(null, id);
  const optimize = optimizeShopee.bind(null, id);
  const analyzeImages = analyzeProductImages.bind(null, id);
  const startResearch = startShopeeResearch.bind(null, id);
  const aiImagePlan = listing?.optimization_notes?.aiImagePlan;
  const aiResearch = listing?.optimization_notes?.aiMarketResearch;
  const researchPending = aiResearch?.status === "pending";
  const researchDone = !!aiResearch && aiResearch.status !== "pending" && aiResearch.status !== "error";

  return <main className="main studioPage">
    <div className="crumbs"><a href="/products">Anúncios</a><span>/</span><span>Prévia</span></div>
    <div className="studioHeader">
      <div><div className="eyebrow">Prévia do anúncio · Shopee</div><h1>Prévia do Anúncio Otimizado</h1><p>Abaixo está exatamente o que vai para o anúncio. Os dados originais que você enviou ficam recolhidos, só para conferência. As alterações são salvas quando você clica em Salvar Rascunho ou Publicar Anúncio.</p></div>
      <div className="reviewHeaderActions">
        <button form="listingForm" name="intent" value="draft" className="button" type="submit">Salvar Rascunho</button>
        <button form="listingForm" name="intent" value="publish" className="button primary" type="submit">Publicar Anúncio</button>
      </div>
    </div>
    <AutoGenerate productId={id} enabled={query.generate === "1" && !listing} />
    <ResearchPoller pending={researchPending} />
    {query.error && <div className="authAlert error">{query.error}</div>}
    {query.updated === "1" && <div className="authAlert">Alterações salvas.</div>}
    {query.saved === "1" && <div className="authAlert">Anúncio publicado.</div>}
    {query.analyzed === "1" && <div className="authAlert">Análise das imagens concluída.</div>}
    {researchDone && aiResearch.competitorCount === 0 && <div className="authAlert">A pesquisa não encontrou anúncios comparáveis na Shopee. Ajuste o nome ou a marca do produto e pesquise de novo.</div>}
    {aiResearch?.status === "error" && <div className="authAlert error">{aiResearch.message}</div>}

    <section className="formSection">
      <div className="sectionTitle"><div><div className="eyebrow">Percentual de Prontidão</div></div><span className="progressLabel">{readiness.percentage}%</span></div>
      <div className="progressTrack"><div className="progressFill" style={{ width: `${readiness.percentage}%` }} /></div>
      {missingLabels.length > 0
        ? <p className="note">Campos obrigatórios faltantes: {missingLabels.join(", ")} · <a href={`/products/${id}/readiness`}>Entender preparação</a></p>
        : <p className="note">Todas as etapas obrigatórias estão concluídas. <a href={`/products/${id}/readiness`}>Ver diagnóstico completo</a></p>}
    </section>

    <details className="formSection originalData">
      <summary><div className="eyebrow">Dados originais que você enviou</div><h2>Conferir o que foi informado no cadastro</h2></summary>
      <label className="fieldLabel">Nome original</label>
      <div className="previewBlock readOnly">{product.name}</div>
      <label className="fieldLabel">Descrição original do fornecedor</label>
      <div className="previewBlock readOnly"><pre>{source.supplier_description || "Sem descrição original informada pelo fornecedor."}</pre></div>
    </details>

    <form id="listingForm" action={update}>
      <div className="workspaceGrid reviewGrid">
        <div className="reviewMain">
          <section className="formSection">
            <div className="eyebrow">Título do Anúncio</div>
            <p className="note">É este texto que aparece para quem pesquisa na Shopee. Edite se necessário.</p>
            <input name="title" defaultValue={listing?.title ?? ""} maxLength={120} placeholder="Gere o anúncio para preencher automaticamente" />
          </section>

          <section className="formSection">
            <div className="eyebrow">Descrição do Anúncio</div>
            <p className="note">Texto completo que vai na página do produto na Shopee. Edite se necessário.</p>
            <textarea name="description" defaultValue={listing?.description ?? ""} rows={10} placeholder="Gere o anúncio para preencher automaticamente" />
          </section>

          <section className="formSection">
            <div className="eyebrow">Atributos da Categoria</div>
            <p className="note">Preenchidos automaticamente pela pesquisa de categoria (barra lateral, à direita). Ajuste ou complete manualmente aqui — o que você editar aqui não é sobrescrito por uma nova pesquisa.</p>
            <AttributesEditor initial={attrs} />
          </section>

          <section className="formSection">
            <div className="sectionTitle"><div className="eyebrow">Imagens do Anúncio</div><div className="packageActions"><span className="statusChip">{imageCount} imagem(ns)</span>{imageCount > 0 && <AiActionButton action={analyzeImages} label="Analisar imagens com IA" pendingLabel="Analisando imagens…" hint="A IA está olhando cada imagem. Isso leva alguns segundos." />}</div></div>
            <p className="note">Clique em <b>Analisar imagens com IA</b> para a IA dizer qual foto usar como capa, o que está errado em cada uma (os avisos abaixo de cada imagem) e quais fotos ainda faltam. A geração de novas imagens por IA entra em uma etapa futura — por enquanto a IA só avalia o que você já enviou.</p>
            {imageCount > 0
              ? <div className="imageGrid">{signedImages.map((img, index) => {
                  const analysis = (aiImagePlan?.images ?? []).find((item: any) => item.index === index);
                  const isCover = aiImagePlan?.coverIndex === index;
                  return <div className="imageCardWrap" key={img.id}>
                    <div className="imageSlot filled">{img.url && <img src={img.url} alt={img.name} />}</div>
                    <div className="imageCardMeta"><span>{analysis?.role ?? (aiImagePlan ? "Sem papel definido" : "Ainda não analisada")}</span>{isCover && <span className="statusChip done">Capa sugerida</span>}</div>
                    {(analysis?.issues ?? []).length > 0 && <div className="imageIssues"><b>O que a IA notou nesta foto</b>{analysis.issues.map((issue: string) => <small className="note" key={issue}>• {issue}</small>)}</div>}
                  </div>;
                })}</div>
              : <p className="note">Nenhuma imagem enviada ainda. <a href={`/products/${id}`}>Adicionar imagens</a></p>}
            {aiImagePlan && <div className="aiSuggestion">
              <b>Capa recomendada pela IA</b>
              <p className="note">{aiImagePlan.coverReason}</p>
              {(aiImagePlan.missingShots ?? []).length > 0 && <><b>Fotos que faltam</b>{aiImagePlan.missingShots.map((shot: string) => <p className="note" key={shot}>• {shot}</p>)}</>}
              {aiImagePlan.videoSuggestion && <><b>Vídeo sugerido</b><p className="note">{aiImagePlan.videoSuggestion}</p></>}
            </div>}
          </section>

          <section className="formSection">
            <div className="eyebrow">Oferta e Envio</div>
            <p className="note">Dados obrigatórios da Shopee que ficam com você. Estoque já vem preenchido com um valor alto para quem não controla estoque manualmente — ajuste se precisar. Peso e dimensões do pacote definem o frete.</p>
            <div className="basicsGrid">
              <label className="fieldLabel">Custo do produto (R$)<input name="cost" defaultValue={product.cost ?? ""} inputMode="decimal" placeholder="Ex.: 43,99" /></label>
              <label className="fieldLabel">Estoque disponível<input name="stock" defaultValue={product.stock ?? 999} inputMode="numeric" placeholder="Ex.: 10" /></label>
              <label className="fieldLabel">Peso do pacote (kg)<input name="weight_kg" defaultValue={product.weight_kg ?? specs.weight_kg ?? ""} inputMode="decimal" placeholder="Ex.: 0,67" /></label>
              <label className="fieldLabel">Largura (cm)<input name="width_cm" defaultValue={product.width_cm ?? specs.width_cm ?? ""} inputMode="decimal" placeholder="Ex.: 50" /></label>
              <label className="fieldLabel">Altura (cm)<input name="height_cm" defaultValue={product.height_cm ?? specs.height_cm ?? ""} inputMode="decimal" placeholder="Ex.: 33" /></label>
              <label className="fieldLabel">Comprimento (cm)<input name="length_cm" defaultValue={product.length_cm ?? specs.length_cm ?? ""} inputMode="decimal" placeholder="Ex.: 42" /></label>
            </div>
          </section>

          <div className="formActions">
            <button className="button" type="submit" name="intent" value="draft">Salvar Rascunho</button>
            <button className="button primary" type="submit" name="intent" value="publish">Publicar Anúncio</button>
          </div>
        </div>

        <div className="reviewSidebar">
          <section className="formSection">
            <div className="eyebrow">Categoria e Concorrência</div>
            <p className="note">Único lugar para pesquisar: um clique busca a categoria real da Shopee, os atributos que ela exige e a faixa de preço praticada pela concorrência, tudo a partir de anúncios reais.</p>
            <label className="fieldLabel">Categoria</label>
            <input name="category" defaultValue={listing?.category ?? ""} placeholder="Ex.: Mãe e Bebê > Brinquedos > Veículos de Brinquedo" />
            <button className="button compact" type="submit" formAction={startResearch} disabled={researchPending}>{researchPending ? "Pesquisando na Shopee…" : "Pesquisar anúncios na Shopee"}</button>
            <p className="note">Salve o rascunho antes de pesquisar, para não perder edições não salvas. A pesquisa roda em segundo plano — você pode continuar editando enquanto espera.</p>
            {researchDone && <div className="aiSuggestion">
              <b>Pesquisa da IA · {aiResearch.categoryPath || "categoria não identificada"} (confiança {aiResearch.categoryConfidence})</b>
              <p className="note">{aiResearch.categoryReason}</p>
              <p className="note">{aiResearch.competitorCount} anúncio(s) encontrado(s) · {aiResearch.pricedCount} com preço visível</p>
              {(aiResearch.competitors ?? []).map((item: any) => <p className="note" key={`${item.url}-${item.title}`}>• {item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.title || item.url}</a> : item.title} — {money(item.price)}{item.sold ? ` · ${item.sold}` : ""}</p>)}
            </div>}
          </section>

          <section className="formSection">
            <div className="eyebrow">Sugestão de Preço e Margens</div>
            <div className="facts">
              <div><span>Preço Sugerido</span><b>{money(pricing?.sale_price)}</b></div>
              <div><span>Preço Concorrência (mín)</span><b>{money(analysis?.price_min)}</b></div>
              <div><span>Preço Concorrência (máx)</span><b>{money(analysis?.price_max)}</b></div>
              <div><span>Margem</span><b>{pricing?.margin_pct != null ? `${Number(pricing.margin_pct).toFixed(1)}%` : "—"}</b></div>
            </div>
            <p className="note">{analysis ? `Faixa observada em ${Array.isArray(analysis.competitors) ? analysis.competitors.length : 0} anúncio(s) da Shopee.` : "A faixa da concorrência aparece depois que você usa o botão “Pesquisar anúncios na Shopee” logo acima."}</p>
            <a className="button compact" href={`/products/${id}/preco`}>Editar preço</a>
          </section>

          {(aiResearch?.conversionInsights ?? []).length > 0 && <section className="formSection">
            <div className="eyebrow">O que os mais vendidos fazem</div>
            {aiResearch.conversionInsights.map((insight: string) => <p className="note" key={insight}>• {insight}</p>)}
          </section>}

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

    <section className="formSection regenerateSection">
      <div className="sectionTitle"><div><div className="eyebrow">Regerar com IA</div><h2>Recalcular do zero</h2></div></div>
      <p className="note">Substitui título, descrição, atributos e preço pelas evidências do produto, descartando as edições manuais feitas acima.</p>
      <form action={optimize}><button className="button" type="submit">Recalcular anúncio</button></form>
    </section>
  </main>;
}
