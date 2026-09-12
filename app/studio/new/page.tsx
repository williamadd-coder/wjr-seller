import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createProductDraft } from "./actions";

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  const params = await searchParams;

  return (
    <main className="studioPage">
      <div className="studioHeader">
        <div><div className="eyebrow">Seller Studio · Etapa 1</div><h1>Produto e evidências</h1><p>Comece com o que você sabe. O WJR Seller vai transformar esta base em um cadastro orientado à conversão.</p></div>
        <div className="scoreBadge"><span>Score WJR</span><strong>—</strong><small>calculado após a análise</small></div>
      </div>
      {params.error && <div className="authAlert error">{params.error}</div>}
      <form action={createProductDraft} className="studioForm">
        <section className="formSection"><h2>Identificação</h2><div className="formGrid">
          <label className="wide">Nome do produto<input name="name" required placeholder="Ex.: Jogo Blocos de Construção com Pista de Bolinhas" /></label>
          <label>Fornecedor<input name="supplier" placeholder="Ex.: WeDrop" /></label><label>SKU<input name="sku" /></label>
          <label>EAN<input name="ean" inputMode="numeric" /></label><label>Marca<input name="brand" /></label><label>Modelo<input name="model" /></label>
          <label className="wide">Link do fornecedor<input name="supplier_url" type="url" placeholder="https://..." /></label>
        </div></section>
        <section className="formSection"><h2>Oferta e estoque</h2><div className="formGrid"><label>Custo (R$)<input name="cost" inputMode="decimal" /></label><label>Estoque<input name="stock" type="number" min="0" /></label></div></section>
        <section className="formSection"><h2>Pacote para envio</h2><div className="formGrid"><label>Peso (kg)<input name="weight_kg" inputMode="decimal" /></label><label>Largura (cm)<input name="width_cm" inputMode="decimal" /></label><label>Altura (cm)<input name="height_cm" inputMode="decimal" /></label><label>Comprimento (cm)<input name="length_cm" inputMode="decimal" /></label></div></section>
        <div className="formActions"><a className="button" href="/">Cancelar</a><button className="button primary" type="submit">Salvar e continuar →</button></div>
      </form>
    </main>
  );
}
