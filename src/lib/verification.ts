import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { keccak256, encodeAbiParameters, parseAbiParameters, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export type ChallengePayload = {
  handle: string;
  wallet: Address;
  code: string;
  nonce: `0x${string}`;
  expiresAt: number;
};

function secret() {
  const value = process.env.VERIFICATION_SECRET;
  if (!value) throw new Error("VERIFICATION_SECRET is not configured");
  return value;
}

export function signChallenge(payload: ChallengePayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secret()).update(encoded).digest("base64url");
  return `${encoded}.${mac}`;
}

export function readChallenge(token: string): ChallengePayload {
  const [encoded, mac] = token.split(".");
  if (!encoded || !mac) throw new Error("invalid challenge");
  const expected = createHmac("sha256", secret()).update(encoded).digest("base64url");
  if (mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) {
    throw new Error("invalid challenge signature");
  }
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as ChallengePayload;
  if (payload.expiresAt < Math.floor(Date.now() / 1000)) throw new Error("challenge expired");
  return payload;
}

export async function signAttestation(payload: ChallengePayload) {
  const key = process.env.VERIFIER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!key) throw new Error("VERIFIER_PRIVATE_KEY is not configured");
  const account = privateKeyToAccount(key);
  const digest = keccak256(
    encodeAbiParameters(parseAbiParameters("address, uint256, address, bytes32, bytes32, uint256"), [
      process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as Address,
      BigInt(process.env.NEXT_PUBLIC_XLAYER_CHAIN_ID || "1952"),
      payload.wallet,
      keccak256(new TextEncoder().encode(payload.handle)),
      payload.nonce,
      BigInt(payload.expiresAt),
    ])
  );
  return account.signMessage({ message: { raw: digest } });
}

export function newChallenge(handle: string, wallet: Address): ChallengePayload {
  const normalized = handle.replace(/^@/, "").trim().toLowerCase();
  const code = `MINTMUSE-${randomBytes(3).toString("hex").toUpperCase()}`;
  const nonce = `0x${randomBytes(32).toString("hex")}` as `0x${string}`;
  return { handle: normalized, wallet, code, nonce, expiresAt: Math.floor(Date.now() / 1000) + 15 * 60 };
}
