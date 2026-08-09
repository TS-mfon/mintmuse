// mintmuse/backend/xProfileFetcher.mjs
// Free X/Twitter profile ingestion — NO paid API.
//
// Method 0 (Open Graph meta tags): displayName, bio, avatar. Zero auth.
// Method 1 (Jina Reader, https://r.jina.ai): follower/following counts + recent tweet text.
// Fallback: scrape exact `followers_count` from the embedded HTML JSON.

const JINA = (handle) => `https://r.jina.ai/https://x.com/${handle}`;

// ---------- Method 0: OG tags ----------
export async function getOgTags(handle, ua) {
  const res = await fetch(`https://x.com/${handle}`, {
    headers: { 'User-Agent': ua || 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
  });
  const html = await res.text();

  const meta = (prop) => {
    const a = html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'));
    const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i'));
    return (a || b)?.[1] ?? null;
  };

  // Exact count fallback (logged-out HTML sometimes embeds this JSON)
  const exact = html.match(/"followers_count":(\d+)/);

  return {
    displayName: meta('og:title'),
    bio: meta('og:description'),
    avatar: meta('og:image'),
    followersExact: exact ? Number(exact[1]) : null,
  };
}

// ---------- Method 1: Jina Reader ----------
export async function getJinaText(handle) {
  const res = await fetch(JINA(handle));
  if (!res.ok) throw new Error(`Jina ${res.status}`);
  return res.text();
}

// ---------- helpers ----------
export function normalize(raw) {
  const s = raw.replace(/,/g, '').replace(/\s/g, '');
  const n = parseFloat(s);
  if (/k/i.test(s)) return Math.round(n * 1e3);
  if (/m/i.test(s)) return Math.round(n * 1e6);
  if (/b/i.test(s)) return Math.round(n * 1e9);
  return Math.round(n);
}

export function parseCount(text, label) {
  const m = text.match(new RegExp(`([\\d.,]+\\s?[KkMmBb]?)\\s*${label}`, 'i'));
  return m ? normalize(m[1]) : null;
}

// ---------- combined ----------
export async function getXProfile(handle) {
  const [og, jina] = await Promise.all([
    getOgTags(handle).catch(() => ({})),
    getJinaText(handle).catch(() => ''),
  ]);

  const followers = og.followersExact ?? parseCount(jina, 'Followers');
  const following = parseCount(jina, 'Following');

  return {
    handle,
    displayName: og.displayName,
    bio: og.bio,
    avatar: og.avatar,
    followers,   // ← the number you asked for
    following,
    recentText: jina,
  };
}

// ---------- CLI test ----------
if (import.meta.url === `file://${process.argv[1]}`) {
  const h = process.argv[2] || 'vitalik';
  const p = await getXProfile(h);
  console.log(JSON.stringify(p, null, 2));
}
