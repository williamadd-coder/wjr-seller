import type { ResearchAttempt } from "@/lib/marketplaces/shopee/public-research";
import { isAutomaticResearch, researchMessage } from "@/lib/marketplaces/shopee/research-status";
import { retryShopeeResearch } from "./research-actions";
import { ResearchButton } from "./research-button";
const money = (v: unknown) => v == null || !Number.isFinite(Number(v)) || Number(v) <= 0 ? "Preço não informado" : new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v));
const date = (value: string) => new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Sao_Paulo"}).format(new Date(value));
const validDate = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
function offerUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  try { const url=new URL(value); if (url.protocol === "https:" && (url.hostname === "shopee.com.br" || url.hostname.endsWith(".shopee.com.br"))) return url.href; } catch {}
}
export function ResearchPanel({productId,analysis,attempt,terms}:{productId:string;analysis:any;attempt?:ResearchAttempt|null;terms:string[]}) {
  const competitors = Array.isArray(analysis?.competitors) ? analysis.competitors : [];
  const hasEvidence = competitors.length > 0;
  const automatic = isAutomaticResearch(analysis?.source);
  const indexed = analysis?.source === "shopee_indexed_tavily";
  const message = researchMessage(attempt);
  const latestFailure = attempt && attempt.status !== "completed" && (!validDate(analysis?.analyzed_at) || Date.parse(attempt.checkedAt) >= Date.parse(analysis.analyzed_at));
  const pricedCount = competitors.filter((c:any) => c.price != null && Number.isFinite(Number(c.price)) && Number(c.price)>0).length;
  return <section className="formSection">
    <div className="sectionTitle"><div><div className="eyebrow">Inteligência do Seller IA</div><h2>{hasEvidence ? `${indexed ? "Anúncios encontrados em busca externa" : automatic ? "Pesquisa pública registrada" : "Referências registradas"} · ${competitors.length} anúncio(s)` : message.title}</h2></div><span className={`statusChip ${hasEvidence && !latestFailure ? "done" : ""}`}>{latestFailure ? "Última tentativa não concluída" : hasEvidence ? "Evidências disponíveis" : "Sem pesquisa concluída"}</span></div>
    {hasEvidence && <>
      <p className="note">{indexed ? "Fonte: Tavily, índice de páginas públicas da Shopee. Os anúncios e preços indexados podem estar desatualizados. Confira a oferta no link. Esses valores não entram no cálculo automático de preço e margem." : automatic ? "Amostra de anúncios públicos comparáveis da Shopee. A quantidade abaixo corresponde à amostra coletada, não ao total de anúncios da plataforma." : "Estas referências foram registradas manualmente. Elas não comprovam uma pesquisa automática da Shopee."}{validDate(analysis.analyzed_at) && ` Registro: ${date(analysis.analyzed_at)} (Brasília).`}</p>
      <div className="facts"><div><span>Anúncios na amostra</span><b>{competitors.length}</b></div><div><span>Com preço verificado na coleta direta</span><b>{pricedCount}</b></div><div><span>Menor preço observado</span><b>{money(analysis.price_min)}</b></div><div><span>Preço mediano</span><b>{money(analysis.price_median)}</b></div><div><span>Maior preço observado</span><b>{money(analysis.price_max)}</b></div><div><span>Categoria observada</span><b>{analysis.competitor_patterns?.category || "Não disponível na pesquisa"}</b></div></div>
      <div className="previewBlock"><span>Anúncios usados como referência</span>{competitors.map((c:any,i:number)=><p key={`${c.shopId}-${c.itemId}-${i}`}><b>{i+1}. {c.title}</b><br/><span>{c.evidenceSource === "tavily_index" ? (c.indexedPrice != null ? `Preço indexado: ${money(c.indexedPrice)} · confirmar na Shopee` : "Preço atual não verificado") : money(c.price)}</span>{offerUrl(c.url) && <> · <a href={offerUrl(c.url)} target="_blank" rel="noreferrer">Abrir na Shopee ↗</a></>}</p>)}</div>
    </>}
    {(!hasEvidence || latestFailure) && <div role="status">{hasEvidence && <b>{message.title}</b>}<p className="note">{message.detail}{hasEvidence && " As referências anteriores continuam disponíveis acima."}</p></div>}
    {validDate(attempt?.checkedAt) && <p className="note">Última tentativa: {date(attempt.checkedAt)} (Brasília).</p>}
    <p className="note">Termos de pesquisa: <b>{(attempt?.queries?.length ? attempt.queries : terms).join(" · ") || "aguardando dados suficientes"}</b>.</p>
    <form action={retryShopeeResearch.bind(null,productId)}><ResearchButton/></form>
  </section>;
}
