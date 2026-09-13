import "server-only";
import { ServiceError } from "@/lib/service";

/** Parse a JSON body, tolerating an empty one. */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const text = await req.text();
    if (!text.trim()) return {};
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    throw new ServiceError("Body must be JSON.");
  }
}

/** Run a handler and turn thrown ServiceErrors into JSON responses. */
export async function handle(fn: () => Promise<Response> | Response): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ServiceError) return Response.json({ error: err.message }, { status: err.status });
    console.error(err);
    return Response.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}

export const json = (data: unknown, init?: ResponseInit) => Response.json(data, init);
