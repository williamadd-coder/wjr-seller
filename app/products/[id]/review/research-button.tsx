"use client";
import { useFormStatus } from "react-dom";
export function ResearchButton() {
  const { pending } = useFormStatus();
  return <><button className="button primary" type="submit" disabled={pending}>{pending ? "Pesquisando anúncios…" : "Pesquisar anúncios na Shopee"}</button>{pending && <p className="note" role="status" aria-live="polite">Consultando anúncios e preços. Aguarde o resultado desta tentativa.</p>}</>;
}
