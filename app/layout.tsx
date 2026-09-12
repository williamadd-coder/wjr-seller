import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WJR Seller IA",
  description: "Seller Studio inteligente para criação e gestão de anúncios.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
