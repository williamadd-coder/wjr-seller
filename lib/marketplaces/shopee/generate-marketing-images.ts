import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import { coverSlide, benefitsSlide, specsSlide, includedSlide, SIZE } from "./image-templates";
import { regularBase64, boldBase64, blackBase64 } from "./font-data";

const fonts = [
  { name: "Inter", data: Buffer.from(regularBase64, "base64"), weight: 400 as const, style: "normal" as const },
  { name: "Inter", data: Buffer.from(boldBase64, "base64"), weight: 700 as const, style: "normal" as const },
  { name: "Inter", data: Buffer.from(blackBase64, "base64"), weight: 900 as const, style: "normal" as const },
];

async function render(element: ReactElement) {
  const response = new ImageResponse(element, { width: SIZE.width, height: SIZE.height, fonts });
  return Buffer.from(await response.arrayBuffer());
}

export type MarketingImageInput = {
  productName: string;
  photoDataUrl: string;
  tagline?: string;
  benefits: string[];
  specs: { label: string; value: string }[];
  includedItems: string[];
};

/**
 * Renders the "secondary images that sell" set (cover, benefits, specs, what's included) as PNGs,
 * template-based — the seller's own product photo goes into every slide unchanged, only the confirmed
 * text/measurements are overlaid. Slides with no content to show (e.g. no items_included) are skipped.
 */
export async function generateMarketingImageSet(input: MarketingImageInput) {
  const slides: { key: string; label: string; buffer: Buffer }[] = [];
  slides.push({ key: "capa", label: "Capa", buffer: await render(coverSlide(input.productName, input.photoDataUrl, input.tagline)) });
  if (input.benefits.length) slides.push({ key: "beneficios", label: "Benefícios", buffer: await render(benefitsSlide(input.productName, input.photoDataUrl, input.benefits)) });
  if (input.specs.length) slides.push({ key: "medidas", label: "Medidas e especificações", buffer: await render(specsSlide(input.productName, input.photoDataUrl, input.specs)) });
  if (input.includedItems.length) slides.push({ key: "acompanha", label: "O que acompanha", buffer: await render(includedSlide(input.productName, input.includedItems)) });
  return slides;
}
