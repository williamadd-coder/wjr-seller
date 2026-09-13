"use client";

import { useState } from "react";
import { uploadProductMedia } from "./actions";

const MAX_BYTES = 1_950_000;
const MIN_SIDE = 1024;

async function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Não foi possível processar a imagem.")), type, quality));
}

async function compressImage(file: File) {
  const image = await loadImage(file);
  let width = image.naturalWidth;
  let height = image.naturalHeight;
  let quality = 0.9;
  const outputType = file.type === "image/png" ? "image/webp" : file.type === "image/webp" ? "image/webp" : "image/jpeg";
  let blob: Blob = file;

  for (let attempt = 0; attempt < 10; attempt++) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Seu navegador não conseguiu preparar a imagem.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    blob = await canvasBlob(canvas, outputType, quality);
    if (blob.size < MAX_BYTES) break;

    quality = Math.max(0.58, quality - 0.08);
    if (quality <= 0.66) {
      const scale = 0.88;
      const nextWidth = Math.round(width * scale);
      const nextHeight = Math.round(height * scale);
      if (Math.min(nextWidth, nextHeight) >= MIN_SIDE) {
        width = nextWidth;
        height = nextHeight;
        quality = 0.82;
      }
    }
  }

  if (blob.size >= 2_000_000) throw new Error("Não foi possível reduzir a imagem para menos de 2 MB sem comprometer demais a resolução.");
  const extension = outputType === "image/webp" ? "webp" : "jpg";
  const base = file.name.replace(/\.[^.]+$/, "") || "produto";
  return new File([blob], `${base}.${extension}`, { type: outputType, lastModified: Date.now() });
}

export function MediaUpload({ productId }: { productId: string }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("file") as HTMLInputElement;
    const original = input.files?.[0];
    if (!original) return;

    setBusy(true);
    setStatus(original.type.startsWith("image/") ? "Preparando e comprimindo imagem…" : "Preparando vídeo…");
    try {
      const file = original.type.startsWith("image/") ? await compressImage(original) : original;
      const data = new FormData();
      data.set("file", file);
      data.set("width", "");
      data.set("height", "");
      setStatus(original.size !== file.size ? `Imagem otimizada: ${(original.size / 1048576).toFixed(2)} MB → ${(file.size / 1048576).toFixed(2)} MB. Enviando…` : "Enviando…");
      await uploadProductMedia(productId, data);
      form.reset();
      setStatus("Mídia adicionada com sucesso.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao preparar a mídia.");
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="mediaUpload" encType="multipart/form-data">
    <input name="file" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" required disabled={busy} />
    <button className="button primary" type="submit" disabled={busy}>{busy ? "Processando…" : "Adicionar mídia"}</button>
    {status && <small className="mediaStatus">{status}</small>}
  </form>;
}
