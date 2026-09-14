import { signup } from "@/app/login/actions";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <main className="authPage"><section className="authCard">
    <div className="brand">WJR <span>Seller IA</span></div><div className="eyebrow">Comece agora</div>
    <h1>Crie sua conta.</h1><p>Preencha seus dados para começar a criar anúncios orientados à conversão.</p>
    {params.error && <div className="authAlert error">{params.error}</div>}
    <form className="authForm" action={signup}>
      <label>Nome completo<input name="full_name" autoComplete="name" minLength={3} required /></label>
      <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
      <label>Senha<input name="password" type="password" autoComplete="new-password" minLength={6} required /></label>
      <label>Confirmar senha<input name="confirm_password" type="password" autoComplete="new-password" minLength={6} required /></label>
      <button className="button primary" type="submit">Criar minha conta</button>
    </form>
    <div className="authSwitch"><span>Já tem conta?</span> <a href="/login">Entrar</a></div>
  </section></main>;
}
