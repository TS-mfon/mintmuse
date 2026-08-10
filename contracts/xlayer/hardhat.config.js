require("dotenv").config({ path: ".env.build" });
require("dotenv").config(); // fallback to .env if present
require("@nomicfoundation/hardhat-ethers");
require("hardhat/config");

/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  paths: {
    sources: "./contracts",
    artifacts: "./artifacts",
    cache: "./cache",
  },

  networks: {
    // X Layer MAINNET (chain id 196) — for `npm run deploy`
    xlayer: {
      url: process.env.XLAYER_RPC || "https://rpc.xlayer.tech",
      chainId: Number(process.env.XLAYER_CHAIN_ID || 196),
      accounts: process.env.DEPLOYER_PK ? [process.env.DEPLOYER_PK] : [],
    },
    // X Layer TESTNET (chain id 1952) — for `npm run deploy:testnet`
    xlayerTestnet: {
      url: process.env.XLAYER_TESTNET_RPC || "https://testrpc.xlayer.tech",
      chainId: Number(process.env.XLAYER_TESTNET_CHAIN_ID || 1952),
      accounts: process.env.DEPLOYER_PK ? [process.env.DEPLOYER_PK] : [],
    },
  },
};
