type Product = Record<string, any>;
type Listing = Record<string, any>;
type Analysis = Record<string, any> | null;
type Pricing = Record<string, any> | null;
type Asset = Record<string, any>;

export function buildShopeeFinalPackage(product: Product, listing: Listing, analysis: Analysis, pricing: Pricing, assets: Asset[]) {
  const attributes = listing.attributes ?? {};
  const images = assets.filter((a) => a.asset_type === "image");
  const videos = assets.filter((a) => a.asset_type === "video");
  const blockers: string[] = listing.score_breakdown?.blockers ?? [];
  const pending = [...blockers];

  if (!listing.category) pending.push("Confirmar categoria Shopee");
  if (!pricing?.sale_price) pending.push("Definir preço de venda com taxas e margem");
  if (!images.length) pending.push("Adicionar imagens quadradas do produto (arquivos abaixo de 2 MB)");
  if (!videos.length) pending.push("Adicionar vídeo demonstrando o produto em uso");
  if (!product.weight_kg || !product.width_cm || !product.height_cm || !product.length_cm) pending.push("Confirmar peso e dimensões do pacote");

  return {
    marketplace: "Shopee",
    score: listing.listing_score ?? product.wjr_score ?? null,
    ready: pending.length === 0,
    fields: [
      ["Nome do produto", listing.title || "PENDENTE"],
      ["Categoria", listing.category || "PENDENTE"],
      ["Descrição", listing.description || "PENDENTE"],
      ["Marca", attributes.marca || product.brand || "PENDENTE"],
      ["Modelo", attributes.modelo || product.model || "PENDENTE"],
      ["EAN", product.ean || "PENDENTE"],
      ["SKU", product.sku || "PENDENTE"],
      ["Preço", pricing?.sale_price ?? "PENDENTE"],
      ["Estoque", product.stock ?? "PENDENTE"],
      ["Peso do pacote (kg)", product.weight_kg ?? "PENDENTE"],
      ["Largura do pacote (cm)", product.width_cm ?? "PENDENTE"],
      ["Altura do pacote (cm)", product.height_cm ?? "PENDENTE"],
      ["Comprimento do pacote (cm)", product.length_cm ?? "PENDENTE"],
      ["Palavras-chave", Array.isArray(listing.keywords) ? listing.keywords.join(", ") : "PENDENTE"],
    ],
    media: { images, videos },
    market: analysis ? { priceMin: analysis.price_min, priceMedian: analysis.price_median, priceMax: analysis.price_max, rationale: analysis.rationale } : null,
    pending: [...new Set(pending)],
  };
}
