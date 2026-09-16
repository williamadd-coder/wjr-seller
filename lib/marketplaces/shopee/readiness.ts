export type ShopeeReadinessInput = {
  cost?: number | null; stock?: number | null; sku?: string | null; ean?: string | null;
  weightKg?: number | null; widthCm?: number | null; heightCm?: number | null; lengthCm?: number | null;
  productWeightKg?: number | null; productWidthCm?: number | null; productHeightCm?: number | null; productLengthCm?: number | null;
  hasMarketEvidence: boolean; hasPricing: boolean; category?: string | null; attributeCount: number;
  imageCount: number; hasVideo: boolean; listingScore?: number | null; scoreBlockers?: string[];
};
export type ReadinessStep = { key:string; label:string; ready:boolean; detail:string; owner:"seller-ia"|"user"; blocking:boolean };
export function getShopeePublicationReadiness(input:ShopeeReadinessInput){
 const packageReady=input.weightKg!=null&&input.widthCm!=null&&input.heightCm!=null&&input.lengthCm!=null;
 const technicalFallbackReady=input.productWeightKg!=null&&input.productWidthCm!=null&&input.productHeightCm!=null&&input.productLengthCm!=null;
 const logisticsReady=packageReady||technicalFallbackReady;
 const classificationReady=!!input.category&&input.attributeCount>=1;
 const mediaReady=input.imageCount>=1;
 const optimizationReady=input.listingScore!=null&&input.listingScore>=70&&(input.scoreBlockers?.length??0)===0;
 const steps:ReadinessStep[]=[
  {key:"market",label:"Pesquisa de mercado",ready:input.hasMarketEvidence,detail:input.hasMarketEvidence?"Concorrentes comparáveis registrados e usados como evidência.":"Pesquisa automática de concorrentes ainda não executada. Esta etapa é do Seller IA e não bloqueia sua homologação enquanto a integração automática de mercado é finalizada.",owner:"seller-ia",blocking:false},
  {key:"classification",label:"Categoria e atributos",ready:classificationReady,detail:classificationReady?`${input.category} · ${input.attributeCount} atributo(s) estruturado(s).`:"Classificação automática ainda não concluída. Esta etapa pertence ao Seller IA e não é uma pendência para você preencher manualmente.",owner:"seller-ia",blocking:false},
  {key:"pricing",label:"Preço e margem",ready:input.hasPricing,detail:input.hasPricing?"Cenário recomendado calculado com custos e taxas.":"O Seller IA ainda precisa calcular preço sugerido, lucro e margem.",owner:"seller-ia",blocking:true},
  {key:"media",label:"Imagens-fonte",ready:mediaReady,detail:mediaReady?`${input.imageCount} imagem(ns) recebida(s) para análise visual.`:"Envie ao menos uma imagem fiel do produto para a estratégia visual.",owner:"user",blocking:true},
  {key:"logistics",label:"Pacote para envio",ready:logisticsReady,detail:packageReady?"Peso e dimensões do pacote informados.":technicalFallbackReady?"Peso e dimensões técnicas foram aproveitados como referência logística. Confirme apenas se a embalagem de transporte tiver medidas diferentes.":"Informe peso e dimensões somente se esses dados não tiverem sido fornecidos nas especificações técnicas.",owner:"user",blocking:true},
  {key:"optimization",label:"Qualidade mínima",ready:optimizationReady,detail:optimizationReady?`Score WJR ${input.listingScore}/100: meta mínima atingida e sem bloqueios críticos.`:`Meta de qualidade: Score WJR 70/100 ou mais, sem bloqueios críticos${input.listingScore!=null?` (atual: ${input.listingScore}/100)`:""}.`,owner:"seller-ia",blocking:true},
 ];
 const blockingSteps=steps.filter(s=>s.blocking),completed=blockingSteps.filter(s=>s.ready).length,percentage=Math.round(completed/blockingSteps.length*100);
 return{ready:blockingSteps.every(s=>s.ready),completed,total:blockingSteps.length,percentage,steps};
}
