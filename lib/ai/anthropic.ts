import Anthropic from "@anthropic-ai/sdk";

export const AI_MODEL = "claude-opus-5";
export const MISSING_KEY_MESSAGE = "A chave da IA não está configurada. Adicione ANTHROPIC_API_KEY nas variáveis de ambiente do site.";

/** Returns null when the key is absent so the listing flow degrades instead of failing. */
export function createAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return apiKey ? new Anthropic({ apiKey }) : null;
}

export function describeAiError(error: unknown) {
  if (error instanceof Anthropic.AuthenticationError) return "A chave da IA foi recusada. Confira o valor de ANTHROPIC_API_KEY.";
  if (error instanceof Anthropic.RateLimitError) return "A IA atingiu o limite de requisições. Tente novamente em alguns instantes.";
  if (error instanceof Anthropic.APIConnectionError) return "Não foi possível falar com a IA agora. Tente novamente.";
  if (error instanceof Anthropic.APIError) return `A IA respondeu com erro ${error.status}. Tente novamente.`;
  return "Falha inesperada ao consultar a IA.";
}
