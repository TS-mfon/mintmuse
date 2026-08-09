import { NextRequest, NextResponse } from "next/server";

// In-memory cache (per serverless instance). Cheap protection against Jina rate limits.
const cache = new Map<string, { ts: number; data: any }>();
const TTL = 1000 * 60 * 30;

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
  const m = text.match(new RegExp(`([\\d.,]+\\s?[KkMmBb]?)\\s*${label}`, "i"));
  return m ? normalize(m[1]) : null;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("handle");
  const handle = raw?.replace(/^@/, "").trim();
  if (!handle) return NextResponse.json({ error: "missing handle" }, { status: 400 });

  const hit = cache.get(handle);
  if (hit && Date.now() - hit.ts < TTL) return NextResponse.json(hit.data);

  try {
    const ogRes = await fetch(`https://x.com/${handle}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
    });
    const html = await ogRes.text();
    const exact = html.match(/"followers_count":(\d+)/);
    const og = {
      displayName: meta(html, "og:title"),
      bio: meta(html, "og:description"),
      avatar: meta(html, "og:image"),
      followersExact: exact ? Number(exact[1]) : null,
    };

    const jinaRes = await fetch(`https://r.jina.ai/https://x.com/${handle}`);
    const jina = jinaRes.ok ? await jinaRes.text() : "";

    const data = {
      handle,
      displayName: og.displayName,
      bio: og.bio,
      avatar: og.avatar,
      followers: og.followersExact ?? parseCount(jina, "Followers"),
      following: parseCount(jina, "Following"),
      recentText: jina,
    };
    cache.set(handle, { ts: Date.now(), data });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
