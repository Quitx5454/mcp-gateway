// ── Tool: forge ────────────────────────────────────────────────────────────
// Forge — compiles an ERC-8004 on-chain reputation proof: keccak-256 feedback
// hash, IPFS pin, and ABI-encoded giveFeedback() calldata. Paid: 0.02 USDC.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { REGISTRY } from "../registry";
import { callPaidAgent } from "../x402";
import { runTool } from "../result";

const inputSchema = {
  agent_id: z
    .union([z.string(), z.number()])
    .describe("Numeric ERC-8004 agent id receiving the feedback (e.g. \"6482\")."),
  task: z.string().describe("Short description of the task the feedback is about."),
  tx_hash: z.string().describe("Transaction hash of the paid interaction being attested."),
  score: z.number().min(0).max(100).describe("Quality score 0–100."),
  chain_id: z.number().optional().describe("Chain id (default 8453, Base Mainnet)."),
  response_latency_ms: z.number().optional().describe("Observed response latency in milliseconds."),
  usdc_paid: z.string().optional().describe("Amount paid in USDC base units (6 decimals), e.g. \"20000\"."),
  success: z.boolean().optional().describe("Whether the interaction succeeded."),
};

export function registerForge(server: McpServer): void {
  server.registerTool(
    "forge",
    {
      title: "Forge — ERC-8004 reputation proof",
      description:
        "Compile an ERC-8004 on-chain feedback payload in one call: build the canonical feedback document, its keccak-256 hash, " +
        "pin it to IPFS, and ABI-encode giveFeedback() calldata (ready_to_sign). Returns { feedback_hash, ipfs_uri, contract_payload, ready_to_sign }. " +
        "Paid endpoint — costs 0.02 USDC per call (x402 on Base Mainnet); the gateway pays automatically when a wallet is configured, " +
        "otherwise the x402 payment challenge is returned for the client to settle.",
      inputSchema,
    },
    async (args) =>
      runTool(() =>
        callPaidAgent(REGISTRY.forge.url, {
          agent_id: args.agent_id,
          task: args.task,
          tx_hash: args.tx_hash,
          score: args.score,
          ...(args.chain_id !== undefined ? { chain_id: args.chain_id } : {}),
          ...(args.response_latency_ms !== undefined ? { response_latency_ms: args.response_latency_ms } : {}),
          ...(args.usdc_paid !== undefined ? { usdc_paid: args.usdc_paid } : {}),
          ...(args.success !== undefined ? { success: args.success } : {}),
        }),
      ),
  );
}
