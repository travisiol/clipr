import { requireSession } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/api";
import {
  markPaid,
  recordViews,
  refreshViews,
  reviewSubmission,
  ServiceError,
  settleSubmission,
} from "@/lib/service";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Everything that happens to a submission after it exists:
 *   approve / reject   — the brand (or ops), with a reason on reject
 *   views              — a hand-entered verified count (brand or ops)
 *   refresh            — ask the tracker (YouTube only, for now)
 *   settle             — ops fixes the payout and signs the voucher
 *   paid               — the clipper reports the redeem transaction
 */
export async function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    const auth = await requireSession();
    if ("response" in auth) return auth.response;
    const { id } = await ctx.params;
    const body = await readJson(req);
    switch (body.action) {
      case "approve":
      case "reject":
        return json({ submission: reviewSubmission(auth.session, id, body.action, body.reason) });
      case "views":
        return json({ submission: recordViews(auth.session, id, body.views) });
      case "refresh": {
        const { result, submission } = await refreshViews(auth.session, id);
        return json({ submission, tracker: result });
      }
      case "settle":
        return json({ submission: await settleSubmission(auth.session, id, { early: body.early === true }) });
      case "paid":
        return json({ submission: await markPaid(auth.session, id, body.txHash) });
      default:
        throw new ServiceError("Unknown action.");
    }
  });
}
