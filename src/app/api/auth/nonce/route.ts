import { issueNonce } from "@/lib/auth";
import { handle, json } from "@/lib/api";

export async function GET() {
  return handle(() => json({ nonce: issueNonce(), issuedAt: new Date().toISOString() }));
}
