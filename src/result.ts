// ── MCP tool-result helpers ───────────────────────────────────────────────
// Centralizes the mapping from agent results / payment failures to MCP tool
// results. This is the single place that guarantees a 402 is surfaced as a
// tool error carrying the payment challenge — never swallowed into a success.
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Payment402Error, AgentError } from "./x402";

function asStructured(data: unknown): Record<string, unknown> {
  return data && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : { result: data };
}

/** Successful tool result: pretty JSON text + structured content. */
export function ok(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: asStructured(data),
  };
}

/**
 * Runs a tool body and converts any failure into an MCP tool error. A
 * Payment402Error is surfaced with `isError: true` and the decoded x402
 * challenge in both the text content and structured content, so a paying MCP
 * client (e.g. Daydreams @x402/mcp) can intercept it and complete payment.
 */
export async function runTool(fn: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return ok(await fn());
  } catch (err) {
    if (err instanceof Payment402Error) {
      const payload = {
        error: "payment_required",
        status: 402,
        resource: err.resource,
        message: err.message,
        payment_required: err.challenge ?? null,
      };
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    }
    if (err instanceof AgentError) {
      const payload = { error: "agent_error", status: err.status ?? null, message: err.message };
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    }
    const payload = { error: "internal_error", message: (err as Error).message };
    return {
      isError: true,
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  }
}
