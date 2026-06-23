import { NextRequest, NextResponse } from "next/server";
import {
  createWalletClient,
  createPublicClient,
  http,
  verifyTypedData,
  keccak256,
  encodePacked,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import {
  VAULTIS_ADDRESS,
  VAULTIS_ABI,
  VAULTIS_LENS_ADDRESS,
  VAULTIS_LENS_ABI,
  GOVERNANCE_TOKEN_ABI,
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

const BALLOT_TYPES = {
  Ballot: [
    { name: "cycleId", type: "uint256" },
    { name: "proposalIds", type: "uint256[]" },
    { name: "nullifier", type: "bytes32" },
  ],
} as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      cycleId,
      proposalIds,
      encForWeights,
      encAgainstWeights,
      nullifier,
      signature,
      signerAddress,
    } = body;

    if (
      !cycleId ||
      !proposalIds ||
      !encForWeights ||
      !encAgainstWeights ||
      !nullifier ||
      !signature ||
      !signerAddress
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!Array.isArray(proposalIds) || proposalIds.length === 0) {
      return NextResponse.json(
        { error: "proposalIds must be a non-empty array" },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(encForWeights) ||
      encForWeights.length !== proposalIds.length
    ) {
      return NextResponse.json(
        { error: "encForWeights must match proposalIds length" },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(encAgainstWeights) ||
      encAgainstWeights.length !== proposalIds.length
    ) {
      return NextResponse.json(
        { error: "encAgainstWeights must match proposalIds length" },
        { status: 400 }
      );
    }

    if (new Set(proposalIds).size !== proposalIds.length) {
      return NextResponse.json(
        { error: "Duplicate proposal IDs in ballot" },
        { status: 400 }
      );
    }

    const valid = await verifyTypedData({
      address: signerAddress as Address,
      domain: DOMAIN,
      types: BALLOT_TYPES,
      primaryType: "Ballot",
      message: {
        cycleId: BigInt(cycleId),
        proposalIds: proposalIds.map(BigInt),
        nullifier: nullifier as `0x${string}`,
      },
      signature,
    });

    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const expectedNullifier = keccak256(
      encodePacked(
        ["address", "uint256"],
        [signerAddress as Address, BigInt(cycleId)]
      )
    );

    if (expectedNullifier !== nullifier) {
      return NextResponse.json(
        { error: "Nullifier mismatch" },
        { status: 400 }
      );
    }

    // usedNullifier stays on core contract (plain mapping).
    const alreadyUsed = await publicClient.readContract({
      address: VAULTIS_ADDRESS,
      abi: VAULTIS_ABI,
      functionName: "usedNullifier",
      args: [nullifier as `0x${string}`],
    });

    if (alreadyUsed) {
      return NextResponse.json(
        { error: "Ballot already submitted for this cycle" },
        { status: 409 }
      );
    }

    const onChainCycleId = await publicClient.readContract({
      address: VAULTIS_ADDRESS,
      abi: VAULTIS_ABI,
      functionName: "cycleId",
    });

    if (BigInt(cycleId) !== onChainCycleId) {
      return NextResponse.json(
        {
          error: `Cycle ID mismatch — on-chain: ${onChainCycleId}, sent: ${cycleId}`,
        },
        { status: 409 }
      );
    }

    // getCurrentPhase moved to VaultisLens.
    const currentPhase = await publicClient.readContract({
      address: VAULTIS_LENS_ADDRESS,
      abi: VAULTIS_LENS_ABI,
      functionName: "getCurrentPhase",
    });

    if (currentPhase !== "Voting") {
      return NextResponse.json(
        { error: `Not in voting phase (current: ${currentPhase})` },
        { status: 409 }
      );
    }

    const govTokenAddress = (await publicClient.readContract({
      address: VAULTIS_ADDRESS,
      abi: VAULTIS_ABI,
      functionName: "governanceToken",
    })) as Address;

    const balance = (await publicClient.readContract({
      address: govTokenAddress,
      abi: GOVERNANCE_TOKEN_ABI,
      functionName: "balanceOf",
      args: [signerAddress as Address],
    })) as bigint;

    if (balance === 0n) {
      return NextResponse.json(
        { error: "Signer holds no governance tokens" },
        { status: 403 }
      );
    }

    // proposalCount stays on core contract.
    const propCount = (await publicClient.readContract({
      address: VAULTIS_ADDRESS,
      abi: VAULTIS_ABI,
      functionName: "proposalCount",
    })) as bigint;

    const maxId = Number(propCount) - 1;
    if (proposalIds.some((id: number) => id > maxId || id < 0)) {
      return NextResponse.json(
        { error: `proposalIds out of range (0–${maxId})` },
        { status: 400 }
      );
    }

    const formattedForWeights = encForWeights.map((w: any) => ({
      ...w,
      ctHash: BigInt(w.ctHash),
    }));
    const formattedAgainstWeights = encAgainstWeights.map((w: any) => ({
      ...w,
      ctHash: BigInt(w.ctHash),
    }));

    const hash = await walletClient.writeContract({
      address: VAULTIS_ADDRESS,
      abi: VAULTIS_ABI,
      functionName: "castBallot",
      args: [
        nullifier as `0x${string}`,
        proposalIds.map(BigInt),
        formattedForWeights,
        formattedAgainstWeights,
      ],
    });

    await publicClient.waitForTransactionReceipt({ hash });

    return NextResponse.json({ success: true, txHash: hash }, { status: 200 });
  } catch (err: any) {
    console.error("[relay/ballot]", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
