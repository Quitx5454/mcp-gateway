# Distill MCP Gateway

A unified [Model Context Protocol](https://modelcontextprotocol.io) server that exposes all five live **Distill** stateless middleware agents (x402 / ERC-8004 on Base Mainnet) as MCP tools. Any MCP-compatible client — Claude Desktop, Daydreams, or your own — gets every Distill agent as a native tool through one endpoint.

> Part of [Distill](https://quitx5454.github.io/pulse) — *pure signal, no noise.*

## Tools

| Tool | Agent | Method | Price | Description |
|------|-------|--------|-------|-------------|
| `refine` | Refine | POST | 0.02 USDC | Clean raw blockchain transaction data, filter bots, return structured output |
| `forge` | Forge | POST | 0.02 USDC | Compile an ERC-8004 reputation proof (keccak-256 hash + IPFS + giveFeedback calldata) |
| `trace` | Trace | POST | 0.01 USDC | Normalize a raw agent execution log into structured steps + a `forge_ready` block |
| `shield` | Shield | POST | 0.005 USDC | Sanitize PII from an x402 request + issue an HMAC-SHA256 replay guard before signing |
| `pipeline_invoke` | Pipeline | POST | 0.03 USDC | Chain any combination of the agents in one async call (returns a `task_id`) |
| `pipeline_status` | Pipeline | GET | **free** | Poll a pipeline run's status and results by `task_id` |

All tools except `pipeline_status` are x402-protected on Base Mainnet (`eip155:8453`, USDC).

## Payment model

The gateway holds its own wallet (`PRIVATE_KEY`) and pays x402 challenges **automatically** via [`@x402/axios`](https://www.npmjs.com/package/@x402/axios) — same EVM exact-scheme client (viem + `@x402/evm`) the sibling Pipeline agent uses for downstream payments.

**402 is never swallowed.** If a challenge cannot be settled — no wallet configured (passthrough mode), insufficient funds, or facilitator rejection — the underlying x402 challenge is surfaced as an MCP tool error (`isError: true`) whose `structuredContent` carries the decoded `payment_required` payload. This lets a paying client framework (e.g. Daydreams [`@x402/mcp`](https://www.npmjs.com/package/@x402/mcp)) intercept the tool error and complete the payment itself.

## Transports

- **stdio** — for local / Claude Desktop use. Run with `--stdio` or `MCP_TRANSPORT=stdio`.
- **Streamable HTTP** — `POST /mcp` (supports SSE streaming) for remote use, with a free `GET /` health endpoint. This is the default (used by Railway). Runs **statelessly**: a fresh server + transport per request.

## Run

```bash
bun install

# Local stdio (Claude Desktop, etc.)
bun run start -- --stdio
# or: MCP_TRANSPORT=stdio bun run start

# HTTP (default) — listens on $PORT (default 3000)
bun run start
```

### Claude Desktop config

```json
{
  "mcpServers": {
    "distill": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/mcp-gateway/src/index.ts", "--stdio"],
      "env": { "PRIVATE_KEY": "0x..." }
    }
  }
}
```

## Seeding x402 Bazaar

`scripts/seed-bazaar.ts` calls each of the five invoke endpoints once with realistic data, paying with a seeder wallet. A settled payment through the CDP facilitator is what triggers indexing into the x402 Bazaar catalog.

```bash
SEEDER_PRIVATE_KEY=0x... bun run seed
```

> Costs real USDC on Base Mainnet (~0.085 USDC total). Run once.

## Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `PRIVATE_KEY` | for paid tools | Gateway wallet that pays x402 challenges. Absent → passthrough mode (402 challenges surfaced to the client). |
| `SEEDER_PRIVATE_KEY` | seed script only | Wallet used by `scripts/seed-bazaar.ts`. |
| `RPC_URL` | no | Base RPC (default `https://mainnet.base.org`). |
| `PORT` | no | HTTP port (default 3000). |
| `AGENT_TIMEOUT_MS` | no | Per-agent request timeout (default 60000). |
| `MCP_TRANSPORT` | no | Set to `stdio` to force stdio transport. |
| `REFINE_URL` / `FORGE_URL` / `SHIELD_URL` / `PIPELINE_URL` | no | Override agent base URLs (default: production). |

## Develop

```bash
bun run type-check   # tsc --noEmit, strict
bun run dev          # watch mode
```

## Layout

```
src/
  tools/        refine.ts forge.ts trace.ts shield.ts pipeline.ts
  registry.ts   agent URLs + config
  x402.ts       payment client (viem + @x402/evm) + agent transport (402 → Payment402Error)
  result.ts     maps agent results / payment failures → MCP tool results
  server.ts     McpServer setup, tool registration
  index.ts      entrypoint, transport binding (stdio + Streamable HTTP)
scripts/
  seed-bazaar.ts  one-time Bazaar seeding
```
