import { getSession, opsIsOpen } from "@/lib/auth";
import { handle, json } from "@/lib/api";

export async function GET() {
  return handle(async () => {
    const session = await getSession();
    return json({ session, opsOpen: opsIsOpen() });
  });
}
