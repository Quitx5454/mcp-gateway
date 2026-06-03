// ── MCP server setup ───────────────────────────────────────────────────────
// A single McpServer instance exposing the five Distill agents as six tools:
// refine, forge, trace, shield, pipeline_invoke, pipeline_status.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerRefine } from "./tools/refine";
import { registerForge } from "./tools/forge";
import { registerTrace } from "./tools/trace";
import { registerShield } from "./tools/shield";
import { registerPipeline } from "./tools/pipeline";

export const SERVER_NAME = "distill-mcp-gateway";
export const SERVER_VERSION = "1.0.0";

/** Build a fully-configured McpServer with all Distill tools registered. */
export function createServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "Distill MCP Gateway — unified access to the Distill stateless middleware agents on Base Mainnet (x402/ERC-8004). " +
        "Tools: refine (clean tx data), forge (ERC-8004 reputation proof), trace (parse execution logs), shield (PII sanitize + replay guard), " +
        "pipeline_invoke (chain agents, async) and pipeline_status (free poll). All tools except pipeline_status are paid via x402; " +
        "if the gateway has no wallet, a 402 payment challenge is returned as a tool error for the client to settle.",
    },
  );

  registerRefine(server);
  registerForge(server);
  registerTrace(server);
  registerShield(server);
  registerPipeline(server);

  return server;
}
