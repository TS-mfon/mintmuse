import { Concept, GenerateResult, XProfile } from "./types";
import { pollinationsTextJson, pollinationsImageUrl } from "./pollinations";

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

export async function generateConcept(profile: XProfile): Promise<GenerateResult> {
  const enabled = process.env.GENLAYER_ENABLED === "true";
  if (enabled) {
    const fromChain = await callGenLayer(profile);
    if (fromChain) return finalize(fromChain, "genlayer");
  }
  const concept = await fallbackGenerate(profile);
  return finalize(concept, "pollinations");
}

async function fallbackGenerate(profile: XProfile): Promise<Concept> {
  const model = process.env.POLLINATIONS_TEXT_MODEL || "openai-large";
  let concept = await pollinationsTextJson<Concept>(fallbackPrompt(profile), model);
  if (!concept?.ticker) {
    concept = await pollinationsTextJson<Concept>(
      fallbackPrompt(profile) + "\nIMPORTANT: respond with strictly valid JSON only.",
      model
    );
  }
  if (!concept?.ticker || !concept?.token_name) {
    throw new Error("AI failed to produce a valid concept");
  }
  return concept;
}

/**
 * Live on-chain call to the CreatorMuse contract on GenLayer StudioNet.
 *
 * The exact GenLayer JS SDK surface varies between releases, so this is left as a
 * documented stub: when GENLAYER_ENABLED=true but this returns null, the app
 * transparently uses the free Pollinations fallback and stays fully functional.
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
