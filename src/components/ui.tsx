import { clsx } from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { PLATFORM_LABEL, type Platform, type SubmissionStatus } from "@/lib/model";

/* ------------------------------------------------------------------ Button */

type ButtonVariant = "primary" | "glass" | "ghost" | "ok" | "bad";
type ButtonSize = "md" | "sm" | "xs";

const variantClass: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  glass: "btn-glass",
  ghost: "btn-ghost",
  ok: "btn-ok",
  bad: "btn-bad",
};
const sizeClass: Record<ButtonSize, string> = { md: "", sm: "btn-sm", xs: "btn-xs" };

export function Button({
  variant = "glass",
  size = "md",
  className,
  busy,
  children,
  ...rest
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize; busy?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || busy}
      className={clsx("btn", variantClass[variant], sizeClass[size], className)}
    >
      {busy && <Spinner />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "glass",
  size = "md",
  className,
  children,
  ...rest
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <Link {...rest} className={clsx("btn", variantClass[variant], sizeClass[size], className)}>
      {children}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={clsx("spin h-4 w-4", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* -------------------------------------------------------------------- Pill */

export function Pill({
  tone = "default",
  className,
  title,
  children,
}: {
  tone?: "default" | "brand" | "ok" | "bad" | "hi";
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={clsx(
        "pill",
        tone === "brand" && "pill-brand",
        tone === "ok" && "pill-ok",
        tone === "bad" && "pill-bad",
        tone === "hi" && "pill-hi",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: SubmissionStatus }) {
  const map: Record<SubmissionStatus, { tone: "default" | "brand" | "ok" | "bad" | "hi"; label: string }> = {
    pending: { tone: "default", label: "In review" },
    approved: { tone: "hi", label: "Approved · tracking" },
    rejected: { tone: "bad", label: "Rejected" },
    settled: { tone: "brand", label: "Claimable" },
    paid: { tone: "ok", label: "Paid" },
  };
  const { tone, label } = map[status];
  return <Pill tone={tone}>{label}</Pill>;
}

/* ------------------------------------------------------------------- Panel */

export function Panel({
  className,
  strong,
  card,
  children,
  ...rest
}: ComponentProps<"div"> & { strong?: boolean; card?: boolean }) {
  return (
    <div {...rest} className={clsx("glass", strong && "glass-strong", card && "glass-card", className)}>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------- Stat */

export function Stat({
  label,
  value,
  unit,
  hint,
  tone,
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  tone?: "brand" | "ok";
  className?: string;
}) {
  return (
    <div className={clsx("flex flex-col gap-1", className)}>
      <span className="label">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span
          className={clsx(
            "num text-[26px] leading-none font-medium tracking-tight",
            tone === "brand" && "brand-text",
            tone === "ok" && "text-ok",
          )}
        >
          {value}
        </span>
        {unit && <span className="text-[12px] font-semibold text-low">{unit}</span>}
      </span>
      {hint && <span className="text-[12.5px] text-low">{hint}</span>}
    </div>
  );
}

/* ---------------------------------------------------------------- Progress */

export function Progress({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={clsx("bar", className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${v}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ Notice */

export function Notice({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "brand" | "bad" | "ok";
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-[14px] border px-4 py-3 text-[13.5px] leading-relaxed",
        tone === "info" && "border-[var(--line)] bg-surface text-mid",
        tone === "brand" && "border-amber/30 bg-[var(--ember-wash)] text-hi",
        tone === "bad" && "border-bad/35 bg-[var(--bad-wash)] text-hi",
        tone === "ok" && "border-ok/35 bg-[var(--ok-wash)] text-hi",
        className,
      )}
      role={tone === "bad" ? "alert" : undefined}
    >
      {title && <div className="mb-0.5 font-semibold text-hi">{title}</div>}
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------- Field */

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={clsx("flex flex-col gap-1.5", className)}>
      <span className="label">{label}</span>
      {children}
      {error ? (
        <span className="text-[12.5px] text-bad">{error}</span>
      ) : hint ? (
        <span className="text-[12.5px] text-low">{hint}</span>
      ) : null}
    </label>
  );
}

/* ---------------------------------------------------------- Section title */

export function SectionTitle({
  eyebrow,
  title,
  lede,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={clsx("flex flex-col gap-3", align === "center" && "items-center text-center", className)}>
      {eyebrow && <span className="label text-amber">{eyebrow}</span>}
      <h2 className="display text-[clamp(28px,4.2vw,46px)]">{title}</h2>
      {lede && <p className="max-w-[58ch] text-[16px] leading-relaxed text-mid">{lede}</p>}
    </div>
  );
}

/* --------------------------------------------------------- Platform icons */

const PLATFORM_PATH: Record<Platform, ReactNode> = {
  tiktok: (
    <path
      fill="currentColor"
      d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.6 2.6 0 0 1-2.6-2.6 2.6 2.6 0 0 1 3.4-2.47V9.66a5.7 5.7 0 0 0-.8-.06A5.7 5.7 0 0 0 4.16 15.3 5.7 5.7 0 0 0 9.86 21a5.7 5.7 0 0 0 5.7-5.7V8.8a7.4 7.4 0 0 0 4.3 1.38V7.09a4.3 4.3 0 0 1-3.26-1.27Z"
    />
  ),
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" />
    </>
  ),
  youtube: (
    <>
      <path
        fill="currentColor"
        d="M21.6 7.2a2.5 2.5 0 0 0-1.76-1.77C18.3 5 12 5 12 5s-6.3 0-7.84.43A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.76 1.77C5.7 19 12 19 12 19s6.3 0 7.84-.43a2.5 2.5 0 0 0 1.76-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8Z"
      />
      <path fill="#07070b" d="M10 15.2V8.8l5.2 3.2-5.2 3.2Z" />
    </>
  ),
  x: (
    <path
      fill="currentColor"
      d="M17.7 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L1.7 3h6.4l4.4 5.9L17.7 3Zm-1.1 16.2h1.7L7.2 4.7H5.4l11.2 14.5Z"
    />
  ),
};

export function PlatformIcon({ platform, className, title }: { platform: Platform; className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={clsx("h-4 w-4", className)} aria-label={title ?? PLATFORM_LABEL[platform]} role="img">
      {PLATFORM_PATH[platform]}
    </svg>
  );
}

export function PlatformRow({ platforms, size = "sm" }: { platforms: Platform[]; size?: "sm" | "md" }) {
  return (
    <span className="flex items-center gap-1.5">
      {platforms.map((p) => (
        <span
          key={p}
          title={PLATFORM_LABEL[p]}
          className={clsx(
            "inline-flex items-center justify-center rounded-full border border-[var(--rim)] bg-[var(--glass-2)] text-hi",
            size === "sm" ? "h-7 w-7" : "h-9 w-9",
          )}
        >
          <PlatformIcon platform={p} className={size === "sm" ? "h-3.5 w-3.5" : "h-4.5 w-4.5"} />
        </span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------- Brand mark */

const CATEGORY_HUE: Record<string, [string, string]> = {
  Music: ["#ff6a2b", "#7c3aed"],
  Podcast: ["#ffb347", "#ff6a2b"],
  Streaming: ["#22d3ee", "#7c3aed"],
  Gaming: ["#a3e635", "#0ea5e9"],
  Crypto: ["#ffb347", "#22d3ee"],
  Sports: ["#3ddc84", "#ffb347"],
  Education: ["#60a5fa", "#f472b6"],
  Brand: ["#f472b6", "#ff6a2b"],
};

/** A brand's disc: initials on a category-coloured gradient. No logos. */
export function BrandDisc({ name, category, size = 36 }: { name: string; category: string; size?: number }) {
  const [a, b] = CATEGORY_HUE[category] ?? ["#ff6a2b", "#ffb347"];
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-[#0a0a0f] ring-1 ring-white/20"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, ${a}, ${b})`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.35), 0 6px 16px -8px rgba(0,0,0,.8)",
      }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export function categoryGradient(category: string): string {
  const [a, b] = CATEGORY_HUE[category] ?? ["#ff6a2b", "#ffb347"];
  return `linear-gradient(135deg, ${a}, ${b})`;
}
