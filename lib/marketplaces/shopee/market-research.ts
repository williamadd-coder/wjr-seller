import * as z from "zod/v4";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AI_MODEL, MISSING_KEY_MESSAGE, createAnthropic, describeAiError } from "@/lib/ai/anthropic";
import { marketPriceRange } from "@/lib/marketplaces/shopee/market-price";

export { marketPriceRange };

const ResearchSchema = z.object({
  categoryPath: z.string(),
  categoryConfidence: z.enum(["alta", "media", "baixa"]),
  categoryReason: z.string(),
  searchTerms: z.array(z.string()),
  competitors: z.array(z.object({
    title: z.string(),
    url: z.string(),
    price: z.number().nullable(),
    store: z.string(),
    sold: z.string(),
  })),
  attributes: z.array(z.object({
    name: z.string(),
    required: z.boolean(),
    value: z.string(),
    basis: z.enum(["evidencia", "inferido", "desconhecido"]),
  })),
  conversionInsights: z.array(z.string()),
  summary: z.string(),
});

export type ShopeeMarketResearch = z.infer<typeof ResearchSchema>;
export type MarketResearchSeed = {
  name: string;
  brand?: string | null;
  model?: string | null;
  ean?: string | null;
  supplierDescription?: string | null;
  confirmedAttributes?: Record<string, string>;
  searchTerms?: string[];
};

/**
 * Runs inside a Netlify Background Function (up to 15 min), not a regular server action (~26s), so it
 * can afford a few search rounds for better accuracy instead of betting everything on one query.
 */
const SEARCH_TOOL = { type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 3, user_location: { type: "approximate" as const, country: "BR", timezone: "America/Sao_Paulo" } };
/** Safety net against the Anthropic call itself hanging — well inside the background function's 15-minute budget. */
const REQUEST_TIMEOUT_MS = 120000;

const SYSTEM = `Você pesquisa anúncios reais da Shopee Brasil para quem vai cadastrar um produto igual.

Use a ferramenta de busca na web (até 3 buscas) para encontrar anúncios do MESMO produto (ou do mais parecido possível) na Shopee Brasil. Comece pelo termo mais específico (nome + marca + modelo) e só use termos mais genéricos se o primeiro não trouxer resultado.

Com base apenas no que você realmente encontrou, responda:
1. "categoryPath": o caminho COMPLETO da categoria como a Shopee Brasil exibe, com " > " entre os níveis (exemplo de formato: "Mãe e Bebê > Brinquedos > Veículos de Brinquedo"). Use a nomenclatura real da Shopee e a profundidade que os anúncios encontrados mostram.
2. "categoryConfidence": "alta" quando os anúncios encontrados mostram a categoria, "media" quando você deduziu pela navegação da Shopee, "baixa" quando não encontrou anúncios comparáveis.
3. "competitors": os anúncios comparáveis encontrados, com título, URL, preço de venda em reais (apenas o número, sem "R$"), nome da loja e quantidade vendida. Use price null quando o preço não estiver visível. Nunca invente preço, URL ou loja.
4. "attributes": os atributos que a Shopee pede nessa categoria (marque "required" nos obrigatórios). Preencha "value" com basis "evidencia" só quando as evidências do produto sustentarem o valor, "inferido" quando for dedução e "desconhecido" com value vazio quando não houver como saber.
5. "conversionInsights": o que os anúncios que mais vendem fazem no título, nas imagens e na descrição.
6. "summary": uma frase em português resumindo a pesquisa.

Regras: responda em português; nunca invente dados que não vieram das buscas; se não encontrar nenhum anúncio comparável, devolva competitors vazio e categoryConfidence "baixa".`;

const seedText = (seed: MarketResearchSeed) => [
  `Produto a cadastrar: ${seed.name}`,
  seed.brand ? `Marca: ${seed.brand}` : null,
  seed.model ? `Modelo: ${seed.model}` : null,
  seed.ean ? `EAN/GTIN: ${seed.ean}` : null,
  seed.supplierDescription ? `Descrição do fornecedor: ${seed.supplierDescription}` : null,
  Object.keys(seed.confirmedAttributes ?? {}).length
    ? `Atributos já confirmados pelo vendedor: ${Object.entries(seed.confirmedAttributes!).map(([k, v]) => `${k}=${v}`).join("; ")}`
    : null,
  seed.searchTerms?.length ? `Termos de busca sugeridos: ${seed.searchTerms.join(" | ")}` : null,
].filter(Boolean).join("\n");

export async function researchShopeeMarket(seed: MarketResearchSeed): Promise<{ data: ShopeeMarketResearch | null; error: string | null }> {
  const client = createAnthropic();
  if (!client) return { data: null, error: MISSING_KEY_MESSAGE };
  if (!seed.name?.trim()) return { data: null, error: "Informe o nome do produto antes de pesquisar a Shopee." };
  try {
    const response = await client.messages.parse({
      model: AI_MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      tools: [SEARCH_TOOL],
      messages: [{ role: "user", content: seedText(seed) }],
      output_config: { format: zodOutputFormat(ResearchSchema) },
    }, { timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 });
    if (response.stop_reason === "refusal") return { data: null, error: "A IA recusou esta pesquisa. Revise as evidências do produto." };
    if (!response.parsed_output) return { data: null, error: "A IA respondeu em um formato inesperado. Tente novamente." };
    return { data: response.parsed_output, error: null };
  } catch (error) {
    if (error instanceof Anthropic.APIConnectionTimeoutError) return { data: null, error: "A pesquisa na Shopee demorou demais e foi interrompida. Tente novamente — buscas mais específicas (marca e modelo) costumam ser mais rápidas." };
    return { data: null, error: describeAiError(error) };
  }
}
