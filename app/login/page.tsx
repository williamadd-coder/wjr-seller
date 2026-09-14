import { login } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  return (
    <main className="authPage"><section className="authCard">
      <div className="brand">WJR <span>Seller IA</span></div><div className="eyebrow">Sua central de conversão</div>
      <h1>Entre na sua conta.</h1><p>Acesse seus produtos, análises e anúncios preparados para marketplace.</p>
      {params.error && <div className="authAlert error">{params.error}</div>}{params.message && <div className="authAlert">{params.message}</div>}
      <form className="authForm" action={login}>
        <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
        <label>Senha<input name="password" type="password" autoComplete="current-password" minLength={6} required /></label>
        <button className="button primary" type="submit">Entrar</button>
      </form>
      <div className="authSwitch"><span>Ainda não tem conta?</span> <a href="/signup">Criar conta</a></div>
    </section></main>
  );
}
