# Pesquisa de mercado Shopee

## Fluxo

1. Consulta direta pública à Shopee com orçamento de 18 segundos. Recusas não são contornadas.
2. Sem evidência direta e com `TAVILY_API_KEY`, uma consulta Tavily Search basic, restrita a `shopee.com.br`, com até oito resultados e oito segundos de timeout. Não usa resposta de IA, conteúdo bruto, extração de páginas ou parâmetros automáticos.
3. Aceita somente URLs HTTPS de produtos Shopee e títulos comparáveis, com deduplicação por loja/item. Resultados de busca e categoria não entram na amostra.
4. Grava fonte, data de coleta, links, contagem e diagnóstico nos campos JSON existentes. Só considera concluída uma pesquisa cuja gravação foi confirmada.

## Preços e evidência

Preços da coleta direta podem compor a faixa e recomendação. Valores de um índice externo são apenas referências: podem estar desatualizados e não comprovam a oferta vigente. São salvos separadamente em `indexedPrice`, acompanhados do trecho que os sustenta e da data de coleta (não da data de atualização do anúncio).

Trechos com múltiplos preços, parcelas, frete, cupom, desconto ou preço inicial ficam sem preço de referência. Resultados externos nunca preenchem `price_min`, `price_median` ou `price_max` e não substituem faixas verificadas na recomendação automática. Não são usados para confirmar atributos do produto.

## Ativação

1. Obter uma chave da conta do responsável em https://app.tavily.com/ . Não colocar a chave no chat ou no repositório.
2. No projeto Netlify `wjr-seller`, adicionar `TAVILY_API_KEY` como segredo com escopo Functions, no contexto desejado (produção e/ou deploy preview).
3. Publicar a versão com esta integração e testar o botão de pesquisa no produto cadastrado.
4. Conferir fonte Tavily, links de produtos, contagem de amostra e os rótulos dos preços indexados. Uma resposta sem ofertas não comprova ausência de concorrência na plataforma.

A chave fica exclusivamente no servidor, sem prefixo NEXT_PUBLIC. Configurar limites de uso na conta do serviço. Cada tentativa que chega ao índice faz no máximo uma consulta basic; repetidas tentativas podem consumir créditos. Não há repetição automática após erro de autenticação ou limite. A aplicação não contrata planos nem ativa cobrança.

Sem chave, a pesquisa direta e seus diagnósticos permanecem funcionais. Código 401/403 do provedor indica problema de conexão; 429/432/433 indica limite. Os diagnósticos não gravam a chave nem o corpo de erros do provedor.

## Validação

`npm run test:research` testa o coletor direto, fallback com respostas controladas, links, preços, limites, timeout e persistência. `npm run build` verifica a integração Next.js. O teste ao vivo do índice depende da credencial; testes com respostas controladas não comprovam disponibilidade real nem cobertura dos anúncios.

Referências oficiais: https://docs.tavily.com/documentation/api-reference/endpoint/search e https://docs.tavily.com/documentation/api-credits .
