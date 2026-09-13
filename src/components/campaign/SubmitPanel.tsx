"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, Notice, Panel, PlatformIcon, StatusPill } from "@/components/ui";
import { WalletButton } from "@/components/wallet/WalletButton";
import { useSession } from "@/components/wallet/session";
import { fmtToken, fmtViews, timeAgo } from "@/lib/format";
import { PLATFORM_LABEL, earnedFor, type Campaign, type Submission } from "@/lib/model";
import { parsePostUrl } from "@/lib/platforms";
import { economics } from "@/lib/site";

/**
 * Where a clipper joins: paste the post link, see it recognised before
 * sending, then watch the submission's state here and on the dashboard.
 */
export function SubmitPanel({
  campaign,
  open,
  mine,
  isBrand,
  live,
}: {
  campaign: Campaign;
  open: boolean;
  mine: Submission[];
  isBrand: boolean;
  live: boolean;
}) {
  const { session } = useSession();
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Submission | null>(null);

  const parsed = url.trim() ? parsePostUrl(url) : null;
  const wrongPlatform = parsed?.ok && !campaign.platforms.includes(parsed.post.platform);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/submissions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body = (await res.json()) as { submission?: Submission; error?: string };
      if (!res.ok || !body.submission) throw new Error(body.error ?? "Submission refused.");
      setDone(body.submission);
      setUrl("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel card className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="display text-[20px]">Submit a clip</h2>
        {!live && (
          <span className="pill h-6 text-[10.5px]" title="No escrow is deployed — submissions are recorded, payouts cannot be claimed yet">
            preview
          </span>
        )}
      </div>

      {!open ? (
        <Notice>This campaign is not taking submissions.</Notice>
      ) : isBrand ? (
        <Notice>This is your campaign — review submissions below instead.</Notice>
      ) : !session ? (
        <div className="flex flex-col gap-3">
          <p className="text-[14px] text-mid">Sign in with the wallet that should receive the payout.</p>
          <WalletButton full />
        </div>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy && parsed?.ok && !wrongPlatform) void submit();
          }}
        >
          <Field
            label="Link to your post"
            error={url.trim() && parsed && !parsed.ok ? parsed.reason : wrongPlatform ? "This campaign does not accept that platform." : null}
            hint={
              parsed?.ok && !wrongPlatform ? (
                <span className="inline-flex items-center gap-1.5 text-hi">
                  <PlatformIcon platform={parsed.post.platform} className="h-3.5 w-3.5" />
                  {PLATFORM_LABEL[parsed.post.platform]} · recognised
                </span>
              ) : (
                `A public post on ${campaign.platforms.map((p) => PLATFORM_LABEL[p]).join(", ")}.`
              )
            }
          >
            <input
              className="field num text-[13.5px]"
              placeholder="https://www.tiktok.com/@you/video/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Button type="submit" variant="primary" busy={busy} disabled={!parsed?.ok || !!wrongPlatform} className="w-full">
            Submit for review
          </Button>
          {error && <Notice tone="bad">{error}</Notice>}
          {done && (
            <Notice tone="ok" title="Submitted">
              Your clip is in the brand&apos;s review queue. Views count from now; you can follow it on{" "}
              <Link href="/dashboard" className="underline underline-offset-4">
                My clips
              </Link>
              .
            </Notice>
          )}
          <p className="text-[12px] leading-relaxed text-low">
            Payout to <span className="num text-mid">{session.address.slice(0, 6)}…{session.address.slice(-4)}</span>. Views are
            tracked for {economics.trackingDays} days after submission; the brand approves before anything is paid.
          </p>
        </form>
      )}

      {mine.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-[var(--line)] pt-4">
          <span className="label">Your clips here</span>
          {mine.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 text-[13px]">
              <a href={s.url} target="_blank" rel="noreferrer nofollow" className="flex min-w-0 items-center gap-2 text-hi hover:text-amber">
                <PlatformIcon platform={s.platform} className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{s.url.replace(/^https?:\/\/(www\.)?/, "")}</span>
              </a>
              <span className="num shrink-0 text-mid">{fmtViews(s.views)} views</span>
              <span className="num shrink-0 text-hi">
                {fmtToken(s.status === "settled" || s.status === "paid" ? s.payout : earnedFor(campaign, s.views))}
              </span>
              <StatusPill status={s.status} />
              <span className="hidden shrink-0 text-low sm:block">{timeAgo(s.submittedAt)}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
