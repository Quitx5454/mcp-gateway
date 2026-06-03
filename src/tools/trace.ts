// ── Tool: trace ────────────────────────────────────────────────────────────
// Trace — normalizes a raw agent execution log into structured steps + a
// forge_ready block (suggested ERC-8004 score & tags). Paid: 0.01 USDC.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { REGISTRY } from "../registry";
import { callPaidAgent } from "../x402";
import { runTool } from "../result";

const inputSchema = {
  log: z.string().min(1).describe("Raw agent execution log to parse (plaintext, JSON, OTel, LangChain, or OpenAI format)."),
  format: z
    .enum(["auto", "plaintext", "json", "opentelemetry", "langchain", "openai"])
    .optional()
    .describe("Log format hint. Default \"auto\" (auto-detect)."),
  session_id: z.string().optional().describe("Optional session id to thread the trace into a larger workflow."),
  agent_id: z.string().optional().describe("Optional numeric agent id to attribute the trace to."),
};

export function registerTrace(server: McpServer): void {
  server.registerTool(
    "trace",
    {
      title: "Trace — execution log normalizer",
      description:
        "Normalize a raw agent execution log into structured steps + a summary (durations, tokens, errors, retries, status) and emit a " +
        "forge_ready block (can_submit, suggested_score, suggested_tag1/2) suitable for feeding straight into Forge. " +
        "Supports plaintext, json, opentelemetry, langchain, and openai formats. " +
        "Paid endpoint — costs 0.01 USDC per call (x402 on Base Mainnet); the gateway pays automatically when a wallet is configured, " +
        "otherwise the x402 payment challenge is returned for the client to settle.",
      inputSchema,
    },
    async (args) =>
      runTool(() =>
        callPaidAgent(REGISTRY.trace.url, {
          log: args.log,
          ...(args.format !== undefined ? { format: args.format } : {}),
          ...(args.session_id !== undefined ? { session_id: args.session_id } : {}),
          ...(args.agent_id !== undefined ? { agent_id: args.agent_id } : {}),
        }),
      ),
  );
}
