export type ShopeeReadinessInput = {
  cost?: number | null; stock?: number | null; sku?: string | null; ean?: string | null;
  weightKg?: number | null; widthCm?: number | null; heightCm?: number | null; lengthCm?: number | null;
  hasMarketEvidence: boolean; hasPricing: boolean; category?: string | null; attributeCount: number;
  imageCount: number; hasVideo: boolean; listingScore?: number | null; scoreBlockers?: string[];
};
export type ReadinessStep = { key:string; label:string; ready:boolean; detail:string; owner:"seller-ia"|"user" };
export function getShopeePublicationReadiness(input:ShopeeReadinessInput){
 const logisticsReady=input.weightKg!=null&&input.widthCm!=null&&input.heightCm!=null&&input.lengthCm!=null;
 const classificationReady=!!input.category&&input.attributeCount>=3;
 const mediaReady=input.imageCount>=1;
 const optimizationReady=input.listingScore!=null&&input.listingScore>=70&&(input.scoreBlockers?.length??0)===0;
 const steps:ReadinessStep[]=[
  {key:"market",label:"Pesquisa de mercado",ready:input.hasMarketEvidence,detail:input.hasMarketEvidence?"Concorrência registrada para sustentar categoria e preço.":"O Seller IA ainda precisa pesquisar e registrar concorrentes comparáveis.",owner:"seller-ia"},
  {key:"classification",label:"Categoria e atributos",ready:classificationReady,detail:classificationReady?`${input.attributeCount} atributo(s) estruturado(s).`:"O Seller IA ainda precisa recomendar a categoria e mapear os atributos exigidos; confirme apenas dados que não puderem ser comprovados.",owner:"seller-ia"},
  {key:"pricing",label:"Preço e margem",ready:input.hasPricing,detail:input.hasPricing?"Cenário recomendado calculado com custos e taxas.":"O Seller IA ainda precisa calcular a faixa competitiva, preço sugerido, lucro e margem.",owner:"seller-ia"},
  {key:"media",label:"Imagens-fonte",ready:mediaReady,detail:mediaReady?`${input.imageCount} imagem(ns) recebida(s) para análise visual.`:"Envie ao menos uma imagem fiel do produto para a estratégia visual.",owner:"user"},
  {key:"logistics",label:"Pacote para envio",ready:logisticsReady,detail:logisticsReady?"Peso e dimensões do pacote informados.":"Confirme peso e dimensões da embalagem de transporte.",owner:"user"},
  {key:"optimization",label:"Qualidade mínima",ready:optimizationReady,detail:optimizationReady?`Score WJR ${input.listingScore}/100 sem bloqueios.`:"Meta de qualidade: Score WJR 70/100 ou mais, sem bloqueios críticos.",owner:"seller-ia"},
 ];
 const completed=steps.filter(s=>s.ready).length,percentage=Math.round(completed/steps.length*100);
 return{ready:completed===steps.length,completed,total:steps.length,percentage,steps};
}
