import type { Abi, Hex } from "viem";

/** Minimal vault: owner can withdraw native deposits. */
export const SIMPLE_VAULT_ABI = [
  {
    type: "constructor",
    inputs: [{ name: "owner_", type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "deposit",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Withdrawn",
    inputs: [
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  { type: "receive", stateMutability: "payable" },
] as const satisfies Abi;

/**
 * Placeholder bytecode — replaced by Foundry build artifact in apps/web if present.
 * This is a minimal valid CREATE payload stub; real deploy uses contracts/out when available.
 * For demo intents without local forge, we still encode constructor args onto this marker.
 */
export const SIMPLE_VAULT_BYTECODE =
  "0x608060405234801561001057600080fd5b506040516101e83803806101e8833981810160405281019061003291906100a1565b80600081905550506100ce565b600080fd5b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600061007082610045565b9050919050565b61008081610065565b811461008b57600080fd5b50565b60008151905061009d81610077565b92915050565b6000602082840312156100b7576100b6610040565b5b60006100c58482850161008e565b91505092915050565b61010b806100dd6000396000f3fe6080604052600436106100385760003560e01c80632e1a7d4d146100445780638da5cb5b1461006d578063d0e30db0146100985761003f565b3661003f57005b600080fd5b34801561005057600080fd5b5061006b600480360381019061006691906100f5565b6100a2565b005b34801561007957600080fd5b506100826100e8565b60405161008f9190610131565b60405180910390f35b6100a06100ee565b005b60008054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161461012f576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610126906101ac565b60405180910390fd5b8060005473ffffffffffffffffffffffffffffffffffffffff166108fc619081150290604051600060405180830381858888f19350505050158015610177573d6000803e3d6000fd5b5050565b60005481565b565b6000813590506100f2816101cc565b92915050565b600060208284031215610111576101106101c7565b5b600061011f848285016100e3565b91505092915050565b61013181610065565b82525050565b600060208201905061014c6000830184610128565b92915050565b600082825260208201905092915050565b7f6e6f74206f776e65720000000000000000000000000000000000000000000000600082015250565b6000610196600983610152565b91506101a182610163565b602082019050919050565b600060208201905081810360008301526101c581610189565b9050919050565b600080fd5b6101d581610065565b81146101e057600080fd5b5056fea2646970667358221220aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa64736f6c63430008140033" as Hex;
