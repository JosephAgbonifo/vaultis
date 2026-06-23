import { NextRequest, NextResponse } from "next/server";
import {
  createWalletClient,
  createPublicClient,
  http,
  verifyTypedData,
  type Address,
} from "viem";
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

const DOMAIN = {
  name: "Vaultis",
  version: "1",
  chainId: arbitrumSepolia.id,
  verifyingContract: VAULTIS_ADDRESS,
} as const;

const VETO_TYPES = {
  Veto: [
    { name: "cycleId", type: "uint256" },
    { name: "proposalId", type: "uint256" },
    { name: "reason", type: "string" },
  ],
} as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cycleId, proposalId, reason, signature, signerAddress } = body;

    if (
      cycleId === undefined ||
      proposalId === undefined ||
      !signature ||
      !signerAddress
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (typeof proposalId !== "number" || proposalId < 0) {
      return NextResponse.json(
        { error: "proposalId must be a non-negative integer" },
        { status: 400 }
      );
    }

    const valid = await verifyTypedData({
      address: signerAddress as Address,
      domain: DOMAIN,
      types: VETO_TYPES,
      primaryType: "Veto",
      message: {
        cycleId: BigInt(cycleId),
        proposalId: BigInt(proposalId),
        reason: reason ?? "",
      },
      signature,
    });

    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // owner stays on core contract.
    const contractOwner = (await publicClient.readContract({
      address: VAULTIS_ADDRESS,
      abi: VAULTIS_ABI,
      functionName: "owner",
    })) as Address;

    if (signerAddress.toLowerCase() !== contractOwner.toLowerCase()) {
      return NextResponse.json(
        { error: "Only the contract owner may veto proposals" },
        { status: 403 }
      );
    }

    const onChainCycleId = await publicClient.readContract({
      address: VAULTIS_ADDRESS,
      abi: VAULTIS_ABI,
      functionName: "cycleId",
    });

    if (BigInt(cycleId) !== onChainCycleId) {
      return NextResponse.json({ error: "Cycle ID mismatch" }, { status: 409 });
    }

    // getCurrentPhase moved to VaultisLens.
    const currentPhase = await publicClient.readContract({
      address: VAULTIS_LENS_ADDRESS,
      abi: VAULTIS_LENS_ABI,
      functionName: "getCurrentPhase",
    });

    if (currentPhase !== "Veto") {
      return NextResponse.json(
        { error: `Veto only allowed in Veto phase (current: ${currentPhase})` },
        { status: 409 }
      );
    }

    const propCount = (await publicClient.readContract({
      address: VAULTIS_ADDRESS,
      abi: VAULTIS_ABI,
      functionName: "proposalCount",
    })) as bigint;

    if (BigInt(proposalId) >= propCount) {
      return NextResponse.json(
        {
          error: `proposalId ${proposalId} out of range (0–${
            Number(propCount) - 1
          })`,
        },
        { status: 400 }
      );
    }

    // getPhaseDeadlines moved to VaultisLens.
    const [, , vetoEndsAt] = (await publicClient.readContract({
      address: VAULTIS_LENS_ADDRESS,
      abi: VAULTIS_LENS_ABI,
      functionName: "getPhaseDeadlines",
    })) as [bigint, bigint, bigint];

    const now = BigInt(Math.floor(Date.now() / 1000));
    if (now >= vetoEndsAt) {
      return NextResponse.json(
        { error: "Veto window has closed" },
        { status: 409 }
      );
    }

    const hash = await walletClient.writeContract({
      address: VAULTIS_ADDRESS,
      abi: VAULTIS_ABI,
      functionName: "vetoProposal",
      args: [BigInt(proposalId)],
    });

    await publicClient.waitForTransactionReceipt({ hash });

    return NextResponse.json(
      {
        success: true,
        txHash: hash,
        proposalId,
        cycleId: Number(onChainCycleId),
        reason: reason ?? "",
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[relay/veto]", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
