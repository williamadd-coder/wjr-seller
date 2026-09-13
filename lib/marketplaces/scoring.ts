import type { ListingDraft, ListingScore, ScoreDimension } from "./types";
import { SHOPEE_BR_PROFILE } from "./shopee/profile";

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const dimension = (score: number, weight: number, issues: string[] = [], wins: string[] = []): ScoreDimension => ({ score: clamp(score), weight, issues, wins });

export function scoreListing(draft: ListingDraft): ListingScore {
  const blockers: string[] = [];
  const recommendations: string[] = [];
  const profile = draft.marketplace === "shopee" ? SHOPEE_BR_PROFILE : null;
  const titleMaxLength = profile?.listing.title.maxLength ?? 120;
  const descriptionMaxLength = profile?.listing.description.maxLength;

  const titleIssues: string[] = [];
  let titleScore = 100;
  if (!draft.title.trim()) { titleScore = 0; blockers.push("Título obrigatório"); }
  if (draft.title.length < 35) { titleScore -= 25; titleIssues.push("Título curto para explorar intenção de busca"); }
  if (draft.title.length > titleMaxLength) { titleScore -= 45; blockers.push(`Título excede o limite de ${titleMaxLength} caracteres`); }
  if (/!!!|\?\?\?|🔥|🚨/u.test(draft.title)) { titleScore -= 15; titleIssues.push("Evite excesso de símbolos promocionais"); }
  const title = dimension(titleScore, 0.20, titleIssues, titleScore >= 85 ? ["Título forte e legível"] : []);

  const attrCount = Object.values(draft.attributes).filter(v => v !== null && v !== undefined && String(v).trim() !== "").length;
  const attributes = dimension(attrCount >= 8 ? 100 : attrCount * 12.5, 0.16, attrCount < 8 ? ["Preencha mais atributos relevantes da categoria"] : [], attrCount >= 8 ? ["Boa cobertura de atributos"] : []);

  const descLen = draft.description.trim().length;
  let descScore = descLen >= 450 ? 100 : descLen / 4.5;
  const descIssues: string[] = [];
  if (descLen < 180) descIssues.push("Descrição precisa responder benefícios, uso, especificações e dúvidas");
  if (descriptionMaxLength && descLen > descriptionMaxLength) { descScore -= 45; blockers.push(`Descrição excede o limite de ${descriptionMaxLength} caracteres`); }
  if (!/benef|vantag|ideal|indicado|inclui|conteúdo|caracter/i.test(draft.description)) { descScore -= 12; descIssues.push("Faltam sinais claros de benefícios ou características"); }
  const description = dimension(descScore, 0.14, descIssues);

  const mediaScore = Math.min(100, draft.imageCount * 14 + (draft.hasVideo ? 20 : 0));
  const mediaIssues: string[] = [];
  if (draft.imageCount < 5) mediaIssues.push("Use uma sequência visual mais completa");
  if (!draft.hasVideo) mediaIssues.push("Vídeo demonstrativo pode aumentar compreensão e confiança");
  const media = dimension(mediaScore, 0.18, mediaIssues, draft.imageCount >= 5 ? ["Boa cobertura visual"] : []);

  let offerScore = 100;
  const offerIssues: string[] = [];
  if (!draft.price || draft.price <= 0) { offerScore -= 50; offerIssues.push("Preço ainda não definido"); }
  if (draft.stock === undefined || draft.stock <= 0) { offerScore -= 35; offerIssues.push("Estoque indisponível ou não informado"); }
  const offer = dimension(offerScore, 0.12, offerIssues);

  let trustScore = 30;
  const trustWins: string[] = [];
  if (draft.sku) { trustScore += 20; trustWins.push("SKU informado"); }
  if (draft.ean) { trustScore += 20; trustWins.push("EAN informado"); }
  if (draft.weightKg) { trustScore += 15; trustWins.push("Peso informado"); }
  if (draft.dimensions?.widthCm && draft.dimensions?.heightCm && draft.dimensions?.lengthCm) { trustScore += 15; trustWins.push("Dimensões completas"); }
  const trust = dimension(trustScore, 0.08, trustScore < 80 ? ["Complete identificadores e dados logísticos"] : [], trustWins);

  const required = [draft.title, draft.categoryId, draft.description, draft.price, draft.stock, draft.sku, draft.weightKg, draft.dimensions?.widthCm, draft.dimensions?.heightCm, draft.dimensions?.lengthCm];
  const filled = required.filter(Boolean).length;
  const completeness = dimension((filled / required.length) * 100, 0.12, filled < required.length ? ["Existem campos essenciais pendentes"] : []);

  const dims = { title, attributes, description, media, offer, trust, completeness };
  const total = clamp(Object.values(dims).reduce((sum, d) => sum + d.score * d.weight, 0));

  Object.values(dims).flatMap(d => d.issues).forEach(issue => { if (!recommendations.includes(issue)) recommendations.push(issue); });
  return { total, ...dims, blockers, recommendations };
}
