type Product = Record<string, any>;
type Listing = Record<string, any>;
type Analysis = Record<string, any> | null;
type Pricing = Record<string, any> | null;
type Asset = Record<string, any>;

type FieldStatus = "Confirmado" | "Sugestão comercial" | "Confirmar com fornecedor" | "Deixar vazio" | "Validar com contador";
type PackageField = { section: string; label: string; value: unknown; status: FieldStatus };

const field = (section: string, label: string, value: unknown, status: FieldStatus): PackageField => ({ section, label, value: value ?? "PENDENTE", status });

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

  const fields: PackageField[] = [
    field("1. Informação básica", "Nome do produto", listing.title, listing.title ? "Sugestão comercial" : "Confirmar com fornecedor"),
    field("1. Informação básica", "Categoria", listing.category, listing.category ? "Confirmado" : "Confirmar com fornecedor"),
    field("1. Informação básica", "Descrição", listing.description, listing.description ? "Sugestão comercial" : "Confirmar com fornecedor"),
    field("2. Especificação", "Marca", attributes.marca || product.brand, attributes.marca || product.brand ? "Confirmado" : "Confirmar com fornecedor"),
    field("2. Especificação", "Modelo", attributes.modelo || product.model, attributes.modelo || product.model ? "Confirmado" : "Deixar vazio"),
    field("2. Especificação", "EAN", product.ean, product.ean ? "Confirmado" : "Confirmar com fornecedor"),
    field("2. Especificação", "SKU", product.sku, product.sku ? "Confirmado" : "Confirmar com fornecedor"),
    field("3. Descrição", "Palavras-chave", Array.isArray(listing.keywords) ? listing.keywords.join(", ") : null, "Sugestão comercial"),
    field("4. Informações de vendas", "Preço", pricing?.sale_price, pricing?.sale_price ? "Sugestão comercial" : "Confirmar com fornecedor"),
    field("4. Informações de vendas", "Estoque", product.stock, product.stock != null ? "Confirmado" : "Confirmar com fornecedor"),
    field("5. Informações fiscais", "NCM", product.source_data?.ncm, product.source_data?.ncm ? "Confirmado" : "Validar com contador"),
    field("5. Informações fiscais", "Origem fiscal", product.source_data?.fiscal_origin, product.source_data?.fiscal_origin ? "Confirmado" : "Validar com contador"),
    field("6. Envio", "Peso do pacote (kg)", product.weight_kg, product.weight_kg ? "Confirmado" : "Confirmar com fornecedor"),
    field("6. Envio", "Largura do pacote (cm)", product.width_cm, product.width_cm ? "Confirmado" : "Confirmar com fornecedor"),
    field("6. Envio", "Altura do pacote (cm)", product.height_cm, product.height_cm ? "Confirmado" : "Confirmar com fornecedor"),
    field("6. Envio", "Comprimento do pacote (cm)", product.length_cm, product.length_cm ? "Confirmado" : "Confirmar com fornecedor"),
  ];

  return {
    marketplace: "Shopee",
    score: listing.listing_score ?? product.wjr_score ?? null,
    ready: pending.length === 0,
    fields,
    media: { images, videos },
    market: analysis ? { priceMin: analysis.price_min, priceMedian: analysis.price_median, priceMax: analysis.price_max, rationale: analysis.rationale } : null,
    pending: [...new Set(pending)],
  };
}
