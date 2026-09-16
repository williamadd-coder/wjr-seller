"use client";
import { useFormStatus } from "react-dom";
export function ResearchButton() {
  const { pending } = useFormStatus();
  return <><button className="button primary" type="submit" disabled={pending}>{pending ? "Consultando a Shopee…" : "Tentar consulta direta à Shopee"}</button>{pending && <p className="note" role="status" aria-live="polite">Aguarde o resultado desta tentativa. O anúncio preparado não é alterado.</p>}</>;
}
