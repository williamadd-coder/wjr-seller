# WJR Seller IA

Plataforma conversion-first para transformar dados de fornecedor em cadastros de marketplace completos, competitivos, mensuráveis e continuamente otimizáveis.

## Objetivo master

Aumentar a probabilidade de conversão por meio da qualidade do cadastro: categoria correta, intenção de busca, título, atributos, descrição, mídia, preço, confiança, logística e completude.

O produto **não promete posição orgânica**. Regras e requisitos de cada marketplace são versionados e ligados à fonte/data de verificação. O sistema aprende com performance real do anúncio.

## Arquitetura

- Next.js + TypeScript
- Supabase para Auth, Postgres e Storage
- Domínio comum de produto + adapters por marketplace
- Shopee como primeiro marketplace
- Score WJR com dimensões de qualidade
- Histórico de performance e experimentos A/B
- Camada `marketplace_rules` para requisitos mutáveis

## Pipeline

1. Ingestão do produto e evidências
2. Normalização e detecção de divergências
3. Pesquisa de mercado e intenção de busca
4. Precificação e margem
5. Geração do cadastro por marketplace
6. Score WJR e bloqueios de qualidade
7. Mídia otimizada
8. Pacote final/publicação
9. Performance, aprendizado e reotimização

## Próximos marcos

- Seller Studio funcional
- Persistência de rascunhos no Supabase
- Autenticação e isolamento por usuário
- Upload/gestão de imagens
- Motor de regras Shopee BR
- Pacote final Shopee
- Importação dos primeiros produtos reais da WJR Mix
- Testes de ponta a ponta
