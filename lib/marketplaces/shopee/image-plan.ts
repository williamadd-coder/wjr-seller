import * as z from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AI_MODEL, MISSING_KEY_MESSAGE, createAnthropic, describeAiError } from "@/lib/ai/anthropic";

const ImagePlanSchema = z.object({
  coverIndex: z.number().int(),
  coverReason: z.string(),
  images: z.array(z.object({
    index: z.number().int(),
    role: z.string(),
    issues: z.array(z.string()),
  })),
  missingShots: z.array(z.string()),
  videoSuggestion: z.string(),
});

export type ShopeeImagePlan = z.infer<typeof ImagePlanSchema>;
export type ImageInput = { mediaType: "image/jpeg" | "image/png" | "image/webp"; base64: string };

const SYSTEM = `Você é especialista em estratégia visual de anúncios na Shopee Brasil.

Recebe as imagens que o vendedor enviou, na ordem informada (índice começa em 0). Responda:
1. "coverIndex": o índice da imagem que deve ser a capa, e "coverReason" explicando em uma frase.
2. "images": para cada imagem, o papel recomendado na sequência (capa, detalhe, escala, embalagem, uso, variação) e os problemas observados.
3. "missingShots": fotos que faltam para a sequência converter melhor.
4. "videoSuggestion": o que o vídeo do anúncio deveria demonstrar.

Regras obrigatórias:
- Descreva somente o que é visível nas imagens. Nunca afirme material, medida, composição ou funcionalidade que a imagem não comprove.
- Considere as diretrizes da Shopee: produto ocupando a maior parte do quadro, fundo simples na capa, imagem nítida, sem marca d'água que prejudique a leitura.
- Escreva tudo em português, em frases curtas e objetivas.`;

export async function planShopeeImages(images: ImageInput[], productName: string): Promise<{ data: ShopeeImagePlan | null; error: string | null }> {
  const client = createAnthropic();
  if (!client) return { data: null, error: MISSING_KEY_MESSAGE };
  if (!images.length) return { data: null, error: "Envie ao menos uma imagem do produto antes de pedir a análise." };
  try {
    const response = await client.messages.parse({
      model: AI_MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM,
      messages: [{
        role: "user",
        content: [
          ...images.map((image) => ({ type: "image" as const, source: { type: "base64" as const, media_type: image.mediaType, data: image.base64 } })),
          { type: "text" as const, text: `Produto: ${productName}. As imagens acima estão na ordem de índice 0 a ${images.length - 1}.` },
        ],
      }],
      output_config: { format: zodOutputFormat(ImagePlanSchema) },
    });
    if (response.stop_reason === "refusal") return { data: null, error: "A IA recusou analisar estas imagens." };
    if (!response.parsed_output) return { data: null, error: "A IA respondeu em um formato inesperado. Tente novamente." };
    return { data: response.parsed_output, error: null };
  } catch (error) {
    return { data: null, error: describeAiError(error) };
  }
}
