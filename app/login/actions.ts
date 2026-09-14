"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent("E-mail ou senha inválidos. Verifique os dados e tente novamente.")}`);
  redirect("/");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");
  if (fullName.length < 3) redirect("/signup?error=Informe seu nome completo");
  if (password.length < 6) redirect("/signup?error=A senha precisa ter pelo menos 6 caracteres");
  if (password !== confirmPassword) redirect("/signup?error=As senhas não coincidem");
  const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  redirect("/login?message=Conta criada. Confirme seu e-mail se solicitado e depois entre no WJR Seller IA.");
}
