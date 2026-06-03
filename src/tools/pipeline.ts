// ── Tools: pipeline_invoke + pipeline_status ───────────────────────────────
// Pipeline — async Mediator Gateway that chains any combination of the four
// Distill agents in one call. invoke is paid (0.03 USDC) and returns a task_id
// immediately; status is free and polls the result.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { REGISTRY, PIPELINE_STATUS_URL } from "../registry";
import { callPaidAgent, callFreeAgent } from "../x402";
import { runTool } from "../result";

const invokeSchema = {
  pipeline: z
    .array(z.enum(["refine", "forge", "trace", "shield"]))
    .min(1)
    .describe("Ordered list of agents to chain. The output of each step is auto-routed into the next (e.g. [\"trace\",\"forge\"])."),
  payload: z
    .record(z.string(), z.unknown())
    .describe("Initial input object for the first agent in the pipeline."),
  session_id: z.string().optional().describe("Optional session id threaded across the whole chain."),
};

const statusSchema = {
  task_id: z.string().describe("The task_id returned by pipeline_invoke."),
};

export function registerPipeline(server: McpServer): void {
  server.registerTool(
    "pipeline_invoke",
    {
      title: "Pipeline — chain agents (async)",
      description:
        "Chain any combination of the Distill agents (refine, forge, trace, shield) in a single call; output→input routing is handled " +
        "automatically and downstream agents are paid internally by the pipeline's own wallet. Runs ASYNCHRONOUSLY: returns " +
        "{ task_id, status: \"queued\", session_id } immediately — then poll pipeline_status with the task_id for results. " +
        "Paid endpoint — costs 0.03 USDC per call (x402 on Base Mainnet); the gateway pays automatically when a wallet is configured, " +
        "otherwise the x402 payment challenge is returned for the client to settle.",
      inputSchema: invokeSchema,
    },
    async (args) =>
      runTool(() =>
        callPaidAgent(REGISTRY.pipeline.url, {
          pipeline: args.pipeline,
          payload: args.payload,
          ...(args.session_id !== undefined ? { session_id: args.session_id } : {}),
        }),
      ),
  );

  server.registerTool(
    "pipeline_status",
    {
      title: "Pipeline — task status (free)",
      description:
        "Fetch the status and results of a previously-started pipeline run. FREE — no payment required. " +
        "Returns { task_id, session_id, status (queued|running|completed|partial|failed), pipeline, steps[], final_output, accumulated, error? }. " +
        "Poll this after pipeline_invoke until status is completed, partial, or failed.",
      inputSchema: statusSchema,
    },
    async (args) => runTool(() => callFreeAgent(PIPELINE_STATUS_URL(args.task_id))),
  );
}
