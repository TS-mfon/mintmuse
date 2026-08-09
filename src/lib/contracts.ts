export const REGISTRY_ABI = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [{ name: "handle", type: "string" }],
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
] as const;
