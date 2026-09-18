"use client";
import { useEffect, useRef, useTransition } from "react";

/**
 * Runs the Shopee market research automatically right after the listing is generated, so category,
 * attributes and competitor price show up without the seller having to find and click the button.
 * Uses the same startTransition + server action call as the manual "Pesquisar anúncios na Shopee"
 * button — that action redirects itself (?researched=N or ?error=...) on completion, so this
 * component only needs to fire it once and show a status line while it runs.
 */
export function AutoResearch({ action, enabled }: { action: () => Promise<void>; enabled: boolean }) {
  const started = useRef(false);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (!enabled || started.current) return;
    started.current = true;
    startTransition(() => { action(); });
  }, [enabled, action]);
  if (!enabled || !pending) return null;
  return <div className="authAlert" role="status" aria-live="polite">
    <span style={{ display: "inline-block", marginRight: 10 }}>⏳</span>
    <b>Pesquisando categoria e preço reais na Shopee…</b>
    <small style={{ display: "block", marginTop: 6 }}>Isso leva até 25 segundos. Se não encontrar um anúncio comparável a tempo, você pode tentar de novo pelo botão "Pesquisar anúncios na Shopee".</small>
  </div>;
}
