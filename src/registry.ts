// ── Agent registry ────────────────────────────────────────────────────────
// Static configuration for the three live Distill agents on Base Mainnet
// (Refine, Shield, Trace). The MCP gateway turns each invoke endpoint into a
// tool. URLs are overridable via env so the same build can point at staging
// without code changes.

export const NETWORK = "eip155:8453"; // Base Mainnet
export const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export interface AgentEndpoint {
  /** Human label used in logs and the seed script. */
  label: string;
  /** Full invoke URL. */
  url: string;
  /** Price as advertised by the agent (informational; the facilitator enforces). */
  price: string;
  /** maxAmountRequired in USDC base units (6 decimals) — informational. */
  maxAmountRequired: string;
}

const REFINE_BASE = process.env.REFINE_URL ?? "https://distill-agent-production.up.railway.app";
// Trace is served from the (kept) forge-agent deployment; FORGE_URL is still
// accepted as a fallback for backward compatibility with existing env config.
const TRACE_BASE = process.env.TRACE_URL ?? process.env.FORGE_URL ?? "https://trace-agent-production.up.railway.app";
const SHIELD_BASE = process.env.SHIELD_URL ?? "https://shield-agent-v2-production.up.railway.app";

export const REGISTRY = {
  refine: {
    label: "Refine",
    url: `${REFINE_BASE}/entrypoints/process/invoke`,
    price: "$0.02",
    maxAmountRequired: "20000",
  },
  trace: {
    label: "Trace",
    url: `${TRACE_BASE}/entrypoints/trace/invoke`,
    price: "$0.01",
    maxAmountRequired: "10000",
  },
  shield: {
    label: "Shield",
    url: `${SHIELD_BASE}/entrypoints/shield/invoke`,
    price: "$0.005",
    maxAmountRequired: "5000",
  },
} as const satisfies Record<string, AgentEndpoint>;
