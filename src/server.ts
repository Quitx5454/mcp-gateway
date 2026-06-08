// ── MCP server setup ───────────────────────────────────────────────────────
// A single McpServer instance exposing the three Distill agents as three tools:
// refine, trace, shield.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerRefine } from "./tools/refine";
import { registerTrace } from "./tools/trace";
import { registerShield } from "./tools/shield";

export const SERVER_NAME = "distill-mcp-gateway";
export const SERVER_VERSION = "1.0.0";

/** Build a fully-configured McpServer with all Distill tools registered. */
export function createServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "Distill MCP Gateway — unified access to the Distill stateless middleware agents on Base Mainnet (x402/ERC-8004). " +
        "Tools: refine (clean tx data), trace (parse execution logs), shield (PII sanitize + replay guard). All tools are paid via x402; " +
        "if the gateway has no wallet, a 402 payment challenge is returned as a tool error for the client to settle.",
    },
  );

  registerRefine(server);
  registerTrace(server);
  registerShield(server);

  return server;
}
