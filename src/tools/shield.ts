// ── Tool: shield ───────────────────────────────────────────────────────────
// Shield — sanitizes PII from an x402 request and issues an HMAC-SHA256 replay
// guard BEFORE the payment is signed. payment_requirements is passed through
// untouched. Paid: 0.005 USDC.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { REGISTRY } from "../registry";
import { callPaidAgent } from "../x402";
import { runTool } from "../result";

const inputSchema = {
  request: z
    .object({
      url: z.string().describe("Request URL (query params are scanned for PII)."),
      description: z.string().optional().describe("Free-text description (scanned for PII)."),
      metadata: z.record(z.string(), z.unknown()).optional().describe("Arbitrary metadata object."),
    })
    .describe("The outgoing request whose URL/description/metadata should be sanitized."),
  payment_requirements: z
    .object({
      scheme: z.string(),
      network: z.string(),
      maxAmountRequired: z.string(),
      asset: z.string(),
      payTo: z.string(),
    })
    .describe("x402 payment requirements — passed through untouched (Shield never modifies these)."),
};

export function registerShield(server: McpServer): void {
  server.registerTool(
    "shield",
    {
      title: "Shield — x402 pre-payment PII sanitizer",
      description:
        "Strip PII (emails, API keys, wallet addresses, IPs, JWTs, phone numbers, company names) from a request's URL query params, " +
        "description, and metadata, and issue a single-use HMAC-SHA256 replay-guard token — all BEFORE the x402 payment is signed " +
        "(running it after would break the EIP-712 signature). Returns { sanitized_request, replay_guard, payment_requirements, shield_version }. " +
        "payment_requirements is returned untouched. Paid endpoint — costs 0.005 USDC per call (x402 on Base Mainnet); the gateway pays " +
        "automatically when a wallet is configured, otherwise the x402 payment challenge is returned for the client to settle.",
      inputSchema,
    },
    async (args) =>
      runTool(() =>
        callPaidAgent(REGISTRY.shield.url, {
          request: args.request,
          payment_requirements: args.payment_requirements,
        }),
      ),
  );
}
