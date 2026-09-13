"use client";

import { clsx } from "clsx";
import { useMemo, useState } from "react";
import { CampaignCard } from "@/components/campaigns/CampaignCard";
import { PlatformIcon } from "@/components/ui";
import { CAMPAIGN_TYPE_LABEL, CAMPAIGN_TYPES, PLATFORM_LABEL, PLATFORMS, remainingBudget, type Campaign, type CampaignType, type Platform } from "@/lib/model";

type Sort = "left" | "rate" | "newest" | "ending";

const SORT_LABEL: Record<Sort, string> = {
  left: "Most budget left",
  rate: "Highest rate",
  newest: "Newest",
  ending: "Ending soon",
};

/**
 * The discover grid. Filtering is client-side over the full list — a few
 * hundred campaigns is nothing, and it keeps every chip instant.
 */
export function CampaignBrowser({ campaigns }: { campaigns: Campaign[] }) {
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [type, setType] = useState<CampaignType | "all">("all");
  const [sort, setSort] = useState<Sort>("left");
  const [showEnded, setShowEnded] = useState(false);
  // One reading per mount: the filters and the cards judge every deadline
  // against the same instant, and a re-render cannot move it.
  const [now] = useState(() => Date.now());

  const list = useMemo(() => {
    let out = campaigns.filter((c) => {
      if (platform !== "all" && !c.platforms.includes(platform)) return false;
      if (type !== "all" && c.type !== type) return false;
      const live = c.status === "active" && c.endsAt > now && remainingBudget(c) > 0n;
      return showEnded || live;
    });
    const cmpBig = (a: bigint, b: bigint) => (a === b ? 0 : a > b ? 1 : -1);
    out = [...out].sort((a, b) => {
      switch (sort) {
        case "left":
          return cmpBig(remainingBudget(b), remainingBudget(a));
        case "rate":
          return cmpBig(BigInt(b.ratePerMille), BigInt(a.ratePerMille));
        case "newest":
          return b.createdAt - a.createdAt;
        case "ending":
          return a.endsAt - b.endsAt;
      }
    });
    return out;
  }, [campaigns, platform, type, sort, showEnded, now]);

  const chip = (active: boolean) =>
    clsx(
      "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
      active
        ? "border-amber/50 bg-[var(--ember-wash)] text-hi"
        : "border-[var(--rim)] bg-[var(--glass)] text-mid hover:text-hi",
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="glass flex flex-col gap-3 rounded-[18px] p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={chip(platform === "all")} onClick={() => setPlatform("all")}>
            All platforms
          </button>
          {PLATFORMS.map((p) => (
            <button key={p} type="button" className={chip(platform === p)} onClick={() => setPlatform(p)} aria-pressed={platform === p}>
              <PlatformIcon platform={p} className="h-3.5 w-3.5" />
              {PLATFORM_LABEL[p]}
            </button>
          ))}
          <span className="mx-1 hidden h-6 w-px bg-[var(--line-strong)] md:block" />
          {(["all", ...CAMPAIGN_TYPES] as const).map((t) => (
            <button key={t} type="button" className={chip(type === t)} onClick={() => setType(t)} aria-pressed={type === t}>
              {t === "all" ? "Any type" : CAMPAIGN_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-[12.5px] whitespace-nowrap text-mid">
            <input type="checkbox" checked={showEnded} onChange={(e) => setShowEnded(e.target.checked)} className="accent-[#ff6a2b]" />
            Show ended
          </label>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="field h-9 w-auto text-[13px]" aria-label="Sort">
            {(Object.keys(SORT_LABEL) as Sort[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between text-[13px] text-low">
        <span>
          {list.length} campaign{list.length === 1 ? "" : "s"}
        </span>
      </div>

      {list.length === 0 ? (
        <div className="glass glass-card p-10 text-center text-mid">Nothing matches those filters yet.</div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <CampaignCard key={c.id} campaign={c} now={now} />
          ))}
        </div>
      )}
    </div>
  );
}
