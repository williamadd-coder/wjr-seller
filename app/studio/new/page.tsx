import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createProductDraft } from "./actions";
import { logout } from "@/app/actions";

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient(); const { data } = await supabase.auth.getClaims(); if (!data?.claims?.sub) redirect("/login"); const params = await searchParams;
  return <div className="shell">
    <aside className="sidebar"><div className="brand">WJR <span>Seller IA</span></div><nav className="nav"><a href="/">Visão geral</a><a className="active" href="/studio/new">Seller Studio</a><a href="/products">Meus Produtos</a></nav><form action={logout} className="sidebarLogout"><button className="button" type="submit">Sair</button></form></aside>
    <main className="main studioPage"><div className="studioHeader"><div><div className="eyebrow">Seller Studio · Novo anúncio</div><h1>Conte tudo o que sabemos sobre o produto.</h1><p>Preencha uma única vez. Depois o WJR Seller organiza as evidências para análise, preço, conteúdo, mídia, Score e prontidão.</p></div></div>
    {params.error && <div className="authAlert error">{params.error}</div>}
    <form action={createProductDraft} className="studioForm">
      <section className="formSection"><h2>1. Identificação</h2><p className="note">Copie os dados confirmados do fornecedor. O link é opcional e serve como referência; áreas que exigem login não são lidas automaticamente.</p><div className="formGrid">
        <label className="wide">Nome do produto<input name="name" required /></label><label>Fornecedor<input name="supplier" /></label><label>SKU<input name="sku" /></label><label>EAN<input name="ean" inputMode="numeric" /></label><label>Marca<input name="brand" /></label><label>Modelo<input name="model" /></label><label>Custo (R$)<input name="cost" inputMode="decimal" /></label><label className="wide">Link de referência do fornecedor (opcional)<input name="supplier_url" type="url" placeholder="https://..." /></label>
      </div></section>
      <section className="formSection"><h2>2. Especificações técnicas do produto</h2><div className="formGrid"><label>NCM<input name="ncm" inputMode="numeric" /></label><label>Peso (kg)<input name="product_weight_kg" inputMode="decimal" /></label><label>Altura (cm)<input name="product_height_cm" inputMode="decimal" /></label><label>Largura (cm)<input name="product_width_cm" inputMode="decimal" /></label><label>Comprimento (cm)<input name="product_length_cm" inputMode="decimal" /></label></div></section>
      <section className="formSection"><h2>3. Itens inclusos</h2><label className="wide">O que vem com o produto?<textarea name="items_included" rows={5} placeholder="Cole ou descreva todos os itens informados pelo fornecedor." /></label></section>
      <section className="formSection"><h2>4. Pacote para envio</h2><p className="note">Use aqui as medidas da embalagem de transporte, não as dimensões do produto montado.</p><div className="formGrid"><label>Peso do pacote (kg)<input name="package_weight_kg" inputMode="decimal" /></label><label>Altura (cm)<input name="package_height_cm" inputMode="decimal" /></label><label>Largura (cm)<input name="package_width_cm" inputMode="decimal" /></label><label>Comprimento (cm)<input name="package_length_cm" inputMode="decimal" /></label></div></section>
      <section className="formSection"><h2>5. Descrição do fornecedor</h2><label className="wide">Descrição completa<textarea name="supplier_description" rows={10} placeholder="Cole aqui toda a descrição fornecida pela WeDrop/fornecedor. A IA usará como evidência, sem inventar características." /></label></section>
      <section className="formSection"><h2>6. Imagens do anúncio</h2><p className="note">Na próxima tela você poderá adicionar até 5 imagens originais do fornecedor. Elas serão otimizadas para menos de 2 MB antes do armazenamento. O WJR Seller usará esse material como base para a estratégia visual; vídeo gerado por IA será liberado quando houver um motor de vídeo real integrado.</p></section>
      <div className="formActions"><a className="button" href="/">Cancelar</a><button className="button primary" type="submit">Gerar anúncio →</button></div>
    </form></main>
  </div>;
}
