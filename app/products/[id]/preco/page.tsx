import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { savePricingScenario, recommendShopeePrice } from "../market/actions";

const money = (v: unknown) => v == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));

export default async function PricePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");
  const [{ data: product }, { data: pricing }, { data: analysis }, { data: settings }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).single(),
    supabase.from("pricing_scenarios").select("*").eq("product_id", id).eq("marketplace", "shopee").eq("is_recommended", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("market_analyses").select("price_min,price_median,price_max,competitors").eq("product_id", id).eq("marketplace", "shopee").order("analyzed_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("marketplace_pricing_settings").select("*").eq("marketplace", "shopee").maybeSingle(),
  ]);
  if (!product) notFound();

  const recommend = recommendShopeePrice.bind(null, id);
  const simulate = savePricingScenario.bind(null, id);
  const competitors = Array.isArray(analysis?.competitors) ? analysis.competitors.length : 0;

  return <main className="main studioPage">
    <div className="crumbs"><a href={`/products/${id}/review`}>Prévia do anúncio</a><span>/</span><span>Preço e margem</span></div>
    <div className="studioHeader">
      <div>
        <div className="eyebrow">Calculadora de preço · Shopee</div>
        <h1>Preço e margem</h1>
        <p>Calcule o preço de venda com as taxas da Shopee, seus impostos e frete. O cenário recomendado é o que vai para o anúncio.</p>
      </div>
      <div className="scoreBadge"><span>Preço recomendado</span><strong>{pricing?.sale_price ? money(pricing.sale_price) : "—"}</strong><small>{pricing?.margin_pct != null ? `margem ${Number(pricing.margin_pct).toFixed(1)}%` : "ainda não calculado"}</small></div>
    </div>
    {query.error && <div className="authAlert error">{query.error}</div>}

    <section className="formSection">
      <div className="sectionTitle"><div><div className="eyebrow">Cenário recomendado</div><h2>{pricing ? "Resultado do cálculo atual" : "Nenhum cenário calculado ainda"}</h2></div><span className={`statusChip ${pricing ? "done" : ""}`}>{product.cost == null ? "Custo não informado" : `Custo ${money(product.cost)}`}</span></div>
      {product.cost == null
        ? <p className="note">Informe o custo do produto na prévia do anúncio (cartão “Oferta e Envio”) antes de calcular o preço.</p>
        : pricing
          ? <div className="facts pricingFacts">
              <div><span>Preço de venda</span><b>{money(pricing.sale_price)}</b></div>
              <div><span>Taxas Shopee</span><b>{money(pricing.marketplace_fee)}</b></div>
              <div><span>Impostos</span><b>{money(pricing.taxes)}</b></div>
              <div><span>Frete + outros</span><b>{money(pricing.other_costs)}</b></div>
              <div><span>Lucro líquido</span><b>{money(pricing.profit)}</b></div>
              <div><span>Margem</span><b>{Number(pricing.margin_pct).toFixed(1)}%</b></div>
            </div>
          : <p className="note">Use o botão abaixo para a IA sugerir um preço com base no custo, nas taxas e na faixa de mercado, ou simule um preço você mesmo.</p>}
      <div className="formActions"><form action={recommend}><button className="button primary" type="submit" disabled={product.cost == null}>IA: sugerir preço de venda</button></form></div>
    </section>

    <div className="workspaceGrid">
      <section className="formSection">
        <div className="eyebrow">Simular outro preço</div>
        <h2>Testar um preço específico</h2>
        <p className="note">O valor simulado passa a ser o preço recomendado do anúncio. Campos em branco usam as suas configurações da Shopee.</p>
        <form action={simulate} className="pricingForm">
          <label>Preço de venda<input name="sale_price" inputMode="decimal" required placeholder="Ex.: 89,90" /></label>
          <label>Impostos (%)<input name="taxes_pct" inputMode="decimal" placeholder={String(settings?.taxes_pct ?? "0")} /></label>
          <label>Frete (R$)<input name="freight" inputMode="decimal" placeholder={String(settings?.freight_default ?? "0")} /></label>
          <label>Outros custos (R$)<input name="other_costs" inputMode="decimal" placeholder={String(settings?.other_costs ?? "0")} /></label>
          <button className="button" type="submit" disabled={product.cost == null}>Recalcular preço e margem</button>
        </form>
      </section>

      <section className="formSection">
        <div className="eyebrow">Referência de mercado</div>
        <h2>{competitors ? `${competitors} anúncio(s) observado(s)` : "Sem pesquisa de mercado ainda"}</h2>
        {analysis
          ? <div className="facts">
              <div><span>Menor preço observado</span><b>{money(analysis.price_min)}</b></div>
              <div><span>Preço mediano</span><b>{money(analysis.price_median)}</b></div>
              <div><span>Maior preço observado</span><b>{money(analysis.price_max)}</b></div>
            </div>
          : <p className="note">A faixa de preço dos concorrentes aparece aqui depois que a IA encontrar anúncios comparáveis. Use o botão “Pesquisar anúncios na Shopee” na <a href={`/products/${id}/review`}>prévia do anúncio</a>.</p>}
        <div className="formActions"><a className="button compact" href="/settings/marketplaces">Configurar taxas e impostos</a></div>
      </section>
    </div>

    <div className="formActions"><a className="button" href={`/products/${id}/review`}>← Voltar à prévia</a></div>
  </main>;
}
