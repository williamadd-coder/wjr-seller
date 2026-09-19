import * as z from "zod/v4";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AI_MODEL, MISSING_KEY_MESSAGE, createAnthropic, describeAiError } from "@/lib/ai/anthropic";
import { SHOPEE_BR_PROFILE } from "@/lib/marketplaces/shopee/profile";

const CopySchema = z.object({
  title: z.string(),
  description: z.string(),
  benefits: z.array(z.string()).max(4),
});

export type ShopeeCopy = z.infer<typeof CopySchema>;
export type CopySeed = {
  name: string;
  brand?: string | null;
  model?: string | null;
  categoryPath?: string | null;
  confirmedAttributes?: Record<string, string>;
  supplierDescription?: string | null;
  itemsIncluded?: string | null;
  weightKg?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  lengthCm?: number | null;
  competitorTitles?: string[];
  conversionInsights?: string[];
};

const SYSTEM = `Você é um redator especialista em anúncios da Shopee Brasil que convertem.

Escreva o título e a descrição de um anúncio usando SOMENTE os fatos confirmados que forem fornecidos (nome, marca, modelo, atributos confirmados, itens inclusos, descrição do fornecedor, peso/dimensões). Nunca invente característica, material, medida, funcionalidade ou promessa que não esteja nas evidências — se não houver evidência para algo, simplesmente não mencione.

Você pode se inspirar na ESTRUTURA e nas palavras-chave que os títulos de anúncios concorrentes de sucesso usam (fornecidos como referência) para deixar o texto mais relevante para a busca da Shopee, mas o conteúdo em si vem só das evidências do produto.

Regras:
1. "title": até ${SHOPEE_BR_PROFILE.listing.title.maxLength} caracteres. Produto, marca/modelo e os atributos mais relevantes primeiro. Sem repetição artificial de palavras-chave.
2. "description": até ${SHOPEE_BR_PROFILE.listing.description.maxLength} caracteres, em texto corrido com quebras de linha, organizada assim: abertura vendedora (1-2 frases) → DESTAQUES (bullets) → CARACTERÍSTICAS E ESPECIFICAÇÕES (bullets) → ITENS INCLUSOS (se houver) → ENVIO (peso/dimensões, se houver) → PERGUNTAS FREQUENTES (2-3 perguntas respondidas só com o que já foi informado). Tom profissional, objetivo, sem emojis em excesso, sem alegação que não possa ser sustentada pelas evidências.
3. "benefits": até 4 frases curtas (até 40 caracteres cada) reformulando os atributos/diferenciais confirmados mais fortes em estilo de bullet de venda (ex.: um atributo "Material: aço reforçado" pode virar "Aço reforçado e resistente"). Nunca crie um benefício que não venha de um fato confirmado.

Responda em português do Brasil.`;

const seedText = (seed: CopySeed) => [
  `Produto: ${seed.name}`,
  seed.brand ? `Marca: ${seed.brand}` : null,
  seed.model ? `Modelo: ${seed.model}` : null,
  seed.categoryPath ? `Categoria na Shopee: ${seed.categoryPath}` : null,
  Object.keys(seed.confirmedAttributes ?? {}).length
    ? `Atributos confirmados: ${Object.entries(seed.confirmedAttributes!).map(([k, v]) => `${k}=${v}`).join("; ")}`
    : null,
  seed.itemsIncluded ? `Itens inclusos: ${seed.itemsIncluded}` : null,
  seed.supplierDescription ? `Descrição do fornecedor: ${seed.supplierDescription}` : null,
  seed.weightKg ? `Peso do pacote: ${seed.weightKg} kg` : null,
  seed.widthCm && seed.heightCm && seed.lengthCm ? `Dimensões do pacote: ${seed.widthCm} x ${seed.heightCm} x ${seed.lengthCm} cm` : null,
  seed.competitorTitles?.length ? `Títulos de concorrentes reais na Shopee (referência de estrutura/palavras-chave, não de fatos):\n${seed.competitorTitles.map((t) => `- ${t}`).join("\n")}` : null,
  seed.conversionInsights?.length ? `O que os anúncios mais vendidos fazem bem:\n${seed.conversionInsights.map((t) => `- ${t}`).join("\n")}` : null,
].filter(Boolean).join("\n");

export async function generateShopeeCopy(seed: CopySeed): Promise<{ data: ShopeeCopy | null; error: string | null }> {
  const client = createAnthropic();
  if (!client) return { data: null, error: MISSING_KEY_MESSAGE };
  if (!seed.name?.trim()) return { data: null, error: "Informe o nome do produto antes de gerar o texto do anúncio." };
  try {
    const response = await client.messages.parse({
      model: AI_MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{ role: "user", content: seedText(seed) }],
      output_config: { format: zodOutputFormat(CopySchema) },
    }, { timeout: 60000, maxRetries: 0 });
    if (response.stop_reason === "refusal") return { data: null, error: "A IA recusou gerar este texto. Revise as evidências do produto." };
    if (!response.parsed_output) return { data: null, error: "A IA respondeu em um formato inesperado. Tente novamente." };
    return { data: response.parsed_output, error: null };
  } catch (error) {
    if (error instanceof Anthropic.APIConnectionTimeoutError) return { data: null, error: "A geração do texto demorou demais. Tente novamente." };
    return { data: null, error: describeAiError(error) };
  }
}
