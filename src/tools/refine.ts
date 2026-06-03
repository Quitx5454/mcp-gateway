// ── Tool: refine ───────────────────────────────────────────────────────────
// Refine — cleans raw blockchain transaction data, filters bots, returns
// structured output. Paid: 0.02 USDC per call on Base Mainnet.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { REGISTRY } from "../registry";
import { callPaidAgent } from "../x402";
import { runTool } from "../result";

const inputSchema = {
  data: z
    .array(z.record(z.string(), z.unknown()))
    .min(1)
    .describe(
      "Array of raw transaction rows. Column names are flexible and auto-detected (e.g. hash, from, to, value, timestamp).",
    ),
};

export function registerRefine(server: McpServer): void {
  server.registerTool(
    "refine",
    {
      title: "Refine — transaction cleaner",
      description:
        "Clean raw blockchain transaction data: detect and filter bot/spam transactions and return structured output " +
        "(summary stats, warnings, volume features, and separated clean_data / suspicious_data). " +
        "Paid endpoint — costs 0.02 USDC per call (x402 on Base Mainnet); the gateway pays automatically when a wallet is configured, " +
        "otherwise the x402 payment challenge is returned for the client to settle.",
      inputSchema,
    },
    async (args) => runTool(() => callPaidAgent(REGISTRY.refine.url, { data: args.data })),
  );
}
