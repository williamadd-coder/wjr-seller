"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Polls for the Shopee market research result while the background function is still running.
 * The listing's optimization_notes.aiMarketResearch.status flips from "pending" to "done"/"error"
 * server-side once the background function finishes — router.refresh() re-fetches that from the
 * Server Component on each tick. Must be setInterval, not a one-shot setTimeout: since router.refresh()
 * doesn't itself change the `pending` prop (only a *successful* refresh that finds a new status does),
 * a setTimeout scheduled once by this effect never gets rescheduled by React on its own — it fired
 * exactly once and then polling silently stopped forever, however long the research actually took.
 */
export function ResearchPoller({ pending }: { pending: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!pending) return;
    const interval = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(interval);
  }, [pending, router]);
  if (!pending) return null;
  return <div className="authAlert" role="status" aria-live="polite">
    <span style={{ display: "inline-block", marginRight: 10 }}>⏳</span>
    <b>Pesquisando categoria e preço reais na Shopee…</b>
    <small style={{ display: "block", marginTop: 6 }}>Isso pode levar até 2 minutos. Você pode continuar editando os outros campos enquanto espera — esta página atualiza sozinha quando a pesquisa terminar.</small>
  </div>;
}
