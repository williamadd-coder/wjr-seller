export const SHOPEE_BR_PROFILE = {
  marketplace: "shopee" as const,
  countryCode: "BR",
  version: "2026-09",
  listing: {
    title: {
      maxLength: 120,
      guidance: [
        "Use um título informativo, conciso e fácil de entender.",
        "Priorize produto, marca, linha ou modelo e atributos realmente relevantes.",
        "Evite repetição artificial de palavras-chave e termos imprecisos.",
      ],
    },
    description: {
      maxLength: 3000,
      guidance: [
        "Comece pelas características mais relevantes e diferenciais do produto.",
        "Mantenha a descrição informativa, objetiva e sustentada por evidências do produto.",
      ],
    },
    attributes: {
      guidance: [
        "Preencha atributos obrigatórios e opcionais aplicáveis com dados corretos.",
        "Não invente valores ausentes: marque-os para confirmação.",
      ],
    },
    media: {
      imageAspectRatio: "1:1",
      recommendedMinWidth: 1024,
      recommendedMinHeight: 1024,
      projectMaxFileBytes: 2_000_000,
      guidance: [
        "Use imagens nítidas, bem iluminadas e realistas.",
        "Faça o produto ocupar a maior parte da imagem e prefira fundo simples na capa.",
        "Inclua ângulos, variações, embalagem, escala e demonstração de uso quando aplicável.",
        "Evite acessórios irrelevantes e marcas d'água que prejudiquem a leitura do produto.",
        "Vídeos devem demonstrar o produto de forma clara; evite apresentação estática de slides.",
      ],
    },
  },
  principles: {
    conversionFirst: true,
    evidenceFirst: true,
    noRankingGuarantee: true,
  },
} as const;

export type ShopeeProfile = typeof SHOPEE_BR_PROFILE;
