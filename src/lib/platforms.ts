import type { Platform } from "@/lib/model";

export type ParsedPost = {
  platform: Platform;
  postId: string;
  /** Normalised form, used for de-duplication inside a campaign. */
  canonicalUrl: string;
};

/**
 * Recognise a post URL from one of the four platforms and reduce it to a
 * stable identity. Everything else (profile links, shortened TikTok links
 * that need a redirect to resolve, tracking parameters) is refused with a
 * reason the form can show.
 */
export function parsePostUrl(raw: string): { ok: true; post: ParsedPost } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "That is not a full link — paste the post URL including https://." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "Only http(s) links are accepted." };
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const path = url.pathname.replace(/\/+$/, "");

  // TikTok — tiktok.com/@user/video/123
  if (host === "tiktok.com" || host === "m.tiktok.com") {
    const m = path.match(/^\/(@[^/]+)\/video\/(\d+)$/);
    if (m) {
      return {
        ok: true,
        post: { platform: "tiktok", postId: m[2], canonicalUrl: `https://www.tiktok.com/${m[1]}/video/${m[2]}` },
      };
    }
    return { ok: false, reason: "Paste the full TikTok video link (tiktok.com/@name/video/…)." };
  }
  if (host === "vm.tiktok.com" || host === "vt.tiktok.com") {
    return { ok: false, reason: "Short TikTok links can't be tracked — open the video and copy the full link." };
  }

  // Instagram — instagram.com/reel/ID or /p/ID
  if (host === "instagram.com") {
    const m = path.match(/^\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)$/);
    if (m) {
      return {
        ok: true,
        post: { platform: "instagram", postId: m[1], canonicalUrl: `https://www.instagram.com/reel/${m[1]}/` },
      };
    }
    return { ok: false, reason: "Paste an Instagram Reel link (instagram.com/reel/…)." };
  }

  // YouTube — youtube.com/shorts/ID, youtu.be/ID, youtube.com/watch?v=ID
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
    let id: string | null = null;
    if (host === "youtu.be") id = path.slice(1);
    else {
      const m = path.match(/^\/shorts\/([A-Za-z0-9_-]{6,})$/);
      if (m) id = m[1];
      else if (path === "/watch") id = url.searchParams.get("v");
    }
    if (id && /^[A-Za-z0-9_-]{6,}$/.test(id)) {
      return {
        ok: true,
        post: { platform: "youtube", postId: id, canonicalUrl: `https://www.youtube.com/shorts/${id}` },
      };
    }
    return { ok: false, reason: "Paste a YouTube Shorts link (youtube.com/shorts/…)." };
  }

  // X — x.com/user/status/123
  if (host === "x.com" || host === "twitter.com" || host === "mobile.twitter.com") {
    const m = path.match(/^\/([A-Za-z0-9_]+)\/status\/(\d+)/);
    if (m) {
      return {
        ok: true,
        post: { platform: "x", postId: m[2], canonicalUrl: `https://x.com/${m[1]}/status/${m[2]}` },
      };
    }
    return { ok: false, reason: "Paste a link to the post itself (x.com/name/status/…)." };
  }

  return { ok: false, reason: "Links from TikTok, Instagram, YouTube and X only." };
}
