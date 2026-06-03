// ── Entrypoint — transport binding ─────────────────────────────────────────
// Two transports for the same McpServer:
//   • stdio   — for local/Claude Desktop use. Selected with `--stdio` or
//               MCP_TRANSPORT=stdio.
//   • HTTP    — Streamable HTTP (POST /mcp, supports SSE streaming) for remote
//               use, plus a free GET / health endpoint. This is the default
//               (used by Railway). Runs statelessly: a fresh server + transport
//               per request, matching Distill's stateless model.
import express, { type Request, type Response } from "express";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, SERVER_NAME, SERVER_VERSION } from "./server";

const useStdio = process.argv.includes("--stdio") || process.env.MCP_TRANSPORT === "stdio";

async function runStdio(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Logs go to stderr so they don't corrupt the stdio JSON-RPC stream.
  console.error(`[${SERVER_NAME}] stdio transport ready`);
}

function runHttp(): void {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const app = express();
  app.use(express.json({ limit: "8mb" }));

  // CORS — open, so browser-based MCP clients can reach the gateway.
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, mcp-session-id, mcp-protocol-version");
    res.header("Access-Control-Expose-Headers", "mcp-session-id");
    if (req.method === "OPTIONS") return res.status(200).end();
    next();
  });

  // Free health endpoint.
  const health = (_req: Request, res: Response) =>
    res.json({ status: "ok", service: SERVER_NAME, version: SERVER_VERSION, transport: "streamable-http" });
  app.get("/", health);
  app.get("/health", health);

  // Streamable HTTP MCP endpoint — stateless: new instances per request.
  app.post("/mcp", async (req: Request, res: Response) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error(`[${SERVER_NAME}] error handling /mcp request:`, err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  // Stateless mode does not support server-initiated streams or session deletes.
  const methodNotAllowed = (_req: Request, res: Response) =>
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed — gateway runs in stateless mode; use POST /mcp." },
      id: null,
    });
  app.get("/mcp", methodNotAllowed);
  app.delete("/mcp", methodNotAllowed);

  app.listen(port, () => {
    console.log(`[${SERVER_NAME}] v${SERVER_VERSION} listening on port ${port} (POST /mcp, health GET /)`);
  });
}

if (useStdio) {
  runStdio().catch((err) => {
    console.error(`[${SERVER_NAME}] fatal:`, err);
    process.exit(1);
  });
} else {
  runHttp();
}
