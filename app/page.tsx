const nav = ["Visão geral", "Seller Studio", "Meus Produtos", "Análises", "Configurações"];

export default function Home() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">WJR <span>Seller IA</span></div>
        <nav className="nav">{nav.map((item, i) => <a className={i === 0 ? "active" : ""} href="#" key={item}>{item}</a>)}</nav>
      </aside>
      <main className="main">
        <section className="hero">
          <div className="eyebrow">Central de vendas inteligente</div>
          <h1>Do produto ao anúncio pronto para vender.</h1>
          <p>Pesquise concorrentes, organize evidências, calcule preço e margem, gere o anúncio completo e mantenha seus produtos em uma única central.</p>
          <div className="cta"><a className="button primary" href="#studio">Criar novo anúncio</a><a className="button" href="#produtos">Ver meus produtos</a></div>
        </section>
        <section className="grid">
          <article className="card"><span>Produtos</span><strong>0</strong><p>Produtos organizados no WJR Seller.</p></article>
          <article className="card"><span>Anúncios prontos</span><strong>0</strong><p>Conteúdos preparados para publicação.</p></article>
          <article className="card"><span>Margem média</span><strong>—</strong><p>Será calculada a partir dos seus cenários.</p></article>
        </section>
        <section className="section" id="studio"><div className="eyebrow">Seller Studio</div><h2>Fluxo completo do primeiro módulo</h2><div className="steps"><div className="step"><b>1. Produto e evidências</b><span>Dados da WeDrop, imagens, custos e informações disponíveis.</span></div><div className="step"><b>2. Inteligência comercial</b><span>Concorrência, viabilidade, precificação, margem e divergências.</span></div><div className="step"><b>3. Pacote Shopee</b><span>Título, categoria, atributos, descrição, SEO, mídia e checklist final.</span></div></div></section>
      </main>
    </div>
  );
}
