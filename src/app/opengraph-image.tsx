import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${site.name} — ${site.tagline}`;

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "radial-gradient(900px 500px at 10% 0%, rgba(255,106,43,.35), transparent 60%), radial-gradient(700px 500px at 100% 20%, rgba(255,179,71,.2), transparent 60%), #07070b",
          color: "#f3f1ec",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="56" height="56" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="30" fill="#c9c8d2" />
            <circle cx="32" cy="32" r="25" fill="#0d0d13" />
            <path d="M25 20.5v23c0 1.6 1.7 2.5 3 1.7l18-11.5c1.2-.8 1.2-2.6 0-3.4L28 18.8c-1.3-.8-3 .1-3 1.7Z" fill="#ff8a45" />
          </svg>
          <span style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1.5 }}>{site.wordmark}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 96, fontWeight: 600, letterSpacing: -4, lineHeight: 0.98, display: "flex", flexDirection: "column" }}>
            <span>Clip. Post.</span>
            <span style={{ color: "#ffb347" }}>Get paid per 1,000 views.</span>
          </div>
          <div style={{ fontSize: 30, color: "#aaa8b2", maxWidth: 900 }}>
            {`Budgets escrowed onchain. Payouts in ${site.ticker}, straight to your wallet.`}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
