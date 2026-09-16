export type ShopeeReadinessInput = {
  cost?: number | null; stock?: number | null; sku?: string | null; ean?: string | null;
  weightKg?: number | null; widthCm?: number | null; heightCm?: number | null; lengthCm?: number | null;
  productWeightKg?: number | null; productWidthCm?: number | null; productHeightCm?: number | null; productLengthCm?: number | null;
  supplierDescription?: string | null;
  hasMarketEvidence: boolean; hasPricing: boolean; category?: string | null; attributeCount: number;
  imageCount: number; hasVideo: boolean; listingScore?: number | null; scoreBlockers?: string[];
};
export type ReadinessStep = { key:string; label:string; ready:boolean; detail:string; owner:"seller-ia"|"user"; blocking:boolean };
const n=(v:string)=>Number(v.replace(",","."));
function specsFromDescription(text?:string|null){
 const value=text??"";
 const weight=value.match(/(?:pesa|peso(?:\s+(?:aproximado|aproximadamente))?)\s*(?:de\s*)?(?:aproximadamente\s*)?([\d.,]+)\s*(kg|g)\b/i);
 const dimensions=value.match(/(?:aproximadamente\s*)?([\d.,]+)\s*cm\s*(?:de\s*)?(?:comprimento|comp)\D{0,25}([\d.,]+)\s*cm\s*(?:de\s*)?(?:largura|larg)\D{0,25}([\d.,]+)\s*cm\s*(?:de\s*)?(?:altura|alt)/i);
 return {weightKg:weight?(weight[2].toLowerCase()==="g"?n(weight[1])/1000:n(weight[1])):null,lengthCm:dimensions?n(dimensions[1]):null,widthCm:dimensions?n(dimensions[2]):null,heightCm:dimensions?n(dimensions[3]):null};
}
export function getShopeePublicationReadiness(input:ShopeeReadinessInput){
 const extracted=specsFromDescription(input.supplierDescription);
 const packageReady=input.weightKg!=null&&input.widthCm!=null&&input.heightCm!=null&&input.lengthCm!=null;
 const technicalFallbackReady=(input.productWeightKg??extracted.weightKg)!=null&&(input.productWidthCm??extracted.widthCm)!=null&&(input.productHeightCm??extracted.heightCm)!=null&&(input.productLengthCm??extracted.lengthCm)!=null;
 const logisticsReady=packageReady||technicalFallbackReady;
 const classificationReady=!!input.category&&input.attributeCount>=1;
 const mediaReady=input.imageCount>=1;
 const optimizationReady=input.listingScore!=null&&input.listingScore>=70;
 const steps:ReadinessStep[]=[
  {key:"market",label:"Pesquisa de mercado",ready:input.hasMarketEvidence,detail:input.hasMarketEvidence?"Concorrentes comparáveis registrados e usados como evidência.":"Pesquisa de concorrentes pendente de execução pelo Seller IA.",owner:"seller-ia",blocking:false},
  {key:"classification",label:"Categoria e atributos",ready:classificationReady,detail:classificationReady?`${input.category} · ${input.attributeCount} atributo(s) estruturado(s).`:"Pesquisa de categoria e atributos pendente de execução pelo Seller IA.",owner:"seller-ia",blocking:false},
  {key:"pricing",label:"Preço e margem",ready:input.hasPricing,detail:input.hasPricing?"Cenário recomendado calculado com custos e taxas.":"O Seller IA ainda precisa calcular preço sugerido, lucro e margem.",owner:"seller-ia",blocking:true},
  {key:"media",label:"Imagens-fonte",ready:mediaReady,detail:mediaReady?`${input.imageCount} imagem(ns) recebida(s) para análise visual.`:"Envie ao menos uma imagem fiel do produto para a estratégia visual.",owner:"user",blocking:true},
  {key:"logistics",label:"Pacote para envio",ready:logisticsReady,detail:packageReady?"Peso e dimensões do pacote informados.":technicalFallbackReady?"Peso e dimensões encontrados nas especificações do fornecedor e aproveitados como referência logística.":"Peso e dimensões da embalagem de transporte ainda não foram encontrados nas evidências do produto.",owner:"user",blocking:true},
  {key:"optimization",label:"Qualidade mínima",ready:optimizationReady,detail:optimizationReady?`Score WJR ${input.listingScore}/100: meta mínima atingida.`:`Meta de qualidade: Score WJR 70/100 ou mais${input.listingScore!=null?` (atual: ${input.listingScore}/100)`:""}.`,owner:"seller-ia",blocking:true},
 ];
 const blockingSteps=steps.filter(s=>s.blocking),completed=blockingSteps.filter(s=>s.ready).length,percentage=Math.round(completed/blockingSteps.length*100);
 return{ready:blockingSteps.every(s=>s.ready),completed,total:blockingSteps.length,percentage,steps};
}
