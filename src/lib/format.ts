import { fromWei } from "@/lib/model";

/** 1234567.891 → "1,234,568"; small amounts keep two decimals. */
export function fmtToken(wei: string | bigint, opts: { decimals?: number; compact?: boolean } = {}): string {
  const n = fromWei(wei);
  if (opts.compact) return fmtCompact(n);
  const decimals = opts.decimals ?? (n >= 1000 ? 0 : n >= 1 ? 2 : 4);
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

/** Whole tokens typed in a form ("2.5") shown back tidily. */
export function fmtWhole(n: number, max = 2): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: max });
}

export function fmtCompact(n: number): string {
  if (n >= 1e9) return `${trim(n / 1e9)}B`;
  if (n >= 1e6) return `${trim(n / 1e6)}M`;
  if (n >= 1e3) return `${trim(n / 1e3)}K`;
  return trim(n);
}

const trim = (n: number) => (n >= 100 ? Math.round(n).toString() : n >= 10 ? n.toFixed(1).replace(/\.0$/, "") : n.toFixed(2).replace(/\.?0+$/, ""));

export const fmtViews = (n: number) => n.toLocaleString("en-US");

export function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function timeAgo(ms: number, now = Date.now()): string {
  const s = Math.max(0, (now - ms) / 1000);
  if (s < 60) return "just now";
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}m ago`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = h / 24;
  if (d < 30) return `${Math.floor(d)}d ago`;
  return fmtDate(ms);
}

export function timeLeft(ms: number, now = Date.now()): string {
  const s = (ms - now) / 1000;
  if (s <= 0) return "ended";
  const d = s / 86400;
  if (d >= 2) return `${Math.floor(d)} days left`;
  const h = s / 3600;
  if (h >= 1) return `${Math.floor(h)}h left`;
  return `${Math.max(1, Math.floor(s / 60))}m left`;
}

export const pct = (part: bigint, whole: bigint): number =>
  whole === 0n ? 0 : Math.min(100, Number((part * 10000n) / whole) / 100);
