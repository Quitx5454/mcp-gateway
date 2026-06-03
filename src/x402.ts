// ── x402 payment client + agent transport ─────────────────────────────────
// Builds an axios instance that pays for x402-protected endpoints using the
// gateway's own wallet (PRIVATE_KEY), mirroring the proven outbound client used
// by pipeline-agent (viem + @x402/evm exact scheme). Two call helpers:
//
//   callPaidAgent(url, body)  — POSTs with automatic x402 payment.
//   callFreeAgent(url)        — GETs a free endpoint (pipeline status).
//
// CRITICAL: a 402 is never swallowed. If payment cannot be completed (no key,
// insufficient funds, settlement rejected) the underlying 402 challenge is
// surfaced as a Payment402Error carrying the decoded PAYMENT-REQUIRED payload,
// so an MCP client framework (e.g. Daydreams @x402/mcp) can intercept and pay.
import axios, { type AxiosInstance, AxiosError } from "axios";
import { createPublicClient, http as viemHttp } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { toClientEvmSigner } from "@x402/evm";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { wrapAxiosWithPayment, x402Client } from "@x402/axios";

const RPC_URL = process.env.RPC_URL ?? "https://mainnet.base.org";
const TIMEOUT_MS = parseInt(process.env.AGENT_TIMEOUT_MS ?? "60000", 10);

/** Raised when an x402 challenge could not be satisfied and must reach the client. */
export class Payment402Error extends Error {
  readonly challenge: unknown;
  readonly resource: string;
  constructor(resource: string, challenge: unknown, detail?: string) {
    super(`Payment required (402) for ${resource}${detail ? `: ${detail}` : ""}`);
    this.name = "Payment402Error";
    this.resource = resource;
    this.challenge = challenge;
  }
}

/** Raised for any non-402 failure talking to an agent. */
export class AgentError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "AgentError";
    this.status = status;
  }
}

// ── Lazy singleton payment-wrapped axios ──────────────────────────────────
// Created on first paid call so the server boots (and serves health) even when
// PRIVATE_KEY is absent. When PRIVATE_KEY is missing we fall back to a plain
// axios that treats 402 as a non-throwing status, surfacing the challenge.
let paidApi: AxiosInstance | null = null;

function buildPaidApi(): AxiosInstance {
  const raw = process.env.PRIVATE_KEY;
  if (!raw) {
    // Passthrough mode: no wallet — accept the 402 so we can read + surface the
    // challenge instead of letting axios throw an opaque error.
    return axios.create({ timeout: TIMEOUT_MS, validateStatus: (s) => s === 402 || (s >= 200 && s < 300) });
  }
  const pk = (raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`;
  const account = privateKeyToAccount(pk);
  const publicClient = createPublicClient({ chain: base, transport: viemHttp(RPC_URL) });
  const signer = toClientEvmSigner(
    {
      address: account.address,
      signTypedData: (message) => account.signTypedData(message as never),
    },
    publicClient,
  );
  const client = new x402Client();
  registerExactEvmScheme(client, { signer });
  // Default validateStatus left intact: the payment interceptor needs the
  // initial 402 to reject so it can pay and retry.
  return wrapAxiosWithPayment(axios.create({ timeout: TIMEOUT_MS }), client);
}

function getPaidApi(): AxiosInstance {
  if (!paidApi) paidApi = buildPaidApi();
  return paidApi;
}

/** Decode the base64 PAYMENT-REQUIRED header into the full challenge object. */
function decodeChallengeHeader(headers: Record<string, unknown>): unknown | undefined {
  const raw = (headers["payment-required"] ?? headers["PAYMENT-REQUIRED"]) as string | undefined;
  if (!raw || typeof raw !== "string") return undefined;
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
  } catch {
    return undefined;
  }
}

/**
 * Strip the Lucid HTTP wrapper ({ run_id, status, output: <DistillResponse> })
 * so callers see the Distill Standard Envelope. Pipeline (pure Express) returns
 * a flat object and is passed through unchanged.
 */
function unwrapLucid(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const obj = body as Record<string, unknown>;
  const inner = obj.output;
  if (inner && typeof inner === "object" && "distill_version" in (inner as Record<string, unknown>)) {
    return inner;
  }
  return body;
}

/** POST to an x402-protected agent, paying automatically. Throws Payment402Error
 *  if the challenge cannot be satisfied, AgentError for any other failure. */
export async function callPaidAgent(url: string, body: unknown): Promise<unknown> {
  const api = getPaidApi();
  try {
    const res = await api.post(url, body, { headers: { "Content-Type": "application/json" } });
    if (res.status === 402) {
      // Passthrough mode (no wallet): surface the challenge.
      const challenge = decodeChallengeHeader(res.headers as Record<string, unknown>) ?? res.data;
      throw new Payment402Error(url, challenge, "gateway has no wallet configured (passthrough)");
    }
    return unwrapLucid(res.data);
  } catch (err) {
    if (err instanceof Payment402Error) throw err;
    if (err instanceof AxiosError) {
      const status = err.response?.status;
      if (status === 402) {
        const challenge =
          decodeChallengeHeader((err.response?.headers ?? {}) as Record<string, unknown>) ??
          err.response?.data;
        throw new Payment402Error(url, challenge, "payment could not be settled");
      }
      const detail =
        typeof err.response?.data === "string"
          ? err.response.data.slice(0, 500)
          : JSON.stringify(err.response?.data ?? {}).slice(0, 500);
      throw new AgentError(`agent returned HTTP ${status ?? "?"}${detail ? `: ${detail}` : ""}`, status);
    }
    // Payment-payload / signing / settlement errors from the x402 wrapper arrive
    // as plain Errors with no response — treat as a payment failure.
    throw new Payment402Error(url, undefined, (err as Error).message);
  }
}

/** GET a free (unpaywalled) endpoint — used by pipeline_status. */
export async function callFreeAgent(url: string): Promise<unknown> {
  try {
    const res = await axios.get(url, { timeout: TIMEOUT_MS, validateStatus: () => true });
    if (res.status >= 400) {
      const detail =
        typeof res.data === "string" ? res.data.slice(0, 500) : JSON.stringify(res.data ?? {}).slice(0, 500);
      throw new AgentError(`status endpoint returned HTTP ${res.status}${detail ? `: ${detail}` : ""}`, res.status);
    }
    return res.data;
  } catch (err) {
    if (err instanceof AgentError) throw err;
    throw new AgentError(`status request failed: ${(err as Error).message}`);
  }
}
