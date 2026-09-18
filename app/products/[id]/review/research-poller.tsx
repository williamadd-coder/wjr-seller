"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Polls for the Shopee market research result while the background function is still running.
 * The listing's optimization_notes.aiMarketResearch.status flips from "pending" to "done"/"error"
 * server-side once the background function finishes — router.refresh() re-fetches that from the
 * Server Component on each tick, so this stops polling on its own the moment status changes.
 */
export function ResearchPoller({ pending }: { pending: boolean }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!pending) return;
    timer.current = setTimeout(() => router.refresh(), 3000);
    return () => clearTimeout(timer.current);
  }, [pending, router]);
  if (!pending) return null;
  return <div className="authAlert" role="status" aria-live="polite">
    <span style={{ display: "inline-block", marginRight: 10 }}>⏳</span>
    <b>Pesquisando categoria e preço reais na Shopee…</b>
    <small style={{ display: "block", marginTop: 6 }}>Isso pode levar até 2 minutos. Você pode continuar editando os outros campos enquanto espera — esta página atualiza sozinha quando a pesquisa terminar.</small>
  </div>;
}
