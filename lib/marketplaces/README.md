# Marketplace Intelligence Layer

O WJR Seller não deve codificar regras de ranking como verdades permanentes. Marketplaces alteram limites, atributos, políticas, taxas e sinais de qualidade.

## Princípios

1. **Conversão primeiro:** cadastro completo, legível, confiável e orientado à intenção de compra.
2. **Regras versionadas:** limites e requisitos específicos ficam em `marketplace_rules`, com fonte e data de verificação.
3. **Sem promessas de ranking:** o score WJR mede qualidade e prontidão do cadastro; não afirma garantir posição orgânica.
4. **Aprendizado por resultado:** `listing_performance_snapshots` registra impressões, cliques, carrinho, pedidos e receita para comparar qualidade do cadastro com resultado real.
5. **Experimentos:** `listing_experiments` permite testar títulos, imagens, ofertas e outros elementos sem destruir o histórico.
6. **Adapters por marketplace:** Shopee é o primeiro adapter. Mercado Livre, Amazon, Magalu e TikTok Shop devem reutilizar o domínio comum e aplicar regras próprias.

## Score WJR

O score base considera título, atributos, descrição, mídia, oferta, confiança e completude. Pesos e regras específicas poderão ser calibrados por marketplace e categoria usando dados reais de performance.
