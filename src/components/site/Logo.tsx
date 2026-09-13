import { clsx } from "clsx";
import { site } from "@/lib/site";

/**
 * The mark: a coin with a play button stamped in it, drawn from the brand
 * gradient. Used at 22px in the nav and at 512px as the app icon — same
 * paths, so the two never drift.
 */
export function Mark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="clipr-brand" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff6a2b" />
          <stop offset="1" stopColor="#ffb347" />
        </linearGradient>
        <linearGradient id="clipr-chrome" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6f5f2" />
          <stop offset="0.5" stopColor="#b9b8c2" />
          <stop offset="1" stopColor="#6c6b78" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#clipr-chrome)" />
      <circle cx="32" cy="32" r="25" fill="#0d0d13" />
      <circle cx="32" cy="32" r="25" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="1.5" />
      <path d="M25 20.5v23c0 1.6 1.7 2.5 3 1.7l18-11.5c1.2-.8 1.2-2.6 0-3.4L28 18.8c-1.3-.8-3 .1-3 1.7Z" fill="url(#clipr-brand)" />
    </svg>
  );
}

export function Wordmark({ className, markSize = 24 }: { className?: string; markSize?: number }) {
  return (
    <span className={clsx("inline-flex items-center gap-2.5", className)}>
      <Mark size={markSize} />
      <span className="display text-[20px] font-semibold tracking-[-0.03em] text-hi">{site.wordmark}</span>
    </span>
  );
}
