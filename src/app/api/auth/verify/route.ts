import { setSession, verifySignIn } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/api";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    const result = await verifySignIn({
      address: String(body.address ?? ""),
      nonce: String(body.nonce ?? ""),
      issuedAt: String(body.issuedAt ?? ""),
      signature: String(body.signature ?? ""),
    });
    if (!result.ok) return json({ error: result.reason }, { status: 401 });
    const session = await setSession(result.address);
    return json({ session });
  });
}
