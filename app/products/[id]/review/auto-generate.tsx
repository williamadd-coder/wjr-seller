"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { optimizeShopee } from "../actions";

export function AutoGenerate({ productId, enabled }: { productId: string; enabled: boolean }) {
  const started = useRef(false);
  const router = useRouter();
  const [status, setStatus] = useState(enabled ? "Analisando evidências e montando a primeira versão do anúncio…" : "");

  useEffect(() => {
    if (!enabled || started.current) return;
    started.current = true;
    optimizeShopee(productId)
      .then(() => {
        setStatus("Primeira versão gerada. Atualizando a prévia…");
        router.replace(`/products/${productId}/review`);
        router.refresh();
      })
      .catch(() => setStatus("Não foi possível concluir a geração automática. Revise as pendências e tente recalcular."));
  }, [enabled, productId, router]);

  if (!status) return null;
  return <div className="authAlert">{status}</div>;
}
