import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** The mark from Logo.tsx, rasterised. Same geometry, no drift. */
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: 64, height: 64, display: "flex", background: "transparent" }}>
        <svg width="64" height="64" viewBox="0 0 64 64">
          <defs>
            <linearGradient id="b" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ff6a2b" />
              <stop offset="1" stopColor="#ffb347" />
            </linearGradient>
            <linearGradient id="c" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f6f5f2" />
              <stop offset="0.5" stopColor="#b9b8c2" />
              <stop offset="1" stopColor="#6c6b78" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="30" fill="url(#c)" />
          <circle cx="32" cy="32" r="25" fill="#0d0d13" />
          <path d="M25 20.5v23c0 1.6 1.7 2.5 3 1.7l18-11.5c1.2-.8 1.2-2.6 0-3.4L28 18.8c-1.3-.8-3 .1-3 1.7Z" fill="url(#b)" />
        </svg>
      </div>
    ),
    size,
  );
}
