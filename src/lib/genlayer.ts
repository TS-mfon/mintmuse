import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { createHash } from "node:crypto";
import { Concept, GenerateResult, XProfile } from "./types";
import { pollinationsImageUrl } from "./pollinations";

const GENLAYER_RPC = process.env.GENLAYER_RPC || "https://studio.genlayer.com/api";
const GENLAYER_CONTRACT = process.env.GENLAYER_CONTRACT_ADDRESS as `0x${string}` | undefined;

const FAILED_CONSENSUS_RESULTS = new Set([
  "TIMEOUT",
  "DETERMINISTIC_VIOLATION",
  "NO_MAJORITY",
  "MAJORITY_DISAGREE",
  "FAILURE",
]);

export class GenLayerGenerationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly transactionHash?: string,
    readonly retryable = true,
  ) {
    super(message);
    this.name = "GenLayerGenerationError";
  }
}

function mapGenLayerError(cause: unknown, transactionHash?: string): GenLayerGenerationError {
  if (cause instanceof GenLayerGenerationError) return cause;
  const message = cause instanceof Error ? cause.message : String(cause || "");
  if (/rate limit|too many requests|429/i.test(message)) {
    return new GenLayerGenerationError("GenLayer is rate-limited right now. Wait a moment, then retry once.", "genlayer_rate_limited", transactionHash);
  }
  if (/timeout|timed out/i.test(message)) {
    return new GenLayerGenerationError("GenLayer consensus timed out. No concept was stored and MintMuse will not resubmit automatically; retry once when ready.", "genlayer_timeout", transactionHash);
  }
  return new GenLayerGenerationError("GenLayer could not complete consensus. No automatic retry was sent; review the transaction and retry once.", "genlayer_consensus_failed", transactionHash);
}

function validateConcept(value: unknown): Concept {
  const concept = value as Partial<Concept>;
  const tokenomics = concept?.tokenomics as Partial<Concept["tokenomics"]> | undefined;
  const ticker = String(concept?.ticker || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const creator = Number(tokenomics?.creator_allocation_pct);
  if (!concept?.token_name || ticker.length < 3 || ticker.length > 5 || !concept.narrative || !concept.art_prompt) {
    throw new Error("GenLayer returned an invalid concept");
  }
  if (Number(tokenomics?.total_supply) !== 1_000_000_000 || creator < 2 || creator > 10) {
    throw new Error("GenLayer returned unsupported tokenomics");
  }
  return {
    token_name: String(concept.token_name).slice(0, 28),
    ticker,
    narrative: String(concept.narrative),
    art_prompt: String(concept.art_prompt),
    tokenomics: {
      total_supply: 1_000_000_000,
      creator_allocation_pct: creator,
      community_allocation_pct: 100 - creator,
      initial_price_eth: 0.000001,
      curve: "bonding",
    },
  };
}

export async function generateConcept(profile: XProfile): Promise<GenerateResult> {
  const platformPrivateKey = process.env.GENLAYER_PRIVATE_KEY;
  if (process.env.GENLAYER_ENABLED !== "true" || !GENLAYER_CONTRACT || !platformPrivateKey) {
    throw new Error("The MintMuse platform wallet or GenLayer contract is not configured.");
  }

  const client = createClient({
    chain: studionet,
    endpoint: GENLAYER_RPC,
    account: createAccount(platformPrivateKey as `0x${string}`),
  });
  const contractRequestId = createHash("sha256")
    .update(JSON.stringify({
      handle: profile.handle.toLowerCase(),
      displayName: profile.displayName || "",
      bio: profile.bio || "",
      followers: profile.followers || 0,
      following: profile.following || 0,
      recentText: (profile.recentText || "").slice(0, 2000),
    }))
    .digest("hex");
  let existing: unknown;
  try {
    existing = await client.readContract({ address: GENLAYER_CONTRACT, functionName: "get_concept", args: [contractRequestId] });
  } catch (cause) {
    throw mapGenLayerError(cause);
  }
  if (typeof existing === "string" && existing.trim()) {
    const concept = validateConcept(JSON.parse(existing));
    return {
      concept,
      artUrl: pollinationsImageUrl(concept.art_prompt, process.env.POLLINATIONS_IMAGE_MODEL || "flux"),
      source: "genlayer",
      requestId: contractRequestId,
    };
  }
  let hash: `0x${string}` | undefined;
  try {
    const transactionHash = await client.writeContract({
      address: GENLAYER_CONTRACT,
      functionName: "generate",
      args: [
        contractRequestId,
        profile.handle,
        profile.displayName || profile.handle,
        profile.bio || "",
        Math.trunc(profile.followers || 0),
        (profile.recentText || "").slice(0, 800),
      ],
      value: 0n,
      consensusMaxRotations: 3,
    });
    hash = transactionHash;
    const receipt = await client.waitForTransactionReceipt({
      hash: transactionHash,
      status: TransactionStatus.FINALIZED,
      retries: 120,
      interval: 2000,
    });
    const resultName = String(receipt.resultName || "").toUpperCase();
    if (
      receipt.statusName !== TransactionStatus.ACCEPTED &&
      receipt.statusName !== TransactionStatus.FINALIZED
    ) {
      throw new GenLayerGenerationError(`GenLayer transaction ended with status ${receipt.statusName || receipt.status}.`, "genlayer_transaction_failed", transactionHash);
    }
    if (FAILED_CONSENSUS_RESULTS.has(resultName)) {
      throw new GenLayerGenerationError(
        resultName === "TIMEOUT"
          ? "GenLayer consensus timed out. No concept was stored and MintMuse will not resubmit automatically; retry once when ready."
          : `GenLayer consensus rejected the result (${resultName}). No automatic retry was sent.`,
        resultName === "TIMEOUT" ? "genlayer_timeout" : "genlayer_consensus_rejected",
        transactionHash,
      );
    }

    const raw = await client.readContract({ address: GENLAYER_CONTRACT, functionName: "get_concept", args: [contractRequestId] });
    if (typeof raw !== "string" || !raw.trim()) {
      throw new GenLayerGenerationError("GenLayer finalized without storing a concept. No automatic retry was sent; retry once.", "genlayer_empty_result", transactionHash);
    }
    const concept = validateConcept(JSON.parse(raw));
    return {
      concept,
      artUrl: pollinationsImageUrl(concept.art_prompt, process.env.POLLINATIONS_IMAGE_MODEL || "flux"),
      source: "genlayer",
      requestId: contractRequestId,
    };
  } catch (cause) {
    throw mapGenLayerError(cause, hash);
  }
}
