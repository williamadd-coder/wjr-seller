export type ShopeeReadinessInput = {
  cost?: number | null;
  stock?: number | null;
  sku?: string | null;
  ean?: string | null;
  weightKg?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  lengthCm?: number | null;
  hasMarketEvidence: boolean;
  hasPricing: boolean;
  category?: string | null;
  attributeCount: number;
  imageCount: number;
  hasVideo: boolean;
  listingScore?: number | null;
  scoreBlockers?: string[];
};

export type ReadinessStep = {
  key: string;
  label: string;
  ready: boolean;
  detail: string;
};

export function getShopeePublicationReadiness(input: ShopeeReadinessInput) {
  const baseReady = input.cost != null && input.stock != null && !!input.sku && !!input.ean && input.weightKg != null && input.widthCm != null && input.heightCm != null && input.lengthCm != null;
  const classificationReady = !!input.category && input.attributeCount > 0;
  const mediaReady = input.imageCount > 0;
  const optimizationReady = input.listingScore != null && (input.scoreBlockers?.length ?? 0) === 0;

  const steps: ReadinessStep[] = [
    { key: "base", label: "Base do produto", ready: baseReady, detail: baseReady ? "Dados logísticos e comerciais preenchidos." : "Complete custo, estoque, SKU, EAN, peso e dimensões." },
    { key: "market", label: "Mercado", ready: input.hasMarketEvidence, detail: input.hasMarketEvidence ? "Evidências de concorrentes registradas." : "Registre concorrentes observados para sustentar a análise." },
    { key: "classification", label: "Categoria e atributos", ready: classificationReady, detail: classificationReady ? `${input.attributeCount} atributo(s) confirmado(s).` : "Confirme a categoria e ao menos um atributo do produto." },
    { key: "pricing", label: "Oferta", ready: input.hasPricing, detail: input.hasPricing ? "Cenário recomendado de preço e margem calculado." : "Calcule um cenário com preço, taxas e custos confirmados." },
    { key: "media", label: "Mídia", ready: mediaReady, detail: mediaReady ? `${input.imageCount} imagem(ns)${input.hasVideo ? " + vídeo" : ""}.` : "Adicione ao menos uma imagem válida do produto." },
    { key: "optimization", label: "Score WJR", ready: optimizationReady, detail: optimizationReady ? `Score ${input.listingScore} sem bloqueios.` : "Recalcule a otimização e resolva os bloqueios do Score WJR." },
  ];

  const completed = steps.filter((step) => step.ready).length;
  const percentage = Math.round((completed / steps.length) * 100);
  return { ready: completed === steps.length, completed, total: steps.length, percentage, steps };
}
