"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Wordmark } from "@/components/site/Logo";
import { WalletButton } from "@/components/wallet/WalletButton";
import { useSession } from "@/components/wallet/session";
import { isLive } from "@/lib/contracts";

const links = [
  { href: "/campaigns", label: "Campaigns" },
  { href: "/launch", label: "Launch a campaign" },
  { href: "/token", label: "Token" },
];

export function Nav() {
  const pathname = usePathname();
  const { session } = useSession();
  const [open, setOpen] = useState(false);
  // Close the menu when the route changes — adjusted during render, the
  // way React asks, rather than in an effect that would render twice.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  const items = [
    ...links,
    ...(session ? [{ href: "/dashboard", label: "My clips" }] : []),
    ...(session?.ops ? [{ href: "/ops", label: "Ops" }] : []),
  ];

  return (
    <header className="sticky top-0 z-40">
      <div className="shell pt-3">
        <nav className="glass flex h-[56px] items-center gap-2 rounded-full pr-2 pl-4" aria-label="Main">
          <Link href="/" className="mr-2 flex items-center" aria-label="Home">
            <Wordmark />
          </Link>
          {!isLive && (
            <span className="pill hidden h-6 text-[10.5px] md:inline-flex" title="No contract is deployed — nothing here moves real CLIPR yet">
              <span className="h-1.5 w-1.5 rounded-full bg-low" />
              awaiting launch
            </span>
          )}
          <ul className="ml-auto hidden items-center gap-1 lg:flex">
            {items.map((l) => {
              const active = pathname === l.href || pathname.startsWith(l.href + "/");
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className={clsx(
                      "inline-flex h-9 items-center rounded-full px-3.5 text-[13.5px] font-medium transition-colors",
                      active ? "bg-surface-3 text-hi" : "text-mid hover:text-hi",
                    )}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="ml-auto hidden lg:block">
            <WalletButton className="btn-sm" />
          </div>
          <button
            type="button"
            className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-full text-hi lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              {open ? (
                <path d="M4 4l12 12M16 4L4 16" />
              ) : (
                <path d="M3 6h14M3 10h14M3 14h14" />
              )}
            </svg>
          </button>
        </nav>
        {open && (
          <div className="glass mt-2 flex flex-col gap-1 rounded-[22px] p-3 lg:hidden">
            {items.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  "rounded-xl px-3 py-2.5 text-[15px] font-medium",
                  pathname === l.href ? "bg-surface-3 text-hi" : "text-mid",
                )}
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 border-t border-[var(--line)] pt-3">
              <WalletButton full />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
