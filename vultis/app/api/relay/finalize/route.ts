import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import {
  VAULTIS_ADDRESS,
  VAULTIS_ABI,
  VAULTIS_LENS_ADDRESS,
  VAULTIS_LENS_ABI,
} from "@/lib/config/contract";

const account = privateKeyToAccount(
  process.env.RELAYER_PRIVATE_KEY as `0x${string}`
);

const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(process.env.RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: arbitrumSepolia,
  transport: http(process.env.RPC_URL),
});

// ─── POST /api/relay/finalize ─────────────────────────────────────────────────
// Transitions Tally → Veto, exposes FHE handles for off-chain decryption.
export async function POST(_req: NextRequest) {
  try {
    // getPhaseDeadlines + getCurrentPhase moved to VaultisLens (split out of
    // the core contract to stay under the 24KB EVM code-size limit).
    const [, voteEndsAt] = (await publicClient.readContract({
      address: VAULTIS_LENS_ADDRESS,
      abi: VAULTIS_LENS_ABI,
      functionName: "getPhaseDeadlines",
    })) as [bigint, bigint, bigint];

    const now = BigInt(Math.floor(Date.now() / 1000));
    if (now < voteEndsAt) {
      return NextResponse.json(
        {
          error: `Voting window not closed yet (closes in ${Number(
            voteEndsAt - now
          )}s)`,
        },
        { status: 409 }
      );
    }

    const currentPhase = await publicClient.readContract({
      address: VAULTIS_LENS_ADDRESS,
      abi: VAULTIS_LENS_ABI,
      functionName: "getCurrentPhase",
    });

    if (currentPhase !== "Tally") {
      return NextResponse.json(
        { error: `Cannot finalize in phase: ${currentPhase}` },
        { status: 409 }
      );
    }

    // Write stays on the core Vaultis contract.
    const hash = await walletClient.writeContract({
      address: VAULTIS_ADDRESS,
      abi: VAULTIS_ABI,
      functionName: "finalize",
      args: [],
    });

    await publicClient.waitForTransactionReceipt({ hash });

    // getTallyHandles stays on the core contract — it unwraps euint64 storage
    // directly, so it couldn't move to the Lens.
    const [forHandles, againstHandles] = (await publicClient.readContract({
      address: VAULTIS_ADDRESS,
      abi: VAULTIS_ABI,
      functionName: "getTallyHandles",
    })) as [bigint[], bigint[]];

    return NextResponse.json(
      {
        success: true,
        txHash: hash,
        forHandles: forHandles.map((h) =>
          h === null || h === undefined ? "0" : h.toString()
        ),
        againstHandles: againstHandles.map((h) =>
          h === null || h === undefined ? "0" : h.toString()
        ),
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[relay/finalize]", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
