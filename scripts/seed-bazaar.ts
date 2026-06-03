// ── seed-bazaar.ts ─────────────────────────────────────────────────────────
// One-time seeding script. Calls each of the five Distill invoke endpoints once
// with realistic data, paying the x402 challenge with the SEEDER wallet. A
// successful settlement through the CDP facilitator is what triggers the
// facilitator to index each resource into the x402 Bazaar catalog.
//
// Usage:  SEEDER_PRIVATE_KEY=0x... bun run scripts/seed-bazaar.ts
//
// Costs real USDC on Base Mainnet: ~0.085 USDC total (0.02 + 0.02 + 0.01 +
// 0.005 + 0.03). Pipeline is async — it settles 0.03 and returns a task_id; the
// downstream agents it chains are paid by the pipeline's own wallet, not here.
import { createPublicClient, http as viemHttp } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { toClientEvmSigner } from "@x402/evm";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { REGISTRY } from "../src/registry";

const RPC_URL = process.env.RPC_URL ?? "https://mainnet.base.org";

function buildPayFetch() {
  const raw = process.env.SEEDER_PRIVATE_KEY;
  if (!raw) {
    throw new Error("SEEDER_PRIVATE_KEY is not set — cannot pay the x402 challenges to seed Bazaar.");
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
  console.log(`Seeder wallet: ${account.address}`);
  return wrapFetchWithPayment(fetch, client);
}

interface SeedCall {
  name: string;
  url: string;
  body: unknown;
}

const CALLS: SeedCall[] = [
  {
    name: REGISTRY.refine.label,
    url: REGISTRY.refine.url,
    body: {
      data: [
        { hash: "0xseed1", from: "0x104b5768fe505c400dd98f447665cb5c6fca388a", to: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", value: "1000000", timestamp: 1717400000 },
        { hash: "0xseed2", from: "0x0000000000000000000000000000000000000bot", to: "0x104b5768fe505c400dd98f447665cb5c6fca388a", value: "1", timestamp: 1717400001 },
      ],
    },
  },
  {
    name: REGISTRY.trace.label,
    url: REGISTRY.trace.url,
    body: {
      log: "[2026-06-03T10:00:00Z] step 1: fetch data (320ms)\n[2026-06-03T10:00:01Z] step 2: clean data (180ms)\n[2026-06-03T10:00:02Z] done",
      format: "auto",
    },
  },
  {
    name: REGISTRY.forge.label,
    url: REGISTRY.forge.url,
    body: {
      agent_id: "6482",
      chain_id: 8453,
      task: "bazaar seed",
      response_latency_ms: 500,
      usdc_paid: "10000",
      tx_hash: "0xseed0000000000000000000000000000000000000000000000000000000000",
      success: true,
      score: 90,
    },
  },
  {
    name: REGISTRY.shield.label,
    url: REGISTRY.shield.url,
    body: {
      request: {
        url: "https://agent.com/api?company=Acme&email=user@acme.com",
        description: "Bazaar seed request for Acme",
        metadata: { reason: "seed" },
      },
      payment_requirements: {
        scheme: "exact",
        network: "eip155:8453",
        maxAmountRequired: "5000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        payTo: "0x104b5768FE505c400dd98F447665CB5c6fca388A",
      },
    },
  },
  {
    name: REGISTRY.pipeline.label,
    url: REGISTRY.pipeline.url,
    body: {
      pipeline: ["trace"],
      payload: {
        log: "[2026-06-03T10:00:00Z] step 1: seed (100ms)\n[2026-06-03T10:00:00Z] done",
      },
    },
  },
];

async function main(): Promise<void> {
  const payFetch = buildPayFetch();
  let ok = 0;
  let failed = 0;

  for (const call of CALLS) {
    process.stdout.write(`Seeding ${call.name} (${call.url}) ... `);
    try {
      const res = await payFetch(call.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(call.body),
      });
      const text = await res.text();
      if (res.ok) {
        ok++;
        console.log(`OK (HTTP ${res.status})`);
      } else {
        failed++;
        console.log(`FAILED (HTTP ${res.status}): ${text.slice(0, 200)}`);
      }
    } catch (err) {
      failed++;
      console.log(`ERROR: ${(err as Error).message}`);
    }
  }

  console.log(`\nSeed complete — ${ok} ok, ${failed} failed out of ${CALLS.length}.`);
  console.log("The CDP facilitator indexes settled resources into x402 Bazaar; allow time for the catalog to update.");
  if (failed > 0) process.exitCode = 1;
}

void main();
