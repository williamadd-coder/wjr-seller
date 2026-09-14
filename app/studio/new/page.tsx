import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions";
import { NewProductForm } from "./new-product-form";

export default async function NewProductPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  return <div className="shell">
    <aside className="sidebar"><div className="brand">WJR <span>Seller IA</span></div><nav className="nav"><a href="/">Visão geral</a><a className="active" href="/studio/new">Seller Studio</a><a href="/products">Meus Produtos</a></nav><form action={logout} className="sidebarLogout"><button className="button" type="submit">Sair</button></form></aside>
    <main className="main studioPage"><div className="studioHeader"><div><div className="eyebrow">Seller Studio · Novo anúncio</div><h1>Conte tudo o que sabemos sobre o produto.</h1><p>Preencha uma única vez, incluindo as imagens. Depois o WJR Seller organiza as evidências para análise, preço, conteúdo, mídia, Score e prontidão.</p></div></div>
    <NewProductForm />
    </main>
  </div>;
}
