"use client";
import { useState } from "react";

export function AttributesEditor({ initial }: { initial: Record<string, string> }) {
  const [rows, setRows] = useState(() => {
    const entries = Object.entries(initial);
    return entries.length ? entries : [["", ""]] as [string, string][];
  });
  const update = (i: number, field: 0 | 1, value: string) => setRows((r) => r.map((row, idx) => (idx === i ? (field === 0 ? [value, row[1]] : [row[0], value]) : row)));
  const remove = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));
  return <div className="attributesEditor">
    {rows.map(([key, value], i) => <div className="attributeRow" key={i}>
      <input name="attr_key" placeholder="Nome (ex.: Cor)" value={key} onChange={(e) => update(i, 0, e.target.value)} />
      <input name="attr_value" placeholder="Valor" value={value} onChange={(e) => update(i, 1, e.target.value)} />
      <button type="button" className="button compact" onClick={() => remove(i)} aria-label="Remover atributo">✕</button>
    </div>)}
    <button type="button" className="button compact" onClick={() => setRows((r) => [...r, ["", ""]])}>+ Adicionar atributo</button>
  </div>;
}
