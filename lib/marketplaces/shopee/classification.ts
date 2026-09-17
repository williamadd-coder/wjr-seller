import * as z from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AI_MODEL, MISSING_KEY_MESSAGE, createAnthropic, describeAiError } from "@/lib/ai/anthropic";

const ClassificationSchema = z.object({
  categoryPath: z.string(),
  confidence: z.enum(["alta", "media", "baixa"]),
  reason: z.string(),
  attributes: z.array(z.object({
    name: z.string(),
    required: z.boolean(),
    value: z.string(),
    basis: z.enum(["evidencia", "inferido", "desconhecido"]),
  })),
});

export type ShopeeClassification = z.infer<typeof ClassificationSchema>;
export type ClassificationSeed = {
  name: string;
  brand?: string | null;
  model?: string | null;
  ean?: string | null;
  supplierDescription?: string | null;
  confirmedAttributes?: Record<string, string>;
};

const SYSTEM = `Você é especialista em cadastro de produtos no marketplace Shopee Brasil.

A partir das evidências de um produto, responda:
1. "categoryPath": a categoria mais provável da Shopee Brasil, no formato "Categoria > Subcategoria" usando a nomenclatura real da plataforma.
2. "attributes": os atributos que a Shopee normalmente exibe nessa categoria, marcando em "required" os que costumam ser obrigatórios.

Regras obrigatórias:
- Preencha "value" apenas quando as evidências sustentarem o valor; nesse caso use basis "evidencia".
- Se o valor for uma dedução razoável mas não comprovada, use basis "inferido".
- Se não houver como saber, deixe "value" vazio e use basis "desconhecido".
- Nunca invente medidas, composição, certificações, garantia ou origem.
- No máximo 12 atributos, ordenados pelos que mais ajudam na conversão.
- Escreva "reason" em uma frase curta, em português, explicando a escolha da categoria.`;

const evidenceText = (seed: ClassificationSeed) => [
  `Nome: ${seed.name}`,
  seed.brand ? `Marca: ${seed.brand}` : null,
  seed.model ? `Modelo: ${seed.model}` : null,
  seed.ean ? `EAN/GTIN: ${seed.ean}` : null,
  seed.supplierDescription ? `Descrição do fornecedor: ${seed.supplierDescription}` : null,
  Object.keys(seed.confirmedAttributes ?? {}).length
    ? `Atributos já confirmados: ${Object.entries(seed.confirmedAttributes!).map(([k, v]) => `${k}=${v}`).join("; ")}`
    : null,
].filter(Boolean).join("\n");

export async function suggestShopeeClassification(seed: ClassificationSeed): Promise<{ data: ShopeeClassification | null; error: string | null }> {
  const client = createAnthropic();
  if (!client) return { data: null, error: MISSING_KEY_MESSAGE };
  if (!seed.name?.trim()) return { data: null, error: "Informe o nome do produto antes de pedir a sugestão." };
  try {
    const response = await client.messages.parse({
      model: AI_MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM,
      messages: [{ role: "user", content: evidenceText(seed) }],
      output_config: { format: zodOutputFormat(ClassificationSchema) },
    });
    if (response.stop_reason === "refusal") return { data: null, error: "A IA recusou esta solicitação. Revise as evidências do produto." };
    if (!response.parsed_output) return { data: null, error: "A IA respondeu em um formato inesperado. Tente novamente." };
    return { data: response.parsed_output, error: null };
  } catch (error) {
    return { data: null, error: describeAiError(error) };
  }
}
