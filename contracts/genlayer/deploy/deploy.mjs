// deploy.mjs
// ─────────────────────────────────────────────────────────────────────
// Deploys MintMuse's CreatorMuse.py intelligent contract to GenLayer
// StudioNet using the genlayer-js SDK.
//
// Run with:
//   cd contracts/genlayer/deploy
//   NODE_PATH=~/.workbuddy/binaries/node/workspace/node_modules \
//   node deploy.mjs
//
// Required env (place in .env alongside this script):
//   PRIVATE_KEY      = 0x...   deployer wallet hex (must have gas on StudioNet)
//
// Optional env:
//   GENLAYER_RPC_URL = https://studio.genlayer.com/api
//   GENLAYER_CHAIN   = studionet  (default)
//   CONTRACT_FILE    = path to .py file (default ../CreatorMuse.py)
//   DRY_RUN          = 1         (validate without sending tx)
// ─────────────────────────────────────────────────────────────────────

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient, createAccount } from "genlayer-js";
import { studionet, localnet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Tiny .env loader (no extra deps) ──────────────────────────────────
function loadEnv() {
  try {
    const envPath = resolve(__dirname, ".env");
    const text = readFileSync(envPath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["'](.*)["']$/, "$1");
      }
    }
  } catch {
    /* .env is optional */
  }
}
loadEnv();

const PK = process.env.PRIVATE_KEY;
const RPC_URL = process.env.GENLAYER_RPC_URL || "https://studio.genlayer.com/api";
const CHAIN_NAME = process.env.GENLAYER_CHAIN || "studionet";
const DRY_RUN = process.env.DRY_RUN === "1";

if (!PK && !DRY_RUN) {
  console.error(
    "❌  PRIVATE_KEY missing.\n" +
      "    Create a .env file in this directory with PRIVATE_KEY=0x...\n" +
      "    Use a StudioNet-funded wallet (get one from https://studio.genlayer.com)."
  );
  process.exit(1);
}

// ─── Pick chain ─────────────────────────────────────────────────────────
const chain = CHAIN_NAME === "localnet" ? localnet : studionet;

// ─── Path to the .py contract ──────────────────────────────────────────
const contractFile = resolve(
  __dirname,
  process.env.CONTRACT_FILE || "../CreatorMuse.py"
);

async function main() {
  const code = readFileSync(contractFile);
  console.log(`\n📜  Contract: ${contractFile}  (${code.length} bytes)`);
  console.log(`🌐  Network:  ${CHAIN_NAME}  (RPC ${RPC_URL}, chainId ${chain.id})`);

  let account;
  if (PK) {
    account = createAccount(PK);
    console.log(`👤  Deployer: ${account.address}`);
  }

  const client = createClient({
    chain,
    ...(account ? { account } : {}),
  });

  if (DRY_RUN) {
    console.log("🧪  DRY_RUN — skipping broadcast.");
    console.log("✅  Local validation passed.");
    return;
  }

  console.log("🚀  Broadcasting deploy…");
  const txHash = await client.deployContract({
    code,
    args: [],
  });
  console.log(`     Tx: ${txHash}`);

  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    status: TransactionStatus.FINALIZED,
    retries: 300,
  });

  console.log(`     Status: ${receipt.statusName ?? receipt.status}`);
  // For both localnet AND studionet, the deployed address is in
  // `data.contract_address` (txDataDecoded.contractAddress is undefined here).
  const addr =
    receipt.data?.contract_address ??
    receipt.txDataDecoded?.contractAddress;

  if (!addr) {
    console.error("⚠️  Deployed but could not extract address. Receipt:");
    console.error(JSON.stringify(receipt, null, 2));
    process.exit(2);
  }

  console.log(`\n✅  CreatorMuse deployed at: ${addr}`);
  console.log(
    `\n👉  Add this to your mintmuse Vercel env:\n    GENLAYER_CONTRACT_ADDRESS=${addr}\n    NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS=${addr}`
  );
}

main().catch((e) => {
  console.error("\n❌  Deploy failed:", e?.shortMessage || e?.message || e);
  if (process.env.DEBUG) console.error(e);
  process.exit(1);
});
