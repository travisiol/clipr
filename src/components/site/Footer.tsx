import Link from "next/link";
import { Wordmark } from "@/components/site/Logo";
import { site } from "@/lib/site";
import { isLive, contracts } from "@/lib/contracts";

export function Footer() {
  return (
    <footer className="shell mt-24 mb-8">
      <div className="glass glass-card flex flex-col gap-8 p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex max-w-[40ch] flex-col gap-3">
            <Wordmark />
            <p className="text-[13.5px] leading-relaxed text-mid">{site.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-8 text-[13.5px] sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <span className="label">Clippers</span>
              <Link href="/campaigns" className="text-mid hover:text-hi">Find a campaign</Link>
              <Link href="/dashboard" className="text-mid hover:text-hi">My clips</Link>
              <Link href="/#how" className="text-mid hover:text-hi">How it works</Link>
            </div>
            <div className="flex flex-col gap-2">
              <span className="label">Brands</span>
              <Link href="/launch" className="text-mid hover:text-hi">Launch a campaign</Link>
              <Link href="/token" className="text-mid hover:text-hi">Get CLIPR</Link>
              <Link href="/#faq" className="text-mid hover:text-hi">FAQ</Link>
            </div>
            <div className="flex flex-col gap-2">
              <span className="label">Elsewhere</span>
              <a href={site.xUrl} target="_blank" rel="noreferrer" className="text-mid hover:text-hi">
                @{site.xHandle}
              </a>
              <Link href="/token#contract" className="text-mid hover:text-hi">Contracts</Link>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-[var(--line)] pt-5 text-[12.5px] text-low md:flex-row md:items-center md:justify-between">
          <span>
            © {new Date().getFullYear()} {site.name}. Every amount on this site is in CLIPR; the token has no fixed dollar value.
          </span>
          <span className="num">
            {isLive ? `escrow ${contracts.escrow}` : "preview · no contract deployed · nothing here moves real CLIPR"}
          </span>
        </div>
      </div>
    </footer>
  );
}
