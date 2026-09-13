import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandDisc, Panel, Pill, PlatformIcon, PlatformRow, Progress, StatusPill } from "@/components/ui";
import { SubmitPanel } from "@/components/campaign/SubmitPanel";
import { ReviewQueue } from "@/components/campaign/ReviewQueue";
import { getSession } from "@/lib/auth";
import { getCampaign, listSubmissions } from "@/lib/db";
import { fmtDate, fmtToken, fmtViews, pct, timeAgo, timeLeft } from "@/lib/format";
import { CAMPAIGN_TYPE_LABEL, PLATFORM_LABEL, earnedFor, remainingBudget, shortAddress, viewsLeft } from "@/lib/model";
import { economics, site } from "@/lib/site";
import { isLive } from "@/lib/contracts";
import { now } from "@/lib/clock";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const c = getCampaign(id);
  if (!c) return { title: "Campaign" };
  return {
    title: c.title,
    description: `${fmtToken(c.ratePerMille)} ${site.ticker} per 1,000 views · ${fmtToken(remainingBudget(c))} ${site.ticker} left · ${c.platforms.map((p) => PLATFORM_LABEL[p]).join(", ")}`,
  };
}

export default async function CampaignPage({ params }: Props) {
  const { id } = await params;
  const campaign = getCampaign(id);
  if (!campaign) notFound();
  const session = await getSession();
  const isBrand = !!session && session.address.toLowerCase() === campaign.brand.toLowerCase();
  const canReview = isBrand || !!session?.ops;
  if (campaign.status === "pending_budget" && !canReview) notFound();

  const submissions = listSubmissions({ campaignId: campaign.id });
  const leaderboard = submissions.filter((s) => s.status !== "rejected").sort((a, b) => b.views - a.views).slice(0, 12);
  const mine = session ? submissions.filter((s) => s.clipper.toLowerCase() === session.address.toLowerCase()) : [];
  const remaining = remainingBudget(campaign);
  const at = now();
  const open = campaign.status === "active" && campaign.endsAt > at && remaining > 0n;

  return (
    <section className="shell py-8 md:py-12">
      <Link href="/campaigns" className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-mid hover:text-hi">
        ← All campaigns
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* ─────────────────────────── Brief ─────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-8">
          <header className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="hi">{CAMPAIGN_TYPE_LABEL[campaign.type]}</Pill>
              <Pill>{campaign.category}</Pill>
              {campaign.sample && <Pill title="Seeded example — an invented brand, nothing escrowed">Sample</Pill>}
              {campaign.status === "pending_budget" && <Pill tone="brand">Pending budget</Pill>}
              {campaign.status === "closed" && <Pill tone="bad">Closed</Pill>}
              {campaign.status === "active" && !open && <Pill>Ended</Pill>}
              {campaign.escrowId !== null ? (
                <Pill tone="ok">Escrowed · #{campaign.escrowId}</Pill>
              ) : (
                <Pill title="No escrow deposit backs this campaign yet">Not escrowed</Pill>
              )}
            </div>
            <h1 className="display text-[clamp(28px,4.4vw,48px)]">{campaign.title}</h1>
            <div className="flex items-center gap-3">
              <BrandDisc name={campaign.brandName} category={campaign.category} size={34} />
              <div className="flex flex-col leading-tight">
                <span className="text-[14.5px] font-semibold text-hi">{campaign.brandName}</span>
                <span className="num text-[12px] text-low">{shortAddress(campaign.brand)}</span>
              </div>
              <span className="ml-auto text-[12.5px] text-low">
                Posted {timeAgo(campaign.createdAt)} · {campaign.status === "closed" ? `closed ${fmtDate(campaign.closedAt ?? campaign.endsAt)}` : timeLeft(campaign.endsAt, at)}
              </span>
            </div>
          </header>

          <Panel card className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-1.5">
              <span className="label">The brief</span>
              <p className="text-[15.5px] leading-relaxed whitespace-pre-line text-hi">{campaign.description}</p>
            </div>
            <div className="flex flex-col gap-2">
              <span className="label">Requirements</span>
              <ul className="flex flex-col gap-2">
                {campaign.requirements.length === 0 && <li className="text-[14px] text-mid">None beyond the platform rules.</li>}
                {campaign.requirements.map((r) => (
                  <li key={r} className="flex gap-3 text-[14.5px] text-mid">
                    <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <span className="label">Platforms</span>
                <div className="flex flex-wrap gap-2">
                  {campaign.platforms.map((p) => (
                    <span key={p} className="pill pill-hi h-8 gap-2 px-3 text-[12.5px]">
                      <PlatformIcon platform={p} className="h-3.5 w-3.5" />
                      {PLATFORM_LABEL[p]}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="label">Source material</span>
                {campaign.assetsUrl ? (
                  <a
                    href={campaign.assetsUrl}
                    target="_blank"
                    rel="noreferrer nofollow"
                    className="w-fit text-[14px] text-amber underline-offset-4 hover:underline"
                  >
                    Open the assets folder ↗
                  </a>
                ) : (
                  <span className="text-[14px] text-mid">Provided in the brief.</span>
                )}
              </div>
            </div>
          </Panel>

          {/* ─────────────────────── Leaderboard ─────────────────────── */}
          <Panel card className="overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h2 className="display text-[20px]">Top clips</h2>
              <span className="text-[12.5px] text-low">
                {submissions.length} submitted · {submissions.filter((s) => s.status === "pending").length} in review
              </span>
            </div>
            {leaderboard.length === 0 ? (
              <p className="px-6 pb-6 text-[14px] text-mid">No clips yet — the first one sets the pace.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table min-w-[560px]">
                  <thead>
                    <tr>
                      <th className="w-8">#</th>
                      <th>Clip</th>
                      <th>Clipper</th>
                      <th className="text-right">Views</th>
                      <th className="text-right">Earned</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((s, i) => {
                      const earned = s.status === "settled" || s.status === "paid" ? BigInt(s.payout) : earnedFor(campaign, s.views);
                      return (
                        <tr key={s.id}>
                          <td className="num text-low">{i + 1}</td>
                          <td>
                            <a href={s.url} target="_blank" rel="noreferrer nofollow" className="inline-flex items-center gap-2 text-hi hover:text-amber">
                              <PlatformIcon platform={s.platform} className="h-3.5 w-3.5" />
                              <span className="max-w-[220px] truncate">{s.url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                            </a>
                          </td>
                          <td className="num text-mid">{shortAddress(s.clipper)}</td>
                          <td className="num text-right text-hi">{fmtViews(s.views)}</td>
                          <td className="num text-right text-hi">
                            {fmtToken(earned)} <span className="text-[11px] text-low">{site.ticker}</span>
                          </td>
                          <td>
                            <StatusPill status={s.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {canReview && (
            <ReviewQueue campaign={campaign} submissions={submissions} isBrand={isBrand} ops={!!session?.ops} />
          )}
        </div>

        {/* ──────────────────────── Side panel ─────────────────────── */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <Panel card strong className="flex flex-col gap-5 p-6">
            <div>
              <span className="label">Reward</span>
              <div className="num brand-text mt-1 text-[38px] leading-none font-semibold">
                {fmtToken(campaign.ratePerMille)} <span className="text-[16px] text-amber">{site.ticker}</span>
              </div>
              <div className="mt-1 text-[13px] text-mid">per 1,000 views</div>
            </div>
            <div className="flex flex-col gap-2">
              <Progress value={pct(BigInt(campaign.spent), BigInt(campaign.budget))} />
              <div className="flex justify-between text-[12.5px]">
                <span className="text-mid">
                  <span className="num text-hi">{fmtToken(remaining)}</span> {site.ticker} left
                </span>
                <span className="num text-low">of {fmtToken(campaign.budget)}</span>
              </div>
              <div className="text-[12px] text-low">≈ {fmtViews(viewsLeft(campaign))} more views can still be paid</div>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
              <div>
                <dt className="label">Min payout</dt>
                <dd className="num text-hi">
                  {fmtToken(campaign.minPayout)} {site.ticker}
                </dd>
              </div>
              <div>
                <dt className="label">Max per clip</dt>
                <dd className="num text-hi">
                  {BigInt(campaign.maxPayout) > 0n ? `${fmtToken(campaign.maxPayout)} ${site.ticker}` : "No cap"}
                </dd>
              </div>
              {BigInt(campaign.flatBonus) > 0n && (
                <div>
                  <dt className="label">Flat bonus</dt>
                  <dd className="num text-hi">
                    +{fmtToken(campaign.flatBonus)} {site.ticker}
                  </dd>
                </div>
              )}
              <div>
                <dt className="label">Tracking</dt>
                <dd className="text-hi">{economics.trackingDays} days per clip</dd>
              </div>
              <div>
                <dt className="label">Ends</dt>
                <dd className="text-hi">{fmtDate(campaign.endsAt)}</dd>
              </div>
            </dl>
            <div className="flex items-center justify-between border-t border-[var(--line)] pt-4">
              <span className="label">Accepts</span>
              <PlatformRow platforms={campaign.platforms} />
            </div>
          </Panel>

          <SubmitPanel campaign={campaign} open={open} mine={mine} isBrand={isBrand} live={isLive} />
        </aside>
      </div>
    </section>
  );
}
