import { login, signup } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  return (
    <main className="authPage">
      <section className="authCard">
        <div className="brand">WJR <span>Seller IA</span></div>
        <div className="eyebrow">Sua central de conversão</div>
        <h1>Entre para otimizar seus produtos.</h1>
        <p>Cadastros estruturados, Score WJR, inteligência de mercado e pacote pronto para marketplace.</p>
        {params.error && <div className="authAlert error">{params.error}</div>}
        {params.message && <div className="authAlert">{params.message}</div>}
        <form className="authForm">
          <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
          <label>Senha<input name="password" type="password" autoComplete="current-password" minLength={6} required /></label>
          <button className="button primary" formAction={login}>Entrar</button>
          <button className="button" formAction={signup}>Criar conta</button>
        </form>
      </section>
    </main>
  );
}
