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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { forCounts, againstCounts } = body;

    if (!Array.isArray(forCounts) || forCounts.length === 0) {
      return NextResponse.json(
        { error: "forCounts must be a non-empty array" },
        { status: 400 }
      );
    }

    if (!Array.isArray(againstCounts) || againstCounts.length === 0) {
      return NextResponse.json(
        { error: "againstCounts must be a non-empty array" },
        { status: 400 }
      );
    }

    if (forCounts.length !== againstCounts.length) {
      return NextResponse.json(
        { error: "forCounts and againstCounts must be the same length" },
        { status: 400 }
      );
    }

    const hasInvalidFor = forCounts.some(
      (c) => c === null || c === undefined || typeof c !== "number"
    );
    const hasInvalidAgainst = againstCounts.some(
      (c) => c === null || c === undefined || typeof c !== "number"
    );

    if (hasInvalidFor) {
      return NextResponse.json(
        {
          error: `Invalid forCounts — contains null or non-number: ${JSON.stringify(
            forCounts
          )}`,
        },
        { status: 400 }
      );
    }

    if (hasInvalidAgainst) {
      return NextResponse.json(
        {
          error: `Invalid againstCounts — contains null or non-number: ${JSON.stringify(
            againstCounts
          )}`,
        },
        { status: 400 }
      );
    }

    // proposalCount stays on core contract.
    const propCount = (await publicClient.readContract({
      address: VAULTIS_ADDRESS,
      abi: VAULTIS_ABI,
      functionName: "proposalCount",
    })) as bigint;

    if (BigInt(forCounts.length) !== propCount) {
      return NextResponse.json(
        {
          error: `Count array length mismatch — on-chain proposals: ${propCount}, submitted: ${forCounts.length}`,
        },
        { status: 400 }
      );
    }

    // getCurrentPhase moved to VaultisLens.
    const currentPhase = await publicClient.readContract({
      address: VAULTIS_LENS_ADDRESS,
      abi: VAULTIS_LENS_ABI,
      functionName: "getCurrentPhase",
    });

    if (currentPhase !== "Tally" && currentPhase !== "Veto") {
      return NextResponse.json(
        { error: `Cannot publish allocations in phase: ${currentPhase}` },
        { status: 409 }
      );
    }

    const hash = await walletClient.writeContract({
      address: VAULTIS_ADDRESS,
      abi: VAULTIS_ABI,
      functionName: "publishAllocations",
      args: [forCounts.map(BigInt), againstCounts.map(BigInt)],
    });

    await publicClient.waitForTransactionReceipt({ hash });

    // cycleId + proposalApproved stay on core contract.
    const cycleId = (await publicClient.readContract({
      address: VAULTIS_ADDRESS,
      abi: VAULTIS_ABI,
      functionName: "cycleId",
    })) as bigint;

    const approvedIds: number[] = [];
    for (let i = 0; i < forCounts.length; i++) {
      const approved = (await publicClient.readContract({
        address: VAULTIS_ADDRESS,
        abi: VAULTIS_ABI,
        functionName: "proposalApproved",
        args: [cycleId, BigInt(i)],
      })) as boolean;
      if (approved) approvedIds.push(i);
    }

    return NextResponse.json(
      {
        success: true,
        txHash: hash,
        approvedIds,
        approvedCount: approvedIds.length,
        rejectedCount: forCounts.length - approvedIds.length,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[relay/publish]", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
