import type { ResearchAttempt } from "./public-research";
export function researchMessage(attempt?: ResearchAttempt | null) {
  switch (attempt?.status) {
    case "provider_auth_failed": return { title:"Fonte alternativa indisponível", detail:"A conexão com o serviço de pesquisa precisa ser revisada pelo responsável pelo sistema." };
    case "provider_limit": return { title:"Limite temporário da fonte de pesquisa", detail:"O serviço de pesquisa atingiu o limite de uso. As referências já salvas continuam disponíveis." };
    case "provider_not_configured": return { title:"Fonte alternativa ainda não conectada", detail:"A fonte alternativa de pesquisa precisa ser ativada pelo responsável pelo sistema." };
    case "blocked": return { title:"Shopee recusou a consulta automática", detail:"A Shopee restringiu o acesso nesta tentativa. Isso não significa que não existam anúncios. Repetir a consulta pode continuar sem resultados enquanto a restrição persistir." };
    case "timeout": return { title:"A pesquisa excedeu o tempo de espera", detail:"Não foi possível concluir a consulta a tempo. Você pode tentar novamente." };
    case "unavailable": return { title:"Resultados da Shopee indisponíveis nesta consulta", detail:"A resposta recebida não trouxe dados de anúncios que possam ser verificados. Isso não significa ausência de concorrentes." };
    case "no_matches": return { title:"Nenhum anúncio comparável nesta amostra", detail:"A consulta respondeu, mas os resultados recebidos não atenderam ao critério de similaridade. Isso não representa todos os anúncios disponíveis na Shopee." };
    case "save_failed": return { title:"Não foi possível salvar a pesquisa", detail:"Foram encontrados resultados, mas a gravação das evidências falhou. A tentativa não foi marcada como concluída. Tente novamente." };
    case "invalid_input": return { title:"Dados insuficientes para pesquisar", detail:"O nome do produto precisa conter termos que identifiquem o item." };
    case "completed": return { title:"Pesquisa concluída", detail:"As evidências da pesquisa foram registradas." };
    default: return { title:"Pesquisa sem resultado registrado", detail:"Ainda não há um resultado verificável desta pesquisa. Tente pesquisar para obter resultados ou o motivo da indisponibilidade." };
  }
}
export function isAutomaticResearch(source: unknown) {
  return typeof source === "string" && ["shopee_public_search","shopee_public_api","shopee_public_html","shopee_public_mixed"].includes(source);
}
