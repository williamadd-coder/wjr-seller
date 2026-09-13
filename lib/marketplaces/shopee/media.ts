import { SHOPEE_BR_PROFILE } from "./profile";

export type MediaCandidate = {
  kind: "image" | "video";
  name: string;
  sizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
};

export type MediaValidation = {
  valid: boolean;
  blockers: string[];
  recommendations: string[];
};

export function validateShopeeMedia(candidate: MediaCandidate): MediaValidation {
  const blockers: string[] = [];
  const recommendations: string[] = [];
  const rules = SHOPEE_BR_PROFILE.listing.media;

  if (candidate.kind === "image") {
    if (candidate.sizeBytes != null && candidate.sizeBytes >= rules.projectMaxFileBytes) {
      blockers.push(`Imagem ${candidate.name} precisa ter menos de 2 MB.`);
    }
    if (candidate.width && candidate.height) {
      if (candidate.width !== candidate.height) recommendations.push(`Imagem ${candidate.name}: prefira proporção quadrada 1:1.`);
      if (candidate.width < rules.recommendedMinWidth || candidate.height < rules.recommendedMinHeight) recommendations.push(`Imagem ${candidate.name}: prefira pelo menos ${rules.recommendedMinWidth}×${rules.recommendedMinHeight}px.`);
    } else {
      recommendations.push(`Imagem ${candidate.name}: confirme resolução e proporção antes da publicação.`);
    }
  }

  if (candidate.kind === "video") {
    recommendations.push(`Vídeo ${candidate.name}: confirme que demonstra movimento ou uso real do produto e não é apenas uma sequência estática.`);
  }

  return { valid: blockers.length === 0, blockers, recommendations };
}

export function validateShopeeMediaSet(candidates: MediaCandidate[]) {
  const results = candidates.map((candidate) => ({ candidate, validation: validateShopeeMedia(candidate) }));
  const images = candidates.filter((item) => item.kind === "image");
  const videos = candidates.filter((item) => item.kind === "video");
  const blockers = results.flatMap((item) => item.validation.blockers);
  const recommendations = results.flatMap((item) => item.validation.recommendations);

  if (!images.length) blockers.push("Adicione ao menos uma imagem do produto.");
  if (images.length < 5) recommendations.push("Para um cadastro mais forte, monte uma sequência com capa, detalhes, escala, benefícios e uso quando aplicável.");
  if (!videos.length) recommendations.push("Adicione um vídeo demonstrativo quando o produto se beneficiar de demonstração em movimento.");

  return { valid: blockers.length === 0, blockers: [...new Set(blockers)], recommendations: [...new Set(recommendations)], results };
}
