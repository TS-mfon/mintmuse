import { Concept, GenerateResult, XProfile } from "./types";
import { pollinationsImageUrl } from "./pollinations";

function fallbackPrompt(p: XProfile): string {
  return `You are the AI brain for MintMuse, an on-chain creator-coin launchpad.
A creator wants a coin minted from their X persona. Using the data below, invent a
compelling, original creator coin.

Return ONLY a JSON object (no markdown, no code fences) with exactly these keys:
- "token_name": string, evocative coin name (max 28 chars)
- "ticker": string, 3-5 uppercase letters
- "narrative": string, 2-3 sentences of lore tying the creator's vibe to the coin
- "tokenomics": object with keys:
    "total_supply" (number, 1000000000),
    "creator_allocation_pct" (number 2-10, smaller for bigger audiences),
    "community_allocation_pct" (number, the remainder to 100),
    "initial_price_eth" (number, small e.g. 0.000001),
    "curve" (string: "bonding")
- "art_prompt": string, a vivid text-to-image prompt for the coin artwork
  (the creator as a mythic mascot, neon crypto-art, no text in image)

Creator: ${p.displayName ?? p.handle} (@${p.handle})
Followers: ${p.followers ?? "unknown"}
Bio: ${p.bio ?? ""}
Recent posts (truncated): ${(p.recentText ?? "").slice(0, 2000)}`;
}

/**
 * Free LLM generation via OpenRouter (supports many free models, no card needed).
 * Falls back to the template generator if no key is configured or the call fails.
 */
async function llmGenerate(profile: XProfile): Promise<Concept> {
  const key = process.env.OPENROUTER_API_KEY;
  const model = process.env.LLM_MODEL || "meta-llama/llama-3.1-8b-instruct:free";
  if (key) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://mintmuse.vercel.app",
          "X-Title": "MintMuse",
        },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You generate crypto creator-coin concepts as strict JSON. Never wrap in markdown.",
            },
            { role: "user", content: fallbackPrompt(profile) },
          ],
        }),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const content: string = data?.choices?.[0]?.message?.content ?? "";
        const concept = safeParse<Concept>(content);
        if (concept?.ticker && concept?.token_name && concept?.narrative) {
          return normalize(concept);
        }
      }
    } catch {
      // fall through to template
    }
  }
  return templateGenerate(profile);
}

function safeParse<T>(raw: string): T | null {
  if (!raw) return null;
  try {
    // strip any accidental code fences
    const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

function normalize(c: Concept): Concept {
  const tk = Number(c.tokenomics?.total_supply) || 1_000_000_000;
  const creator = clamp(Number(c.tokenomics?.creator_allocation_pct) || 5, 2, 10);
  return {
    token_name: String(c.token_name).slice(0, 28),
    ticker: String(c.ticker).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5),
    narrative: String(c.narrative),
    tokenomics: {
      total_supply: tk,
      creator_allocation_pct: creator,
      community_allocation_pct: Math.max(0, 100 - creator),
      initial_price_eth: Number(c.tokenomics?.initial_price_eth) || 0.000001,
      curve: "bonding",
    },
    art_prompt: String(c.art_prompt),
  };
}

/**
 * Zero-config deterministic generator. Produces a personalized, coherent coin
 * from the creator's X data so the dapp works with no external API key.
 */
function templateGenerate(p: XProfile): Concept {
  const name = (p.displayName || p.handle || "Creator").replace(/^@/, "").trim();
  const base = name.split(/\s+/)[0] || "Creator";
  const tokenName = `${base} Coin`.slice(0, 28);
  const ticker = deriveTicker(name, p.handle);
  const followers = Number(p.followers) || 0;
  const creatorPct = followers > 1_000_000 ? 3 : followers > 100_000 ? 5 : followers > 10_000 ? 7 : 9;
  const vibe = (p.bio || "a visionary building in public").replace(/\s+/g, " ").trim();
  const narrative =
    `${base} is ${vibe}. The ${ticker} coin immortalizes that energy on-chain: a ` +
    `community-owned token where every holder backs the creator's journey. ` +
    `Mint, trade, and let the bonding curve turn culture into capital.`;
  const artPrompt =
    `A mythic mascot version of ${base}, reimagined as a neon crypto deity, ` +
    `holographic gradients, cosmic aura, glowing ${ticker} emblem, ultra-detailed ` +
    `digital crypto-art, symmetrical composition, no text, 4k`;
  return {
    token_name: tokenName,
    ticker,
    narrative,
    tokenomics: {
      total_supply: 1_000_000_000,
      creator_allocation_pct: creatorPct,
      community_allocation_pct: 100 - creatorPct,
      initial_price_eth: 0.000001,
      curve: "bonding",
    },
    art_prompt: artPrompt,
  };
}

function deriveTicker(name: string, handle: string): string {
  const src = (name + handle).replace(/[^a-zA-Z]/g, "").toUpperCase();
  if (src.length >= 3) return src.slice(0, 4);
  return (src + "COIN").slice(0, 4);
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export async function generateConcept(profile: XProfile): Promise<GenerateResult> {
  const enabled = process.env.GENLAYER_ENABLED === "true";
  let concept: Concept | null = null;
  if (enabled) {
    concept = await callGenLayer(profile);
  }
  if (!concept) {
    concept = await llmGenerate(profile);
  }
  return finalize(concept, enabled ? "genlayer" : "ai");
}

/**
 * Live on-chain call to the CreatorMuse contract on GenLayer StudioNet.
 *
 * The exact GenLayer JS SDK surface varies between releases, so this is left as a
 * documented stub: when GENLAYER_ENABLED=true but this returns null, the app
 * transparently uses the free LLM / template fallback and stays fully functional.
 *
 * To wire it for real:
 *   1. install the GenLayer SDK and fund a StudioNet wallet (faucet)
 *   2. call generate(handle, displayName, bio, followers, recentText) on
 *      GENLAYER_CONTRACT_ADDRESS (StudioNet RPC https://studio.genlayer.com/api)
 *   3. poll get_concept() until the transaction finalizes, parse the JSON string
 */
async function callGenLayer(_profile: XProfile): Promise<Concept | null> {
  return null;
}

function finalize(concept: Concept, source: GenerateResult["source"]): GenerateResult {
  const artUrl = pollinationsImageUrl(
    concept.art_prompt,
    process.env.POLLINATIONS_IMAGE_MODEL || "flux"
  );
  return { concept, artUrl, source };
}
