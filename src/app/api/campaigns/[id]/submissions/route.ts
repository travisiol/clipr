import { requireSession } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/api";
import { submitClip } from "@/lib/service";

type Ctx = { params: Promise<{ id: string }> };

/** A clipper submits a post to a campaign. */
export async function POST(req: Request, ctx: Ctx) {
  return handle(async () => {
    const auth = await requireSession();
    if ("response" in auth) return auth.response;
    const { id } = await ctx.params;
    const body = await readJson(req);
    const submission = submitClip(auth.session, id, body.url);
    return json({ submission }, { status: 201 });
  });
}
