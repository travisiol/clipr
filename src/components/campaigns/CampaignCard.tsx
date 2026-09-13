import Link from "next/link";
import { clsx } from "clsx";
import { BrandDisc, Pill, PlatformRow, Progress, categoryGradient } from "@/components/ui";
import { fmtToken, pct, timeLeft } from "@/lib/format";
import { CAMPAIGN_TYPE_LABEL, remainingBudget, type Campaign } from "@/lib/model";
import { site } from "@/lib/site";

/**
 * A campaign as a card: the rate is the headline (it is what a clipper
 * scans for), the budget bar says how much is still to be earned, the
 * platforms say whether it is even relevant. Cover art is generated from
 * the category — no brand logos, no uploads.
 */
export function CampaignCard({ campaign, featured, now }: { campaign: Campaign; featured?: boolean; now: number }) {
  const remaining = remainingBudget(campaign);
  const spentPct = pct(BigInt(campaign.spent), BigInt(campaign.budget));
  const ended = campaign.status !== "active" || campaign.endsAt < now;

  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className={clsx(
        "glass glass-card group flex flex-col overflow-hidden transition-transform duration-300 ease-[var(--ease)] hover:-translate-y-1",
        featured && "md:col-span-2",
      )}
    >
      {/* Cover */}
      <div
        className="relative aspect-[16/7] w-full overflow-hidden"
        style={{ background: categoryGradient(campaign.category) }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_120%,rgba(7,7,11,0.95),rgba(7,7,11,0.35)_60%,transparent)]" />
        <div className="absolute inset-0 opacity-[0.18] [background-image:radial-gradient(rgba(255,255,255,.9)_1px,transparent_1px)] [background-size:14px_14px]" />
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <Pill tone="hi" className="bg-[rgba(7,7,11,0.55)] backdrop-blur-md">
            {CAMPAIGN_TYPE_LABEL[campaign.type]}
          </Pill>
          <Pill className="bg-[rgba(7,7,11,0.55)] backdrop-blur-md">{campaign.category}</Pill>
          {campaign.sample && (
            <Pill className="bg-[rgba(7,7,11,0.55)] backdrop-blur-md" title="Seeded example — an invented brand, nothing escrowed">
              Sample
            </Pill>
          )}
        </div>
        <div className="absolute right-3 bottom-3">
          <PlatformRow platforms={campaign.platforms} />
        </div>
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <BrandDisc name={campaign.brandName} category={campaign.category} size={30} />
          <span className="text-[13px] font-medium text-hi drop-shadow">{campaign.brandName}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-4 p-5">
        <h3 className="display line-clamp-2 text-[19px] leading-[1.15] font-semibold tracking-[-0.02em] text-hi">
          {campaign.title}
        </h3>

        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col">
            <span className="label">Reward</span>
            <span className="num brand-text text-[22px] font-semibold leading-none">
              {fmtToken(campaign.ratePerMille)}
              <span className="ml-1 text-[12px] font-semibold text-amber/90">{site.ticker}</span>
            </span>
            <span className="mt-1 text-[12px] text-low">per 1,000 views</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="label">{ended ? "Status" : "Ends"}</span>
            <span className="text-[13.5px] font-medium text-hi">
              {campaign.status === "closed" ? "Closed" : timeLeft(campaign.endsAt, now)}
            </span>
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <Progress value={spentPct} />
          <div className="flex items-center justify-between text-[12.5px]">
            <span className="text-mid">
              <span className="num text-hi">{fmtToken(remaining)}</span> {site.ticker} left
            </span>
            <span className="num text-low">
              {fmtToken(campaign.spent)} / {fmtToken(campaign.budget)} paid
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
