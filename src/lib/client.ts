import type { Campaign, Submission } from "@/lib/model";

/** Tiny fetch wrapper: JSON in, JSON out, the server's `error` as the throw. */
export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) {
    const msg = (body as { error?: string } | null)?.error ?? `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return body as T;
}

export type SubmissionAction =
  | { action: "approve" }
  | { action: "reject"; reason: string }
  | { action: "views"; views: number }
  | { action: "refresh" }
  | { action: "settle"; early?: boolean }
  | { action: "paid"; txHash: string };

export const patchSubmission = (id: string, body: SubmissionAction) =>
  api<{ submission: Submission; tracker?: { ok: boolean; reason?: string } }>(`/api/submissions/${id}`, { method: "PATCH", body });

export const patchCampaign = (id: string, body: { action: "close" } | { action: "activate" } | { action: "fund"; txHash: string }) =>
  api<{ campaign: Campaign }>(`/api/campaigns/${id}`, { method: "PATCH", body });
