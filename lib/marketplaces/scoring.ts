import type { ListingDraft, ListingScore, ScoreDimension } from "./types";
import { SHOPEE_BR_PROFILE } from "./shopee/profile";

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const dimension = (score: number, weight: number, issues: string[] = [], wins: string[] = []): ScoreDimension => ({ score: clamp(score), weight, issues, wins });
const filled = (value: unknown) => value !== undefined && value !== null && value !== "" && value !== 0;

export function scoreListing(draft: ListingDraft): ListingScore {
  const blockers: string[] = [];
  const recommendations: string[] = [];
  const profile = draft.marketplace === "shopee" ? SHOPEE_BR_PROFILE : null;
  const titleMaxLength = profile?.listing.title.maxLength ?? 120;
  const descriptionMaxLength = profile?.listing.description.maxLength ?? 3000;

  const titleIssues: string[] = [];
  let titleScore = 100;
  const titleText = draft.title.trim();
  if (!titleText) { titleScore = 0; blockers.push("Título obrigatório"); }
  if (titleText.length > 0 && titleText.length < 35) { titleScore -= 25; titleIssues.push("Título curto: use atributos confirmados que ajudem o comprador a identificar o produto"); }
  if (titleText.length > titleMaxLength) { titleScore -= 45; blockers.push(`Título excede o limite de ${titleMaxLength} caracteres`); }
  if (/!!!|\?\?\?|🔥|🚨/u.test(titleText)) { titleScore -= 15; titleIssues.push("Evite excesso de símbolos promocionais"); }
  const titleWords = titleText.toLowerCase().split(/\s+/).filter(Boolean);
  if (titleWords.length >= 6 && new Set(titleWords).size / titleWords.length < 0.7) { titleScore -= 12; titleIssues.push("Título repete termos em excesso; prefira informação nova e relevante"); }
  const title = dimension(titleScore, 0.20, titleIssues, titleScore >= 85 ? ["Título claro, dentro do limite e sem spam aparente"] : []);

  const attrCount = Object.values(draft.attributes).filter(v => v !== null && v !== undefined && String(v).trim() !== "").length;
  const attrIssues: string[] = [];
  if (!draft.categoryId) { blockers.push("Defina a categoria antes da publicação"); attrIssues.push("Categoria ainda não confirmada"); }
  if (attrCount === 0) blockers.push("Confirme os atributos aplicáveis da categoria");
  if (attrCount < 5) attrIssues.push("Poucos atributos confirmados: complete os aplicáveis sem inventar valores");
  const attributes = dimension(attrCount >= 8 ? 100 : attrCount * 12.5, 0.16, attrIssues, attrCount >= 8 ? ["Boa cobertura de atributos confirmados"] : []);

  const descLen = draft.description.trim().length;
  let descScore = descLen >= 450 ? 100 : descLen / 4.5;
  const descIssues: string[] = [];
  if (!draft.description.trim()) blockers.push("Descrição obrigatória");
  if (descLen > descriptionMaxLength) { descScore -= 45; blockers.push(`Descrição excede o limite de ${descriptionMaxLength} caracteres`); }
  if (descLen < 180) descIssues.push("Descrição curta: responda características, conteúdo e uso somente com evidências confirmadas");
  if (!/caracter|detalh|conteúdo|inclui|especific/i.test(draft.description)) { descScore -= 10; descIssues.push("Organize características e especificações para facilitar a decisão de compra"); }
  const description = dimension(descScore, 0.14, descIssues, descLen >= 300 ? ["Descrição oferece contexto suficiente para revisão comercial"] : []);

  const mediaScore = Math.min(100, draft.imageCount * 14 + (draft.hasVideo ? 20 : 0));
  const mediaIssues: string[] = [];
  if (draft.imageCount === 0) blockers.push("Adicione pelo menos uma imagem do produto");
  if (draft.imageCount < 5) mediaIssues.push("Use uma sequência visual mais completa: capa, detalhes, escala, embalagem e uso quando aplicável");
  if (!draft.hasVideo) mediaIssues.push("Vídeo demonstrativo com movimento real pode melhorar compreensão do produto");
  const media = dimension(mediaScore, 0.18, mediaIssues, draft.imageCount >= 5 ? ["Boa cobertura visual"] : []);

  let offerScore = 100;
  const offerIssues: string[] = [];
  if (!draft.price || draft.price <= 0) { offerScore -= 50; blockers.push("Defina um preço de venda válido"); offerIssues.push("Preço ainda não definido"); }
  if (draft.stock === undefined || draft.stock <= 0) { offerScore -= 35; blockers.push("Informe estoque disponível"); offerIssues.push("Estoque indisponível ou não informado"); }
  const offer = dimension(offerScore, 0.12, offerIssues, offerScore === 100 ? ["Preço e estoque preenchidos"] : []);

  let trustScore = 30;
  const trustWins: string[] = [];
  if (draft.sku) { trustScore += 20; trustWins.push("SKU informado"); }
  if (draft.ean) { trustScore += 20; trustWins.push("EAN informado"); }
  if (draft.weightKg) { trustScore += 15; trustWins.push("Peso informado"); }
  if (draft.dimensions?.widthCm && draft.dimensions?.heightCm && draft.dimensions?.lengthCm) { trustScore += 15; trustWins.push("Dimensões completas"); }
  const trust = dimension(trustScore, 0.08, trustScore < 80 ? ["Complete identificadores e dados logísticos confirmados"] : [], trustWins);

  const required = [draft.title, draft.categoryId, draft.description, draft.price, draft.stock, draft.sku, draft.weightKg, draft.dimensions?.widthCm, draft.dimensions?.heightCm, draft.dimensions?.lengthCm];
  const completeCount = required.filter(filled).length;
  const completeness = dimension((completeCount / required.length) * 100, 0.12, completeCount < required.length ? ["Existem campos essenciais pendentes"] : [], completeCount === required.length ? ["Campos essenciais preenchidos"] : []);

  const dims = { title, attributes, description, media, offer, trust, completeness };
  const total = clamp(Object.values(dims).reduce((sum, d) => sum + d.score * d.weight, 0));
  Object.values(dims).flatMap(d => d.issues).forEach(issue => { if (!recommendations.includes(issue)) recommendations.push(issue); });
  return { total, ...dims, blockers: [...new Set(blockers)], recommendations };
}
