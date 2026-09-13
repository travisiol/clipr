import { requireSession } from "@/lib/auth";
import { listCampaigns } from "@/lib/db";
import { handle, json, readJson } from "@/lib/api";
import { createCampaign, parseCampaignInput } from "@/lib/service";

export async function GET() {
  return handle(() => json({ campaigns: listCampaigns() }));
}

export async function POST(req: Request) {
  return handle(async () => {
    const auth = await requireSession();
    if ("response" in auth) return auth.response;
    const input = parseCampaignInput(await readJson(req));
    const campaign = createCampaign(auth.session, input);
    return json({ campaign }, { status: 201 });
  });
}
