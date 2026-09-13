import "server-only";
import type { Platform } from "@/lib/model";

/**
 * View trackers. The honest state of the art: YouTube publishes view counts
 * through a keyed API, the other three do not — TikTok, Instagram and X
 * expose nothing a server can call without scraping, which breaks and
 * violates terms. For those, the operator reads the number on the post and
 * records it by hand, and the record says "manual" next to the figure.
 */

export type TrackResult =
  | { ok: true; views: number; source: "youtube-api" }
  | { ok: false; reason: string; manual: true };

const MANUAL: Record<Exclude<Platform, "youtube">, string> = {
  tiktok: "TikTok has no public view-count API — read the count on the post and enter it.",
  instagram: "Instagram exposes no view counts to third parties — read the count on the reel and enter it.",
  x: "X's API is keyed and paid; no tracker is configured — read the count on the post and enter it.",
};

export async function trackViews(platform: Platform, postId: string): Promise<TrackResult> {
  if (platform !== "youtube") return { ok: false, manual: true, reason: MANUAL[platform] };

  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) {
    return { ok: false, manual: true, reason: "YOUTUBE_API_KEY is not set — enter the count read on the Short." };
  }
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "statistics");
  url.searchParams.set("id", postId);
  url.searchParams.set("key", key);
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { ok: false, manual: true, reason: `YouTube API answered ${res.status}.` };
    const body = (await res.json()) as { items?: { statistics?: { viewCount?: string } }[] };
    const count = Number(body.items?.[0]?.statistics?.viewCount);
    if (!Number.isFinite(count)) return { ok: false, manual: true, reason: "Video not found or statistics hidden." };
    return { ok: true, views: Math.floor(count), source: "youtube-api" };
  } catch (err) {
    return { ok: false, manual: true, reason: `YouTube API unreachable: ${(err as Error).message}` };
  }
}
