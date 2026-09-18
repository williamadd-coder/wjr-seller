"use client";
import { useTransition } from "react";

/** The AI call takes tens of seconds; without a pending state the click looks like it did nothing. */
export function AiActionButton({ action, label, pendingLabel, hint }: { action: () => Promise<void>; label: string; pendingLabel: string; hint: string }) {
  const [pending, startTransition] = useTransition();
  return <>
    <button type="button" className="button compact" disabled={pending} onClick={() => startTransition(async () => { await action(); })}>
      {pending ? pendingLabel : label}
    </button>
    {pending && <p className="note" role="status" aria-live="polite">{hint}</p>}
  </>;
}
