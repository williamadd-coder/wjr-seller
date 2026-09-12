const nav = ["Visão geral", "Seller Studio", "Meus Produtos", "Análises", "Configurações"];

const scorePillars = [
  ["Título", "Busca + clareza + intenção"],
  ["Atributos", "Categoria completa e estruturada"],
  ["Mídia", "Capa, benefícios, prova visual e vídeo"],
  ["Oferta", "Preço, estoque e competitividade"],
  ["Confiança", "SKU, EAN e logística consistente"],
  ["Conversão", "Métricas reais para aprender e melhorar"],
];

export default function Home() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">WJR <span>Seller IA</span></div>
        <nav className="nav">{nav.map((item, i) => <a className={i === 0 ? "active" : ""} href={i === 1 ? "/studio/new" : "#"} key={item}>{item}</a>)}</nav>
      </aside>
      <main className="main">
        <section className="hero">
          <div className="eyebrow">Conversion-first commerce intelligence</div>
          <h1>Cadastre para converter. Aprenda com cada venda.</h1>
          <p>O WJR Seller transforma dados brutos do produto em um cadastro completo, competitivo e adaptado a cada marketplace. Regras oficiais ficam versionadas; performance real alimenta a evolução do anúncio.</p>
          <div className="cta"><a className="button primary" href="/studio/new">Otimizar novo produto</a><a className="button" href="#score">Conhecer o Score WJR</a></div>
        </section>
        <section className="grid"><article className="card"><span>Produtos</span><strong>0</strong><p>Base única para todos os marketplaces.</p></article><article className="card"><span>Cadastros prontos</span><strong>0</strong><p>Conteúdo validado antes da publicação.</p></article><article className="card"><span>Score WJR médio</span><strong>—</strong><p>Qualidade do cadastro orientada à conversão.</p></article></section>
        <section className="section" id="studio"><div className="eyebrow">Seller Studio</div><h2>Pipeline de otimização</h2><div className="steps"><div className="step"><b>1. Ingestão inteligente</b><span>Fornecedor, prints, imagens, custo, estoque, SKU, EAN, peso e dimensões.</span></div><div className="step"><b>2. Inteligência de mercado</b><span>Categoria, termos de busca, concorrência, faixa de preço e padrões de conversão.</span></div><div className="step"><b>3. Cadastro campeão</b><span>Título, atributos, descrição, mídia, preço e checklist específico do marketplace.</span></div></div></section>
        <section className="section" id="score"><div className="eyebrow">Score WJR</div><h2>Não é só preencher campos</h2><div className="scoreGrid">{scorePillars.map(([name, detail]) => <article className="scoreItem" key={name}><b>{name}</b><span>{detail}</span></article>)}</div><p className="note">O score mede qualidade e prontidão do cadastro. Ranking não é prometido: o sistema registra regras verificadas e aprende com impressões, cliques, carrinho e pedidos para melhorar continuamente.</p></section>
      </main>
    </div>
  );
}
