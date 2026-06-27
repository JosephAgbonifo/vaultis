"use client";

import { useMemo, useState, ReactNode, CSSProperties } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import { keccak256, encodePacked, parseGwei } from "viem";
import { Navbar } from "@/components/NavBar";
import {
  VAULTIS_ADDRESS,
  VAULTIS_ABI,
  VAULTIS_LENS_ADDRESS,
  VAULTIS_LENS_ABI,
  GOVERNANCE_TOKEN_ADDRESS,
  GOVERNANCE_TOKEN_ABI,
  CATEGORY_LABELS,
} from "@/lib/config/contract";
import {
  connectCofhe,
  encryptVoteWeight,
  decryptTallyPair,
} from "@/lib/fhe/fhenix";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  CheckCircle2,
  Fingerprint,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  Coins,
  Clock,
  RefreshCw,
} from "lucide-react";
import { formatEther } from "viem";

// ─── TYPES ────────────────────────────────────────────────────────────────────

// Mirrors VaultisLens.DisplayStatus — order must match the Solidity enum exactly.
const DISPLAY_STATUS = [
  "Active",
  "ReadyToResolve",
  "ResolutionPending",
  "Fulfilled",
  "Abandoned",
] as const;
type DisplayStatusLabel = (typeof DISPLAY_STATUS)[number];

interface ProposalView {
  id: bigint;
  recipient: string;
  token: string;
  amount: bigint;
  expiresAt: bigint;
  title: string;
  rationale: string;
  category: number;
  proposer: string;
  displayStatus: number;
  finalForCount: bigint;
  finalAgainstCount: bigint;
}

type FilterTab = "toVote" | "voted" | "expired" | "all";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4 },
  }),
};

const nullifierFor = (address: `0x${string}`, proposalId: bigint) =>
  keccak256(
    encodePacked(["address", "uint256"], [address, proposalId])
  ) as `0x${string}`;

// ─── GRID BACKDROP ────────────────────────────────────────────────────────────

function GridBackdrop() {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none z-0"
      aria-hidden
    >
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.025]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="vote-grid"
            width="48"
            height="48"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 48 0 L 0 0 0 48"
              fill="none"
              stroke="#22d3ee"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#vote-grid)" />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-b from-fhenix-bg via-transparent to-fhenix-bg" />
      <div
        className="absolute w-[500px] h-[500px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(34,211,238,0.055) 0%, transparent 70%)",
          top: "-10%",
          left: "50%",
          transform: "translateX(-50%)",
        }}
      />
    </div>
  );
}

// ─── GLASS CARD ───────────────────────────────────────────────────────────────

function GlassCard({
  children,
  className = "",
  style = {},
}: {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`rounded-2xl border ${className}`}
      style={{
        background: "rgba(255,255,255,0.01)",
        border: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(20px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DisplayStatusLabel }) {
  const map: Record<
    DisplayStatusLabel,
    { bg: string; border: string; color: string; label: string }
  > = {
    Active: {
      bg: "rgba(34,211,238,0.08)",
      border: "rgba(34,211,238,0.25)",
      color: "#22d3ee",
      label: "ACTIVE",
    },
    ReadyToResolve: {
      bg: "rgba(251,146,60,0.08)",
      border: "rgba(251,146,60,0.25)",
      color: "#fb923c",
      label: "AWAITING RESOLUTION",
    },
    ResolutionPending: {
      bg: "rgba(167,139,250,0.08)",
      border: "rgba(167,139,250,0.25)",
      color: "#a78bfa",
      label: "AWAITING DECRYPTION",
    },
    Fulfilled: {
      bg: "rgba(74,222,128,0.08)",
      border: "rgba(74,222,128,0.25)",
      color: "#4ade80",
      label: "FULFILLED",
    },
    Abandoned: {
      bg: "rgba(255,255,255,0.03)",
      border: "rgba(255,255,255,0.1)",
      color: "rgba(255,255,255,0.4)",
      label: "ABANDONED",
    },
  };
  const s = map[status];
  return (
    <span
      className="text-[9px]  px-2 py-0.5 rounded-md tracking-widest shrink-0 font-semibold"
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.color,
      }}
    >
      {s.label}
    </span>
  );
}

// ─── RESULT BAR (expired proposals) ──────────────────────────────────────────

function ResultBar({
  forCount,
  againstCount,
  resolved,
}: {
  forCount: bigint;
  againstCount: bigint;
  resolved: boolean;
}) {
  if (!resolved) {
    return (
      <div className="flex items-center gap-2 text-[10px]  text-fhenix-muted/60 tracking-wide">
        <Clock size={11} className="text-fhenix-cyan/40" />
        tally sealed until resolution completes
      </div>
    );
  }
  const total = forCount + againstCount;
  const forPct = total === 0n ? 50 : Number((forCount * 100n) / total);
  return (
    <div>
      <div className="flex items-center justify-between text-[10px]  text-fhenix-muted/70 mb-1.5">
        <span>FOR {forCount.toString()}</span>
        <span>AGAINST {againstCount.toString()}</span>
      </div>
      <div className="h-1.5 w-full rounded-full overflow-hidden bg-white/[0.05] flex">
        <div
          className="h-full bg-fhenix-cyan/60"
          style={{ width: `${forPct}%` }}
        />
        <div
          className="h-full bg-red-500/50"
          style={{ width: `${100 - forPct}%` }}
        />
      </div>
    </div>
  );
}

// ─── PROPOSAL CARD ────────────────────────────────────────────────────────────

function ProposalCard({
  proposal,
  voted,
  onVoted,
  index,
}: {
  proposal: ProposalView;
  voted: boolean;
  onVoted: () => void;
  index: number;
}) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [pendingChoice, setPendingChoice] = useState<"for" | "against" | null>(
    null
  );
  const [step, setStep] = useState("");
  const [error, setError] = useState("");

  const { data: balance } = useReadContract({
    address: GOVERNANCE_TOKEN_ADDRESS,
    abi: GOVERNANCE_TOKEN_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  const expiresDate = new Date(
    Number(proposal.expiresAt) * 1000
  ).toLocaleString();
  const statusLabel = DISPLAY_STATUS[proposal.displayStatus];
  const isResolved = statusLabel === "Fulfilled" || statusLabel === "Abandoned";
  const isExpired = statusLabel !== "Active";
  const hasNoBalance = !balance || (balance as bigint) === BigInt(0);

  const handleVote = async (choice: "for" | "against") => {
    if (!publicClient || !walletClient || !address) return;
    if (hasNoBalance) {
      setError(
        "You need governance tokens to vote — claim from the faucet first"
      );
      return;
    }
    setError("");
    setPendingChoice(choice);

    try {
      setStep("connecting to cofhe...");
      await connectCofhe(walletClient, publicClient);

      setStep("encrypting vote weight...");
      const { forWeight, againstWeight } = await encryptVoteWeight(
        choice === "for",
        balance as bigint
      );

      const nullifier = nullifierFor(address as `0x${string}`, proposal.id);

      setStep("awaiting wallet signature...");
      const feeData = await publicClient.estimateFeesPerGas();

      const hash = await walletClient.writeContract({
        address: VAULTIS_ADDRESS,
        abi: VAULTIS_ABI,
        functionName: "castBallot",
        args: [proposal.id, nullifier, forWeight, againstWeight],
        maxFeePerGas: feeData.maxFeePerGas
          ? feeData.maxFeePerGas * 2n
          : parseGwei("100"),
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? parseGwei("2"),
      });

      setStep("confirming transaction...");
      await publicClient.waitForTransactionReceipt({ hash });

      onVoted();
    } catch (e: any) {
      console.error(e);
      setError(e?.shortMessage ?? e?.message ?? "Vote failed");
    } finally {
      setPendingChoice(null);
      setStep("");
    }
  };

  const handleResolve = async () => {
    if (!publicClient || !walletClient) return;
    setError("");
    try {
      setStep("triggering resolution...");
      const feeData = await publicClient.estimateFeesPerGas();
      const hash = await walletClient.writeContract({
        address: VAULTIS_ADDRESS,
        abi: VAULTIS_ABI,
        functionName: "resolve",
        args: [proposal.id],
        maxFeePerGas: feeData.maxFeePerGas
          ? feeData.maxFeePerGas * 2n
          : parseGwei("100"),
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? parseGwei("2"),
      });
      await publicClient.waitForTransactionReceipt({ hash });
    } catch (e: any) {
      setError(e?.shortMessage ?? e?.message ?? "Resolution failed");
    } finally {
      setStep("");
    }
  };

  const handleFinalize = async () => {
    if (!publicClient || !walletClient) return;
    setError("");
    const raw = (await publicClient.readContract({
      address: VAULTIS_ADDRESS,
      abi: VAULTIS_ABI,
      functionName: "getProposal",
      args: [proposal.id],
    })) as any;
    console.log(
      "token:",
      raw.token,
      "amount:",
      raw.amount.toString(),
      "recipient:",
      raw.recipient
    );
    try {
      setStep("reading tally handles...");
      const [forHandle, againstHandle] = (await publicClient.readContract({
        address: VAULTIS_ADDRESS,
        abi: VAULTIS_ABI,
        functionName: "getTallyHandles",
        args: [proposal.id],
      })) as [bigint, bigint];

      setStep("decrypting tally...");
      await connectCofhe(walletClient, publicClient);
      const { forCount, againstCount } = await decryptTallyPair(
        forHandle.toString(),
        againstHandle.toString()
      );

      setStep("submitting outcome...");

      try {
        await publicClient.simulateContract({
          address: VAULTIS_ADDRESS,
          abi: VAULTIS_ABI,
          functionName: "finalizeResolution",
          args: [proposal.id, BigInt(forCount), BigInt(againstCount)],
          account: walletClient.account,
        });
      } catch (simError: any) {
        console.error("Simulation failed:", simError);
        throw new Error(
          simError?.shortMessage ?? simError?.message ?? "Simulation reverted"
        );
      }
      const feeData = await publicClient.estimateFeesPerGas();

      const hash = await walletClient.writeContract({
        address: VAULTIS_ADDRESS,
        abi: VAULTIS_ABI,
        functionName: "finalizeResolution",
        args: [proposal.id, BigInt(forCount), BigInt(againstCount)],
        maxFeePerGas: feeData.maxFeePerGas
          ? feeData.maxFeePerGas * 2n
          : parseGwei("100"),
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? parseGwei("2"),
      });

      setStep("confirming transaction...");
      await publicClient.waitForTransactionReceipt({ hash });

      onVoted();
    } catch (e: any) {
      console.error(e);
      setError(e?.shortMessage ?? e?.message ?? "Finalize failed");
    } finally {
      setStep("");
    }
  };

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="show"
      layout
      className="rounded-2xl px-5 py-4"
      style={{
        background: "rgba(255,255,255,0.01)",
        border: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(20px)",
      }}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="text-sm text-fhenix-white font-bold truncate">
              {proposal.title}
            </div>
            {voted && (
              <span className="text-[8px] tracking-widest text-fhenix-cyan/70 border border-fhenix-cyan/20 bg-fhenix-cyan/5 rounded px-1.5 py-0.5 shrink-0">
                ✓ VOTED
              </span>
            )}
          </div>
          <div className="text-xs text-fhenix-muted mt-0.5">
            → {proposal.recipient.slice(0, 6)}...{proposal.recipient.slice(-4)}
            <span className="mx-2 opacity-30">·</span>
            {isExpired ? "expired" : "expires"} {expiresDate}
          </div>
          {proposal.rationale && (
            <div className="text-[11px] text-fhenix-muted/60 mt-1.5 leading-relaxed line-clamp-2">
              {proposal.rationale}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <StatusBadge status={statusLabel} />
          <span
            className="text-[9px] px-2 py-0.5 rounded-md tracking-widest"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              color: "rgba(255,255,255,0.35)",
            }}
          >
            {CATEGORY_LABELS[proposal.category] ?? "Other"}
          </span>
        </div>
      </div>

      {error && <p className="text-[10px] text-red-400 mb-2">{error}</p>}

      {/* ── Active, not voted: vote buttons ── */}
      {!isExpired && !voted && (
        <div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleVote("for")}
              disabled={pendingChoice !== null || hasNoBalance}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] tracking-widest rounded-xl border transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-30 font-semibold"
              style={{
                background:
                  pendingChoice === "for"
                    ? "rgba(34,211,238,0.12)"
                    : "rgba(255,255,255,0.02)",
                border: "1px solid rgba(34,211,238,0.3)",
                color: "#22d3ee",
              }}
            >
              <ThumbsUp size={11} />
              {pendingChoice === "for" ? step.toUpperCase() : "FOR"}
            </button>
            <button
              onClick={() => handleVote("against")}
              disabled={pendingChoice !== null || hasNoBalance}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] tracking-widest rounded-xl border transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-30 font-semibold"
              style={{
                background:
                  pendingChoice === "against"
                    ? "rgba(239,68,68,0.1)"
                    : "rgba(255,255,255,0.02)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "rgba(248,113,113,1)",
              }}
            >
              <ThumbsDown size={11} />
              {pendingChoice === "against" ? step.toUpperCase() : "AGAINST"}
            </button>
          </div>
          {hasNoBalance && (
            <p className="text-[10px] text-fhenix-muted/50 tracking-wide mt-2">
              you need governance tokens to vote — claim from the faucet
            </p>
          )}
        </div>
      )}

      {/* ── Active, already voted: no buttons, just the confirmation tag above ── */}
      {!isExpired && voted && (
        <p className="text-[10px] text-fhenix-muted/50 tracking-wide">
          your encrypted ballot is sealed until this proposal expires
        </p>
      )}

      {/* ── Expired: result bar, no vote buttons ── */}
      {isExpired && (
        <div>
          <ResultBar
            forCount={proposal.finalForCount}
            againstCount={proposal.finalAgainstCount}
            resolved={isResolved}
          />

          {statusLabel === "ReadyToResolve" && (
            <button
              onClick={handleResolve}
              disabled={step !== ""}
              className="mt-3 flex items-center gap-1.5 text-[10px] tracking-widest text-fhenix-cyan/70 hover:text-fhenix-cyan transition-colors"
            >
              <RefreshCw
                size={10}
                className={step !== "" ? "animate-spin" : ""}
              />
              {step !== "" ? step.toUpperCase() : "TRIGGER RESOLUTION"}
            </button>
          )}

          {statusLabel === "ResolutionPending" && (
            <button
              onClick={handleFinalize}
              disabled={step !== ""}
              className="mt-3 flex items-center gap-1.5 text-[10px] tracking-widest text-fhenix-cyan/70 hover:text-fhenix-cyan transition-colors"
            >
              <RefreshCw
                size={10}
                className={step !== "" ? "animate-spin" : ""}
              />
              {step !== "" ? step.toUpperCase() : "DECRYPT & FINALIZE"}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function ProposalsPage() {
  const { address, isConnected } = useAccount();

  const [tab, setTab] = useState<FilterTab>("toVote");

  const { data: balance } = useReadContract({
    address: GOVERNANCE_TOKEN_ADDRESS,
    abi: GOVERNANCE_TOKEN_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  const { data: symbol } = useReadContract({
    address: GOVERNANCE_TOKEN_ADDRESS,
    abi: GOVERNANCE_TOKEN_ABI,
    functionName: "symbol",
  });

  const { data: rawProposals, refetch: refetchProposals } = useReadContract({
    address: VAULTIS_LENS_ADDRESS,
    abi: VAULTIS_LENS_ABI,
    functionName: "getAllProposals",
    query: { refetchInterval: 20_000 },
  });

  const proposals = useMemo((): ProposalView[] => {
    if (!rawProposals) return [];
    return (rawProposals as any[]).map((p) => ({ ...p, id: BigInt(p.id) }));
  }, [rawProposals]);

  // ── Batch-check which proposals this wallet has voted on, client-side ──
  // (contract can't tell us "did address X vote" — only "was this nullifier used")
  const nullifierReads = useMemo(() => {
    if (!address) return [];
    return proposals.map((p) => ({
      address: VAULTIS_ADDRESS,
      abi: VAULTIS_ABI,
      functionName: "isNullifierUsed",
      args: [p.id, nullifierFor(address as `0x${string}`, p.id)],
    }));
  }, [address, proposals]);

  const { data: votedResults, refetch: refetchVoted } = useReadContracts({
    contracts: nullifierReads,
    query: { enabled: nullifierReads.length > 0 },
  });

  const votedMap = useMemo(() => {
    const map = new Map<string, boolean>();
    proposals.forEach((p, i) => {
      const result = votedResults?.[i];
      map.set(
        p.id.toString(),
        result?.status === "success" ? Boolean(result.result) : false
      );
    });
    return map;
  }, [proposals, votedResults]);

  const votedCount = useMemo(
    () => [...votedMap.values()].filter(Boolean).length,
    [votedMap]
  );

  const filtered = useMemo(() => {
    return proposals.filter((p) => {
      const isExpired = p.displayStatus !== 0;
      const voted = votedMap.get(p.id.toString()) ?? false;
      switch (tab) {
        case "toVote":
          return !isExpired && !voted;
        case "voted":
          return voted;
        case "expired":
          return isExpired;
        case "all":
          return true;
      }
    });
  }, [proposals, votedMap, tab]);

  const counts = useMemo(() => {
    const toVote = proposals.filter(
      (p) => p.displayStatus === 0 && !votedMap.get(p.id.toString())
    ).length;
    const expired = proposals.filter((p) => p.displayStatus !== 0).length;
    return { toVote, voted: votedCount, expired, all: proposals.length };
  }, [proposals, votedMap, votedCount]);

  const formattedBalance =
    balance !== undefined
      ? parseFloat(formatEther(balance as bigint)).toFixed(2)
      : null;

  const refreshAll = () => {
    refetchProposals();
    refetchVoted();
  };

  const TABS: { key: FilterTab; label: string; count: number }[] = [
    { key: "toVote", label: "To Vote", count: counts.toVote },
    { key: "voted", label: "Voted", count: counts.voted },
    { key: "expired", label: "Expired", count: counts.expired },
    { key: "all", label: "All", count: counts.all },
  ];

  return (
    <div className="min-h-screen bg-fhenix-bg text-fhenix-white flex flex-col antialiased overflow-x-hidden">
      <Navbar />

      <main className="relative flex-1 max-w-2xl mx-auto w-full px-6 py-16">
        <GridBackdrop />

        {/* ── PAGE HEADER ── */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="relative z-10 mb-8"
        >
          <div className="flex items-center gap-2.5 mb-4">
            <span className=" text-[9px] tracking-[0.2em] text-fhenix-muted flex items-center gap-1.5">
              <Lock size={9} /> FHE-ENCRYPTED WEIGHTS
            </span>
          </div>

          <h1
            className="text-4xl md:text-5xl font-black tracking-tight text-fhenix-white mb-3"
            style={{ letterSpacing: "-0.02em" }}
          >
            All Proposals
          </h1>
          <p className="text-fhenix-muted text-sm max-w-sm leading-relaxed">
            Vote FOR or AGAINST individually — your token weight is encrypted
            before it hits the network.
          </p>
        </motion.div>

        {/* ── STATS ROW ── */}
        {isConnected && (
          <motion.div
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="relative z-10 flex items-center gap-3 mb-6"
          >
            <GlassCard className="flex items-center gap-2 px-3.5 py-2">
              <Coins size={11} className="text-fhenix-cyan/60" />
              <span className="text-xs font-mono text-fhenix-white">
                {formattedBalance ?? "..."}
              </span>
              <span className="text-[10px] text-fhenix-muted/50">
                {(symbol as string) ?? "VLTG"} VOTING POWER
              </span>
            </GlassCard>
            <GlassCard className="flex items-center gap-2 px-3.5 py-2">
              <CheckCircle2 size={11} className="text-fhenix-cyan/60" />
              <span className="text-xs font-mono text-fhenix-white">
                {votedCount}
              </span>
              <span className="text-[10px] text-fhenix-muted/50">
                PROPOSALS VOTED
              </span>
            </GlassCard>
          </motion.div>
        )}

        {/* ── FILTER TABS ── */}
        <motion.div
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="relative z-10 flex items-center gap-1.5 mb-6 overflow-x-auto"
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] tracking-widest whitespace-nowrap transition-all duration-200"
              style={{
                background:
                  tab === t.key
                    ? "rgba(34,211,238,0.1)"
                    : "rgba(255,255,255,0.02)",
                border:
                  tab === t.key
                    ? "1px solid rgba(34,211,238,0.4)"
                    : "1px solid rgba(255,255,255,0.06)",
                color: tab === t.key ? "#22d3ee" : "rgba(255,255,255,0.4)",
              }}
            >
              {t.label.toUpperCase()}
              <span className="opacity-50">{t.count}</span>
            </button>
          ))}
        </motion.div>

        <div className="relative z-10 space-y-3">
          {!isConnected ? (
            <GlassCard className="px-5 py-4 flex items-center gap-3">
              <Lock size={13} className="text-fhenix-cyan/40 shrink-0" />
              <p className="text-fhenix-muted text-sm">
                connect your wallet to view and vote on proposals
              </p>
            </GlassCard>
          ) : filtered.length === 0 ? (
            <GlassCard className="px-4 py-10 text-center">
              <p className="text-fhenix-muted text-sm">
                {tab === "toVote"
                  ? "nothing left to vote on right now"
                  : "no proposals in this view"}
              </p>
            </GlassCard>
          ) : (
            filtered.slice().reverse().map((p, i) => (
              <ProposalCard
                key={p.id.toString()}
                proposal={p}
                voted={votedMap.get(p.id.toString()) ?? false}
                onVoted={refreshAll}
                index={i}
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
}
