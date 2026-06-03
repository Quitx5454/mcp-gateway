// ── Agent registry ────────────────────────────────────────────────────────
// Static configuration for the five live Distill agents on Base Mainnet. The
// MCP gateway turns each invoke endpoint into a tool; pipeline additionally
// exposes a free GET status endpoint. URLs are overridable via env so the same
// build can point at staging without code changes.

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
const FORGE_BASE = process.env.FORGE_URL ?? "https://forge-agent-production.up.railway.app";
const SHIELD_BASE = process.env.SHIELD_URL ?? "https://shield-agent-production.up.railway.app";
const PIPELINE_BASE = process.env.PIPELINE_URL ?? "https://pipeline-agent-production-7736.up.railway.app";

export const REGISTRY = {
  refine: {
    label: "Refine",
    url: `${REFINE_BASE}/entrypoints/process/invoke`,
    price: "$0.02",
    maxAmountRequired: "20000",
  },
  forge: {
    label: "Forge",
    url: `${FORGE_BASE}/entrypoints/forge/invoke`,
    price: "$0.02",
    maxAmountRequired: "20000",
  },
  trace: {
    label: "Trace",
    url: `${FORGE_BASE}/entrypoints/trace/invoke`,
    price: "$0.01",
    maxAmountRequired: "10000",
  },
  shield: {
    label: "Shield",
    url: `${SHIELD_BASE}/entrypoints/shield/invoke`,
    price: "$0.005",
    maxAmountRequired: "5000",
  },
  pipeline: {
    label: "Pipeline",
    url: `${PIPELINE_BASE}/entrypoints/pipeline/invoke`,
    price: "$0.03",
    maxAmountRequired: "30000",
  },
} as const satisfies Record<string, AgentEndpoint>;

/** Base URL of the pipeline agent, used to build the free GET status URL. */
export const PIPELINE_STATUS_URL = (taskId: string): string =>
  `${PIPELINE_BASE}/entrypoints/pipeline/status/${encodeURIComponent(taskId)}`;
