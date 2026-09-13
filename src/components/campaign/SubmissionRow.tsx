"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, PlatformIcon, StatusPill } from "@/components/ui";
import { patchSubmission } from "@/lib/client";
import { fmtToken, timeAgo, timeLeft } from "@/lib/format";
import { earnedFor, shortAddress, trackingEndsAt, type Campaign, type Submission } from "@/lib/model";
import { economics, site } from "@/lib/site";

/**
 * One submission under review. The same row serves the brand (approve,
 * reject, record views) and ops (plus settle). Every action posts, then
 * refreshes the server-rendered page so the numbers above it move too.
 */
export function SubmissionRow({
  campaign,
  submission: s,
  ops,
  showCampaign,
}: {
  campaign: Campaign;
  submission: Submission;
  ops: boolean;
  showCampaign?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [views, setViews] = useState(String(s.views || ""));
  const [now] = useState(() => Date.now());

  const frozen = s.status === "settled" || s.status === "paid" || s.status === "rejected";
  const windowEnd = trackingEndsAt(s.submittedAt, economics.trackingDays);
  const windowOver = now >= windowEnd;
  const earned = frozen && s.status !== "rejected" ? BigInt(s.payout) : earnedFor(campaign, s.views);
  const belowMin = earned < BigInt(campaign.minPayout);

  async function run(label: string, fn: () => Promise<{ tracker?: { ok: boolean; reason?: string } }>) {
    setBusy(label);
    setError(null);
    setNote(null);
    try {
      const out = await fn();
      if (out.tracker && !out.tracker.ok) setNote(out.tracker.reason ?? "No tracker.");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3 border-b border-[var(--line-soft)] py-4 last:border-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
        <a href={s.url} target="_blank" rel="noreferrer nofollow" className="inline-flex min-w-0 items-center gap-2 text-hi hover:text-amber">
          <PlatformIcon platform={s.platform} className="h-3.5 w-3.5 shrink-0" />
          <span className="max-w-[260px] truncate">{s.url.replace(/^https?:\/\/(www\.)?/, "")}</span>
        </a>
        {showCampaign && <span className="max-w-[220px] truncate text-mid">{campaign.title}</span>}
        <span className="num text-low">{shortAddress(s.clipper)}</span>
        <span className="text-low">{timeAgo(s.submittedAt)}</span>
        <StatusPill status={s.status} />
        <span className="num ml-auto text-hi">
          {fmtToken(earned)} <span className="text-[11px] text-low">{site.ticker}</span>
          {!frozen && belowMin && <span className="ml-2 text-[11px] text-low">below min</span>}
        </span>
      </div>

      {s.reason && <p className="text-[12.5px] text-bad">Reason: {s.reason}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {/* Views */}
        <label className="flex items-center gap-2 text-[12.5px] text-mid">
          <span className="label">Views</span>
          <input
            className="field num h-9 w-[130px] text-[13px]"
            inputMode="numeric"
            value={views}
            disabled={frozen}
            onChange={(e) => setViews(e.target.value.replace(/[^\d]/g, ""))}
          />
        </label>
        {!frozen && (
          <>
            <Button
              size="xs"
              busy={busy === "views"}
              disabled={views === "" || Number(views) === s.views}
              onClick={() => run("views", () => patchSubmission(s.id, { action: "views", views: Number(views) }))}
            >
              Record
            </Button>
            {s.platform === "youtube" && (
              <Button size="xs" busy={busy === "refresh"} onClick={() => run("refresh", () => patchSubmission(s.id, { action: "refresh" }))}>
                Fetch from YouTube
              </Button>
            )}
          </>
        )}
        <span className="text-[11.5px] text-low">
          {s.viewsAt ? `${s.viewsSource === "youtube-api" ? "YouTube API" : "entered by hand"} · ${timeAgo(s.viewsAt)}` : "no count recorded"}
          {" · "}
          {windowOver ? "window over" : `window: ${timeLeft(windowEnd, now)}`}
        </span>

        <span className="ml-auto flex flex-wrap items-center gap-2">
          {s.status === "pending" && (
            <Button size="xs" variant="ok" busy={busy === "approve"} onClick={() => run("approve", () => patchSubmission(s.id, { action: "approve" }))}>
              Approve
            </Button>
          )}
          {(s.status === "pending" || s.status === "approved") && !rejecting && (
            <Button size="xs" variant="bad" onClick={() => setRejecting(true)}>
              Reject
            </Button>
          )}
          {ops && s.status === "approved" && (
            <Button
              size="xs"
              variant="primary"
              busy={busy === "settle"}
              title={windowOver ? "Fix the payout and sign the voucher" : "The tracking window is still running — this settles early"}
              onClick={() => run("settle", () => patchSubmission(s.id, { action: "settle", early: !windowOver }))}
            >
              {windowOver ? "Settle" : "Settle early"}
            </Button>
          )}
        </span>
      </div>

      {rejecting && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="field h-9 flex-1 text-[13px]"
            placeholder="Reason the clipper will read — e.g. sped-up audio, missing tag"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
          <Button
            size="xs"
            variant="bad"
            busy={busy === "reject"}
            disabled={!reason.trim()}
            onClick={() => run("reject", () => patchSubmission(s.id, { action: "reject", reason }))}
          >
            Confirm rejection
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setRejecting(false)}>
            Cancel
          </Button>
        </div>
      )}

      {s.status === "settled" && (
        <p className="text-[12px] text-low">
          {s.voucher ? (
            <>
              Voucher signed · deadline {new Date(s.voucher.deadline * 1000).toLocaleDateString()} · claimable by the clipper.
            </>
          ) : (
            <>Payout fixed at {fmtToken(s.payout)} {site.ticker}. No voucher — the escrow is not deployed or the signer is not configured.</>
          )}
        </p>
      )}
      {s.status === "paid" && s.paidTx && (
        <p className="num text-[12px] text-low">Paid · tx {s.paidTx.slice(0, 10)}…</p>
      )}
      {note && <p className="text-[12.5px] text-amber">{note}</p>}
      {error && <p className="text-[12.5px] text-bad">{error}</p>}
    </div>
  );
}
