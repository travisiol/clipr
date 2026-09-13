"use client";

import { clsx } from "clsx";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, Field, Notice, Panel, Pill, PlatformIcon } from "@/components/ui";
import { WalletButton } from "@/components/wallet/WalletButton";
import { useSession } from "@/components/wallet/session";
import { api } from "@/lib/client";
import { fmtWhole } from "@/lib/format";
import {
  CAMPAIGN_TYPES,
  CAMPAIGN_TYPE_LABEL,
  CATEGORIES,
  PLATFORMS,
  PLATFORM_LABEL,
  type Campaign,
  type CampaignType,
  type Category,
  type Platform,
} from "@/lib/model";
import { economics, site } from "@/lib/site";

/**
 * Three steps, the same fields the marketplace's cards and pages are built
 * from: the brief, the money, the review. Nothing is sent until step three;
 * the server re-validates everything anyway.
 */

type Draft = {
  brandName: string;
  title: string;
  type: CampaignType;
  category: Category;
  platforms: Platform[];
  description: string;
  requirements: string;
  assetsUrl: string;
  ratePerMille: string;
  budget: string;
  minPayout: string;
  maxPayout: string;
  flatBonus: string;
  durationDays: string;
};

const initial: Draft = {
  brandName: "",
  title: "",
  type: "clipping",
  category: "Podcast",
  platforms: ["tiktok", "instagram", "youtube"],
  description: "",
  requirements: "",
  assetsUrl: "",
  ratePerMille: "2",
  budget: "10000",
  minPayout: "10",
  maxPayout: "1000",
  flatBonus: "0",
  durationDays: "30",
};

const num = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

export function LaunchWizard({ live }: { live: boolean }) {
  const { session } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((prev) => ({ ...prev, [k]: v }));

  const problems = useMemo(() => {
    const p: Partial<Record<keyof Draft, string>> = {};
    if (!d.brandName.trim()) p.brandName = "Who is paying? A name clippers will recognise.";
    if (d.title.trim().length < 6) p.title = "Give the campaign a title.";
    if (d.description.trim().length < 20) p.description = "Say what to clip and where it is — at least a couple of sentences.";
    if (d.platforms.length === 0) p.platforms = "Pick at least one platform.";
    if (d.assetsUrl.trim() && !/^https:\/\//.test(d.assetsUrl.trim())) p.assetsUrl = "Must start with https://";
    const rate = num(d.ratePerMille);
    const budget = num(d.budget);
    const min = num(d.minPayout);
    const max = num(d.maxPayout);
    const bonus = num(d.flatBonus);
    const days = Number(d.durationDays);
    if (!(rate > 0)) p.ratePerMille = "A rate above zero.";
    if (!(budget > 0)) p.budget = "A budget above zero.";
    if (Number.isNaN(min)) p.minPayout = "A number (0 for none).";
    if (Number.isNaN(max)) p.maxPayout = "A number (0 for no cap).";
    if (max > 0 && min > max) p.minPayout = "Above the maximum.";
    if (max > budget) p.maxPayout = "Above the whole budget.";
    if (rate > budget) p.ratePerMille = "Above the whole budget.";
    if (Number.isNaN(bonus)) p.flatBonus = "A number (0 for none).";
    if (!Number.isInteger(days) || days < 1 || days > 180) p.durationDays = "1 to 180 days.";
    return p;
  }, [d]);

  const stepOk = [
    !problems.brandName && !problems.title && !problems.description && !problems.platforms && !problems.assetsUrl,
    !problems.ratePerMille && !problems.budget && !problems.minPayout && !problems.maxPayout && !problems.flatBonus && !problems.durationDays,
    true,
  ];

  const budgetN = num(d.budget) || 0;
  const rateN = num(d.ratePerMille) || 0;
  const feeN = (budgetN * economics.feeBps) / 10_000;
  const viewsN = rateN > 0 ? Math.floor((budgetN / rateN) * 1000) : 0;
  const usd = (n: number) => (economics.usdPerToken ? ` ≈ $${fmtWhole(n * economics.usdPerToken, 2)}` : "");

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const { campaign } = await api<{ campaign: Campaign }>("/api/campaigns", {
        method: "POST",
        body: {
          brandName: d.brandName,
          title: d.title,
          type: d.type,
          category: d.category,
          platforms: d.platforms,
          description: d.description,
          requirements: d.requirements
            .split("\n")
            .map((r) => r.trim())
            .filter(Boolean),
          assetsUrl: d.assetsUrl.trim() || null,
          ratePerMille: d.ratePerMille,
          budget: d.budget,
          minPayout: d.minPayout || "0",
          maxPayout: d.maxPayout || "0",
          flatBonus: d.flatBonus || "0",
          durationDays: Number(d.durationDays),
        },
      });
      router.push(`/campaigns/${campaign.id}#review`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const tab = (i: number, label: string) => (
    <button
      type="button"
      key={label}
      onClick={() => i < step && setStep(i)}
      className={clsx(
        "flex items-center gap-2 text-[13px] font-semibold",
        i === step ? "text-hi" : i < step ? "text-amber" : "text-low",
      )}
    >
      <span
        className={clsx(
          "num flex h-6 w-6 items-center justify-center rounded-full border text-[11px]",
          i === step ? "border-amber/60 bg-[var(--ember-wash)]" : i < step ? "border-amber/40" : "border-[var(--rim)]",
        )}
      >
        {i + 1}
      </span>
      {label}
    </button>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Panel card className="flex flex-col gap-6 p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-6">
          {tab(0, "The brief")}
          <span className="h-px flex-1 bg-[var(--line)]" />
          {tab(1, "Budget & rewards")}
          <span className="h-px flex-1 bg-[var(--line)]" />
          {tab(2, "Review & post")}
        </div>

        {step === 0 && (
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Brand name" error={d.brandName && problems.brandName ? problems.brandName : null}>
              <input className="field" value={d.brandName} onChange={(e) => set("brandName", e.target.value)} placeholder="Nightshift Records" maxLength={60} />
            </Field>
            <Field label="Campaign title" error={d.title && problems.title ? problems.title : null}>
              <input className="field" value={d.title} onChange={(e) => set("title", e.target.value)} placeholder="Clip the 'Low Tide' sessions" maxLength={120} />
            </Field>
            <Field label="Type" hint="Clipping: they cut your footage. UGC: they make original content about you.">
              <div className="flex gap-2">
                {CAMPAIGN_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set("type", t)}
                    className={clsx(
                      "btn btn-sm flex-1",
                      d.type === t ? "btn-primary" : "btn-glass",
                    )}
                    aria-pressed={d.type === t}
                  >
                    {CAMPAIGN_TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Category">
              <select className="field" value={d.category} onChange={(e) => set("category", e.target.value as Category)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Platforms accepted" error={problems.platforms ?? null} className="md:col-span-2">
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => {
                  const on = d.platforms.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set("platforms", on ? d.platforms.filter((x) => x !== p) : [...d.platforms, p])}
                      className={clsx(
                        "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[13.5px] font-medium transition-colors",
                        on ? "border-amber/50 bg-[var(--ember-wash)] text-hi" : "border-[var(--rim)] bg-[var(--glass)] text-mid hover:text-hi",
                      )}
                    >
                      <PlatformIcon platform={p} className="h-4 w-4" />
                      {PLATFORM_LABEL[p]}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field
              label="What to clip, and where it is"
              className="md:col-span-2"
              error={d.description && problems.description ? problems.description : null}
              hint="Clippers read this before anything else. Say what the source material is, what moments work, what tone you want."
            >
              <textarea className="field" value={d.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} />
            </Field>
            <Field label="Requirements — one per line" className="md:col-span-2" hint="These are the rules you approve and reject against. Be literal: tags, credits, formats, what is banned.">
              <textarea
                className="field min-h-[100px]"
                value={d.requirements}
                onChange={(e) => set("requirements", e.target.value)}
                placeholder={"Vertical 9:16, 15–45 seconds\nCredit @yourhandle in the caption\nNo speed-up, no AI voice-over"}
              />
            </Field>
            <Field label="Assets link (optional)" className="md:col-span-2" error={problems.assetsUrl ?? null} hint="A public Drive / Dropbox folder with the source videos.">
              <input className="field num text-[13.5px]" value={d.assetsUrl} onChange={(e) => set("assetsUrl", e.target.value)} placeholder="https://drive.google.com/…" />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-5 md:grid-cols-2">
            <Field label={`Rate per 1,000 views (${site.ticker})`} error={problems.ratePerMille ?? null} hint={`What a clipper earns for every thousand verified views.${usd(rateN)}`}>
              <input className="field num" inputMode="decimal" value={d.ratePerMille} onChange={(e) => set("ratePerMille", e.target.value)} />
            </Field>
            <Field label={`Budget (${site.ticker})`} error={problems.budget ?? null} hint={`Deposited into the escrow. A ${economics.feeBps / 100} % fee is charged on top.${usd(budgetN)}`}>
              <input className="field num" inputMode="decimal" value={d.budget} onChange={(e) => set("budget", e.target.value)} />
            </Field>
            <Field label={`Minimum payout (${site.ticker})`} error={problems.minPayout ?? null} hint="A clip earning less than this at the end of tracking is not paid. Keeps spam out of your queue.">
              <input className="field num" inputMode="decimal" value={d.minPayout} onChange={(e) => set("minPayout", e.target.value)} />
            </Field>
            <Field label={`Maximum per clip (${site.ticker})`} error={problems.maxPayout ?? null} hint="Caps one viral clip so the budget reaches many clippers. 0 for no cap.">
              <input className="field num" inputMode="decimal" value={d.maxPayout} onChange={(e) => set("maxPayout", e.target.value)} />
            </Field>
            <Field label={`Flat bonus per approved clip (${site.ticker})`} error={problems.flatBonus ?? null} hint="Optional. Paid on top of the view reward — common for UGC.">
              <input className="field num" inputMode="decimal" value={d.flatBonus} onChange={(e) => set("flatBonus", e.target.value)} />
            </Field>
            <Field label="Duration (days)" error={problems.durationDays ?? null} hint="You can close it earlier at any time.">
              <input className="field num" inputMode="numeric" value={d.durationDays} onChange={(e) => set("durationDays", e.target.value)} />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-5">
            <Summary d={d} />
            {!live && (
              <Notice tone="brand" title="Preview mode">
                No escrow contract is deployed. The campaign will be listed as <strong>not escrowed</strong> and clippers can submit, but no
                {" "}{site.ticker} moves until the contract is live and you deposit.
              </Notice>
            )}
            {live && (
              <Notice>
                After posting, the campaign waits as <strong>pending budget</strong> until you deposit {fmtWhole(budgetN + feeN)} {site.ticker} from{" "}
                <span className="num">{session ? `${session.address.slice(0, 6)}…${session.address.slice(-4)}` : "your wallet"}</span> — two transactions
                (approve, deposit), then it lists.
              </Notice>
            )}
            {!session && (
              <div className="flex flex-col gap-3">
                <p className="text-[14px] text-mid">Sign in with the wallet that will fund the campaign — it is the only one that can close it and withdraw.</p>
                <WalletButton />
              </div>
            )}
            {error && <Notice tone="bad">{error}</Notice>}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-[var(--line)] pt-5">
          <Button variant="ghost" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>
            ← Back
          </Button>
          {step < 2 ? (
            <Button variant="primary" disabled={!stepOk[step]} onClick={() => setStep((s) => s + 1)}>
              Continue →
            </Button>
          ) : (
            <Button variant="primary" busy={busy} disabled={!session || !stepOk[0] || !stepOk[1]} onClick={() => void create()}>
              {live ? "Post campaign, then deposit" : "Post campaign (preview)"}
            </Button>
          )}
        </div>
      </Panel>

      {/* Live ticket */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Panel card strong className="flex flex-col gap-4 p-6">
          <span className="label">Your campaign, as a card</span>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="hi">{CAMPAIGN_TYPE_LABEL[d.type]}</Pill>
            <Pill>{d.category}</Pill>
          </div>
          <div className="display text-[20px] leading-tight">{d.title.trim() || "Untitled campaign"}</div>
          <div className="text-[13px] text-mid">{d.brandName.trim() || "Your brand"}</div>
          <div className="flex items-end justify-between">
            <div>
              <span className="label">Reward</span>
              <div className="num brand-text text-[26px] font-semibold leading-none">
                {fmtWhole(rateN)} <span className="text-[12px] text-amber">{site.ticker}</span>
              </div>
              <div className="text-[12px] text-low">per 1,000 views</div>
            </div>
            <div className="flex gap-1.5">
              {d.platforms.map((p) => (
                <span key={p} className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--rim)] bg-[var(--glass-2)] text-hi">
                  <PlatformIcon platform={p} className="h-3.5 w-3.5" />
                </span>
              ))}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[var(--line)] pt-4 text-[13px]">
            <Row k="Budget" v={`${fmtWhole(budgetN)} ${site.ticker}`} />
            <Row k={`Fee ${economics.feeBps / 100} %`} v={`${fmtWhole(feeN)} ${site.ticker}`} />
            <Row k="You deposit" v={`${fmtWhole(budgetN + feeN)} ${site.ticker}`} strong />
            <Row k="Views it can pay for" v={viewsN.toLocaleString("en-US")} />
            <Row k="Min / max per clip" v={`${fmtWhole(num(d.minPayout) || 0)} / ${num(d.maxPayout) > 0 ? fmtWhole(num(d.maxPayout)) : "∞"}`} />
            <Row k="Runs for" v={`${d.durationDays || "?"} days`} />
          </dl>
          <p className="text-[12px] leading-relaxed text-low">
            Unspent budget is yours to withdraw {economics.gracePeriodDays} days after you close the campaign. The fee is not refunded.
          </p>
        </Panel>
      </aside>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <>
      <dt className="text-low">{k}</dt>
      <dd className={clsx("num text-right", strong ? "font-semibold text-hi" : "text-hi")}>{v}</dd>
    </>
  );
}

function Summary({ d }: { d: Draft }) {
  const reqs = d.requirements
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean);
  return (
    <div className="flex flex-col gap-4 text-[14px]">
      <div>
        <span className="label">Brief</span>
        <p className="mt-1 whitespace-pre-line text-hi">{d.description}</p>
      </div>
      <div>
        <span className="label">Requirements</span>
        {reqs.length === 0 ? (
          <p className="mt-1 text-mid">None listed — you will be approving on the brief alone.</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1 text-mid">
            {reqs.map((r) => (
              <li key={r}>· {r}</li>
            ))}
          </ul>
        )}
      </div>
      {d.assetsUrl.trim() && (
        <div>
          <span className="label">Assets</span>
          <p className="num mt-1 truncate text-[13px] text-amber">{d.assetsUrl.trim()}</p>
        </div>
      )}
    </div>
  );
}
