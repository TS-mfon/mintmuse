export const REGISTRY_ABI = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [
      { name: "handle", type: "string" },
      { name: "expiresAt", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "addressToHandle",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "handleToAddress",
    stateMutability: "view",
    inputs: [{ name: "", type: "string" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "normalizeHandle",
    stateMutability: "pure",
    inputs: [{ name: "handle", type: "string" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

export const FACTORY_ABI = [
  {
    type: "function",
    name: "createCoin",
    stateMutability: "nonpayable",
    inputs: [
      { name: "handle", type: "string" },
      { name: "name_", type: "string" },
      { name: "symbol_", type: "string" },
      { name: "artUri_", type: "string" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "event",
    name: "CoinCreated",
    inputs: [
      { name: "creator", type: "address", indexed: true },
      { name: "handle", type: "string", indexed: false },
      { name: "coin", type: "address", indexed: false },
      { name: "name", type: "string", indexed: false },
      { name: "symbol", type: "string", indexed: false },
    ],
    anonymous: false,
  },
] as const;
