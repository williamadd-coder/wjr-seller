/**
 * JSX layouts rendered to PNG via next/og's ImageResponse (Satori). Deliberately template-based, not
 * AI image generation: the product photo the seller uploaded is placed as-is into a fixed, hand-built
 * layout, and only text/measurements the seller already confirmed are overlaid — so the product in the
 * image is always exactly the product being sold, never something an image model reimagined.
 */
import type { CSSProperties } from "react";

export const SIZE = { width: 1080, height: 1080 } as const;

const COLORS = {
  bg: "#0d1411",
  panel: "#101613",
  accent: "#e8433a",
  accentDark: "#7c1912",
  text: "#ffffff",
  muted: "#c7d0cb",
  line: "#2a352f",
};

const base: CSSProperties = {
  width: "100%", height: "100%", display: "flex", flexDirection: "column",
  background: COLORS.bg, fontFamily: "Inter", color: COLORS.text,
};

function TitleBar({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", padding: "44px 56px 24px", gap: 6 }}>
      <div style={{ display: "flex", color: COLORS.accent, fontSize: 26, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase" }}>{eyebrow}</div>
      <div style={{ display: "flex", fontSize: 54, fontWeight: 900, lineHeight: 1.05, maxWidth: 960 }}>{title}</div>
    </div>
  );
}

function Photo({ src, style }: { src: string; style?: CSSProperties }) {
  return <img src={src} style={{ objectFit: "cover", borderRadius: 24, ...style }} />;
}

export function coverSlide(productName: string, photoDataUrl: string, tagline?: string) {
  return (
    <div style={base}>
      <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", padding: 56 }}>
        <Photo src={photoDataUrl} style={{ width: 968, height: 620 }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", background: COLORS.panel, padding: "32px 56px 48px", gap: 10, borderTop: `6px solid ${COLORS.accent}` }}>
        {tagline && <div style={{ display: "flex", color: COLORS.accent, fontSize: 28, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>{tagline}</div>}
        <div style={{ display: "flex", fontSize: 50, fontWeight: 900, lineHeight: 1.08 }}>{productName}</div>
      </div>
    </div>
  );
}

export function benefitsSlide(productName: string, photoDataUrl: string, benefits: string[]) {
  return (
    <div style={base}>
      <TitleBar eyebrow="Por que escolher" title={productName} />
      <div style={{ display: "flex", flex: 1, padding: "0 56px 56px", gap: 40, alignItems: "center" }}>
        <Photo src={photoDataUrl} style={{ width: 440, height: 620 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 22, flex: 1 }}>
          {benefits.slice(0, 4).map((b, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 18, background: COLORS.panel, borderRadius: 18, padding: "20px 24px", border: `1px solid ${COLORS.line}` }}>
              <div style={{ display: "flex", width: 44, height: 44, borderRadius: 22, background: COLORS.accent, alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 900, flexShrink: 0 }}>✓</div>
              <div style={{ display: "flex", fontSize: 30, fontWeight: 700, lineHeight: 1.2 }}>{b}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function specsSlide(productName: string, photoDataUrl: string, specs: { label: string; value: string }[]) {
  return (
    <div style={base}>
      <TitleBar eyebrow="Medidas e especificações" title={productName} />
      <div style={{ display: "flex", flex: 1, padding: "0 56px 56px", gap: 40, alignItems: "center" }}>
        <Photo src={photoDataUrl} style={{ width: 460, height: 620 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 0, flex: 1, borderRadius: 18, overflow: "hidden", border: `1px solid ${COLORS.line}` }}>
          {specs.map((s, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 28px", background: i % 2 === 0 ? COLORS.panel : "transparent", borderBottom: i < specs.length - 1 ? `1px solid ${COLORS.line}` : "none" }}>
              <div style={{ display: "flex", fontSize: 26, color: COLORS.muted, fontWeight: 700 }}>{s.label}</div>
              <div style={{ display: "flex", fontSize: 30, fontWeight: 900 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function includedSlide(productName: string, items: string[]) {
  return (
    <div style={base}>
      <TitleBar eyebrow="O que acompanha" title={productName} />
      <div style={{ display: "flex", flex: 1, flexDirection: "column", padding: "10px 56px 40px", gap: 18 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
          {items.slice(0, 8).map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, width: 460, background: COLORS.panel, borderRadius: 18, padding: "22px 24px", border: `1px solid ${COLORS.line}` }}>
              <div style={{ display: "flex", width: 40, height: 40, borderRadius: 10, background: COLORS.accentDark, alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, flexShrink: 0 }}>{i + 1}</div>
              <div style={{ display: "flex", fontSize: 27, fontWeight: 700, lineHeight: 1.25 }}>{item}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", background: COLORS.panel, borderTop: `4px solid ${COLORS.accent}`, padding: "26px 56px", justifyContent: "center", gap: 48 }}>
        <div style={{ display: "flex", fontSize: 24, fontWeight: 800, color: COLORS.muted }}>🛡️ Compra Garantida Shopee</div>
        <div style={{ display: "flex", fontSize: 24, fontWeight: 800, color: COLORS.muted }}>✔ Vendedor verificado</div>
      </div>
    </div>
  );
}
