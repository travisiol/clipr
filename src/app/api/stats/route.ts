import { stats } from "@/lib/db";
import { handle, json } from "@/lib/api";

export async function GET() {
  return handle(() => json(stats()));
}
