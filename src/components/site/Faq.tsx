import { economics, site } from "@/lib/site";

/**
 * The objections, answered rather than avoided. The three hard ones — price
 * risk, who verifies views, sell pressure — are the ones a sceptic raises
 * first, so they come first.
 */
const items: [string, string][] = [
  [
    `The rate is in ${site.ticker}. What happens when the price moves?`,
    `The rate is fixed in ${site.ticker} when the campaign is created, and so is the budget. If ${site.ticker} rises, the brand's campaign becomes more expensive in dollar terms and clippers earn more; if it falls, the opposite. This is the honest cost of "everything in one coin": there is no dollar peg underneath. Brands can close a campaign at any time and withdraw what is unspent after the grace period, so nobody is locked into a rate that has drifted.`,
  ],
  [
    "Who counts the views? Can the chain check TikTok?",
    `No — no chain can read TikTok, Instagram, YouTube or X. Views are read by the platform (through YouTube's API where it exists, by hand where it does not) and the payout is signed by the platform's verifier key. The contract then enforces the part that a website cannot fake: the budget was really deposited, a clip is paid once and only once, and a voucher can never exceed the budget. It is the same trust model as any clipping platform, with the money side made public.`,
  ],
  [
    `Clippers will sell their ${site.ticker} the moment they get it. Isn't that constant sell pressure?`,
    `Yes, some will, and the design does not pretend otherwise. What pushes the other way is that every campaign has to be funded in ${site.ticker} — a brand must buy the coin to post a budget — and the ${economics.feeBps / 100} % platform fee is taken in ${site.ticker} on every deposit and sent to the fee recipient. Whether that address is a treasury or a burn address is a launch decision, and it is one line in the contract.`,
  ],
  [
    "How do you stop bot views?",
    `Two ways, neither magic. First, submissions are reviewed by the brand before anything is approved, with a required reason on every rejection. Second, views are verified at the end of the ${economics.trackingDays}-day tracking window, not at submission, and the verifier records where the number came from. A clip that looks bought gets rejected before a voucher exists. There is no automated fraud model here yet; there is a human with a reason field.`,
  ],
  [
    "Do I need followers, an application or a portfolio?",
    "No. You need a wallet and a post that meets the brief. Campaigns pay on the views a specific clip gets, not on the size of the account it was posted from.",
  ],
  [
    "What are the minimum and maximum payouts on a card?",
    "Each brand sets both. A clip that earns less than the minimum by the end of the tracking window is not paid — it keeps small, low-effort spam off the queue. The maximum caps what a single clip can take from the budget, so one viral post cannot drain a campaign meant for many clippers.",
  ],
  [
    "What does the brand pay on top of the budget?",
    `A ${economics.feeBps / 100} % platform fee, charged when the budget is deposited (and on every top-up). The whole budget figure shown on a card is available to clippers; the fee is on top of it, not inside it.`,
  ],
  [
    "Can the platform take the money?",
    "Not the campaign budgets. The escrow contract has no owner function that moves them: the owner can rotate the verifier key and change the fee for future deposits, and that is all. Budgets leave the contract in exactly two ways — to a clipper against a signed voucher, or back to the brand after the campaign is closed and the grace period has run out.",
  ],
  [
    "Is this live?",
    `Not yet. The escrow contract exists and is tested, but nothing is deployed and the token has not launched — every screen says "preview" or "awaiting launch" until both are true. Until then, campaigns you create are recorded but not escrowed, and vouchers are computed but cannot be claimed.`,
  ],
];

export function Faq() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map(([q, a]) => (
        <details key={q} className="glass group rounded-[18px] px-5 py-4 open:bg-[var(--glass-2)]">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[15px] font-semibold text-hi [&::-webkit-details-marker]:hidden">
            <span>{q}</span>
            <span className="mt-1 shrink-0 text-amber transition-transform duration-200 group-open:rotate-45" aria-hidden>
              +
            </span>
          </summary>
          <p className="mt-3 text-[14px] leading-relaxed text-mid">{a}</p>
        </details>
      ))}
    </div>
  );
}
