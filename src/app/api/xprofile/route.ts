import { NextRequest, NextResponse } from "next/server";

// In-memory cache (per serverless instance). Cheap protection against rate limits.
const cache = new Map<string, { ts: number; data: any }>();
const TTL = 1000 * 60 * 30;

/**
 * Fetches creator X data with NO paid API.
 *
 * Primary:  api.fxtwitter.com  -> free, no-auth profile JSON (followers, bio, avatar)
 * Fallback: x.com OG tags      -> name/bio/avatar when the API is unreachable
 * Best-effort: r.jina.ai reader -> recent-post text (can be rate-limited)
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("handle");
  const handle = raw?.replace(/^@/, "").trim();
  if (!handle) return NextResponse.json({ error: "missing handle" }, { status: 400 });

  const hit = cache.get(handle);
  if (hit && Date.now() - hit.ts < TTL) return NextResponse.json(hit.data);

  const data: any = {
    handle,
    displayName: null,
    bio: null,
    avatar: null,
    followers: null,
    following: null,
    recentText: "",
  };

  // 1) Primary: fxtwitter (free, no auth)
  try {
    const fxRes = await fetch(`https://api.fxtwitter.com/${handle}`, {
      headers: { "User-Agent": "MintMuse/1.0" },
      cache: "no-store",
    });
    if (fxRes.ok) {
      const fx = await fxRes.json();
      const u = fx?.user;
      if (u && fx.code === 200) {
        data.displayName = u.name ?? null;
        data.bio = u.description ?? null;
        data.avatar = u.avatar_url ?? null;
        data.followers = typeof u.followers === "number" ? u.followers : null;
        data.following = typeof u.following === "number" ? u.following : null;
        data.handle = u.screen_name ?? handle;
      }
    }
  } catch {
    // ignore, fall through to OG
  }

  // 2) Fallback: x.com OG tags (if fxtwitter missed something)
  if (!data.displayName || !data.bio || !data.avatar) {
    try {
      const ogRes = await fetch(`https://x.com/${handle}`, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
        cache: "no-store",
      });
      const html = await ogRes.text();
      const og = {
        displayName: meta(html, "og:title"),
        bio: meta(html, "og:description"),
        avatar: meta(html, "og:image"),
      };
      data.displayName = data.displayName ?? og.displayName;
      data.bio = data.bio ?? og.bio;
      data.avatar = data.avatar ?? og.avatar;
    } catch {
      // ignore
    }
  }

  // 3) Best-effort: recent posts via Jina reader (may be rate-limited)
  try {
    const jinaRes = await fetch(`https://r.jina.ai/https://x.com/${handle}`, {
      headers: { "User-Agent": "MintMuse/1.0" },
      cache: "no-store",
    });
    if (jinaRes.ok) {
      const jina = await jinaRes.text();
      if (jina && jina.length > 20) data.recentText = jina.slice(0, 4000);
      if (data.followers == null) data.followers = parseCount(jina, "Followers");
      if (data.following == null) data.following = parseCount(jina, "Following");
    }
  } catch {
    // ignore
  }

  cache.set(handle, { ts: Date.now(), data });
  return NextResponse.json(data);
}

function meta(html: string, prop: string): string | null {
  const a = html.match(
    new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i")
  );
  const b = html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, "i")
  );
  return (a || b)?.[1] ?? null;
}

function normalize(raw: string): number {
  const s = raw.replace(/,/g, "").replace(/\s/g, "");
  const n = parseFloat(s);
  if (/k/i.test(s)) return Math.round(n * 1e3);
  if (/m/i.test(s)) return Math.round(n * 1e6);
  if (/b/i.test(s)) return Math.round(n * 1e9);
  return Math.round(n);
}

function parseCount(text: string, label: string): number | null {
  if (!text) return null;
  const m = text.match(new RegExp(`([\\d.,]+\\s?[KkMmBb]?)\\s*${label}`, "i"));
  return m ? normalize(m[1]) : null;
}
