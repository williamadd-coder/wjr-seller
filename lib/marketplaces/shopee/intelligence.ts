export type ProductIntelligenceSeed = {
  name: string;
  brand?: string | null;
  model?: string | null;
  supplierDescription?: string | null;
  confirmedAttributes?: Record<string, string | number | boolean | null>;
};

export type IntelligenceStage = {
  key: "search" | "competitors" | "classification" | "pricing" | "visual";
  label: string;
  objective: string;
  evidenceRequired: string[];
};

const STOPWORDS = new Set(["de", "da", "do", "das", "dos", "com", "para", "e", "em", "um", "uma"]);

function usefulTerms(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && !STOPWORDS.has(term));
}

export function buildShopeeSearchTerms(seed: ProductIntelligenceSeed) {
  const terms = [...usefulTerms(seed.name), ...usefulTerms(seed.brand ?? ""), ...usefulTerms(seed.model ?? "")];
  return [...new Set(terms)].slice(0, 8);
}

export function buildShopeeIntelligencePlan(seed: ProductIntelligenceSeed) {
  const searchTerms = buildShopeeSearchTerms(seed);
  const stages: IntelligenceStage[] = [
    {
      key: "search",
      label: "Encontrar produtos comparáveis",
      objective: "Pesquisar anúncios que representem o mesmo produto ou a mesma intenção de compra, sem misturar itens apenas visualmente parecidos.",
      evidenceRequired: ["URL pública", "título observado", "preço observado", "data da coleta"],
    },
    {
      key: "competitors",
      label: "Comparar concorrência",
      objective: "Calcular faixa de preços somente com concorrentes comparáveis e registrar diferenças relevantes de oferta.",
      evidenceRequired: ["preço mínimo", "mediana", "preço máximo", "diferenças de kit/quantidade quando visíveis"],
    },
    {
      key: "classification",
      label: "Recomendar categoria e atributos",
      objective: "Usar sinais de anúncios comparáveis e regras conhecidas da Shopee para recomendar categoria; atributos não comprovados permanecem pendentes.",
      evidenceRequired: ["categoria observável ou regra de marketplace", "atributos confirmados do produto", "nível de confiança"],
    },
    {
      key: "pricing",
      label: "Recomendar preço e margem",
      objective: "Combinar custo, configuração de taxas do usuário e faixa competitiva para sugerir preço, lucro e margem, sem tratar configuração como taxa oficial universal.",
      evidenceRequired: ["custo", "taxas configuradas", "faixa competitiva"],
    },
    {
      key: "visual",
      label: "Definir estratégia visual",
      objective: "Analisar as imagens-fonte e padrões úteis da concorrência para propor uma capa diferenciada e sequência visual, preservando fielmente o produto.",
      evidenceRequired: ["imagens-fonte", "padrões visuais observados", "características confirmadas"],
    },
  ];
  return { searchTerms, stages, policy: "evidence-first" as const };
}

export const SHOPEE_INTELLIGENCE_GUARDRAILS = [
  "Não inventar quantidade vendida, ranking, avaliações ou demanda.",
  "Não afirmar categoria ou atributo como confirmado sem evidência suficiente.",
  "Não escolher concorrente apenas por semelhança visual; validar intenção/produto comparável.",
  "Registrar fonte e data para informações de mercado que podem mudar.",
  "Separar fato observado, recomendação do Seller IA e confirmação pendente do usuário/fornecedor.",
] as const;
