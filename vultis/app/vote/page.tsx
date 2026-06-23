"use client";

import { useMemo, useState } from "react";
import {
  useAccount,
  useReadContract,
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
  CATEGORY_LABELS,
} from "@/lib/config/contract";
import { connectCofhe, encryptVoteWeights } from "@/lib/fhe/fhenix";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  CheckCircle2,
  Fingerprint,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  Minus,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Proposal {
  id: number;
  recipient: string;
  token: string;
  encAmountHint: bigint;
  unlockAt: bigint;
  title: string;
  rationale: string;
  category: number;
  proposer: string;
}

type VoteChoice = "for" | "against" | "abstain";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4 },
  }),
};

// ─── VoteCard ─────────────────────────────────────────────────────────────────

function VoteCard({
  proposal,
  choice,
  onChoice,
  disabled,
}: {
  proposal: Proposal;
  choice: VoteChoice;
  onChoice: (id: number, choice: VoteChoice) => void;
  disabled: boolean;
}) {
  const unlockDate = new Date(
    Number(proposal.unlockAt) * 1000
  ).toLocaleDateString();

  return (
    <motion.div
      layout
      className={`border bg-fhenix-card px-5 py-4 transition-colors ${
        choice === "for"
          ? "border-fhenix-cyan/60 bg-fhenix-cyan/[0.03]"
          : choice === "against"
          ? "border-red-500/40 bg-red-500/[0.03]"
          : "border-fhenix-navy hover:border-fhenix-navy/80"
      }`}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-mono text-fhenix-white font-bold truncate">
            {proposal.title}
          </div>
          <div className="text-xs text-fhenix-muted mt-0.5 font-mono">
            → {proposal.recipient.slice(0, 6)}...{proposal.recipient.slice(-4)}
            <span className="mx-2 opacity-30">·</span>
            unlocks {unlockDate}
          </div>
          {proposal.rationale && (
            <div className="text-[11px] text-fhenix-muted/70 mt-1.5 leading-relaxed line-clamp-2">
              {proposal.rationale}
            </div>
          )}
        </div>
        <span className="text-[9px] font-mono border border-fhenix-navy px-1.5 py-0.5 text-fhenix-muted tracking-widest shrink-0">
          {CATEGORY_LABELS[proposal.category] ?? "Other"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onChoice(proposal.id, "for")}
          disabled={disabled}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-mono tracking-widest border transition-all duration-200 disabled:cursor-not-allowed ${
            choice === "for"
              ? "border-fhenix-cyan bg-fhenix-cyan/10 text-fhenix-cyan"
              : "border-fhenix-navy text-fhenix-muted hover:border-fhenix-cyan/40 hover:text-fhenix-cyan/70"
          }`}
        >
          <ThumbsUp size={11} /> FOR
        </button>

        <button
          onClick={() => onChoice(proposal.id, "abstain")}
          disabled={disabled}
          className={`px-4 flex items-center justify-center gap-1.5 py-2 text-[10px] font-mono tracking-widest border transition-all duration-200 disabled:cursor-not-allowed ${
            choice === "abstain"
              ? "border-fhenix-navy/80 bg-fhenix-navy/20 text-fhenix-muted"
              : "border-fhenix-navy text-fhenix-muted/40 hover:border-fhenix-navy/60 hover:text-fhenix-muted"
          }`}
        >
          <Minus size={11} />
        </button>

        <button
          onClick={() => onChoice(proposal.id, "against")}
          disabled={disabled}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-mono tracking-widest border transition-all duration-200 disabled:cursor-not-allowed ${
            choice === "against"
              ? "border-red-500/60 bg-red-500/10 text-red-400"
              : "border-fhenix-navy text-fhenix-muted hover:border-red-500/30 hover:text-red-400/70"
          }`}
        >
          <ThumbsDown size={11} /> AGAINST
        </button>
      </div>
    </motion.div>
  );
}

// ─── VotePage ─────────────────────────────────────────────────────────────────

export default function VotePage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [choices, setChoices] = useState<Record<number, VoteChoice>>({});
  const [isEncrypting, setEncrypting] = useState(false);
  const [encryptStep, setEncryptStep] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const { data: cycleId } = useReadContract({
    address: VAULTIS_ADDRESS,
    abi: VAULTIS_ABI,
    functionName: "cycleId",
  });

  const { data: currentPhase } = useReadContract({
    address: VAULTIS_LENS_ADDRESS,
    abi: VAULTIS_LENS_ABI,
    functionName: "getCurrentPhase",
  });

  const { data: rawProposals } = useReadContract({
    address: VAULTIS_LENS_ADDRESS,
    abi: VAULTIS_LENS_ABI,
    functionName: "getAllProposals",
  });

  const proposals = useMemo((): Proposal[] => {
    if (!rawProposals) return [];
    return (rawProposals as any[]).map((p, i) => ({ ...p, id: i }));
  }, [rawProposals]);

  const setChoice = (id: number, choice: VoteChoice) => {
    setChoices((prev) => ({ ...prev, [id]: choice }));
  };

  const activeVotes = useMemo(
    () => proposals.filter((p) => choices[p.id] && choices[p.id] !== "abstain"),
    [proposals, choices]
  );

  const hasVotedOnAny = activeVotes.length > 0;

  const handleVote = async () => {
    if (!publicClient || !walletClient || !address || !cycleId) return;
    if (!hasVotedOnAny) return;
    setError("");

    try {
      setEncrypting(true);

      // 1. Connect CoFHE client
      setEncryptStep("connecting to cofhe...");
      await connectCofhe(walletClient, publicClient);

      // 2. Encrypt vote weights — bound to VAULTIS_ADDRESS inside encryptVoteWeights
      setEncryptStep("encrypting vote weights...");
      const proposalIds = activeVotes.map((p) => p.id);
      const forChoices = activeVotes.map((p) => choices[p.id] === "for");
      const encrypted = await encryptVoteWeights(proposalIds, forChoices);

      // 3. Derive nullifier — one per (voter, cycle)
      const nullifier = keccak256(
        encodePacked(
          ["address", "uint256"],
          [address as `0x${string}`, BigInt(cycleId as bigint)]
        )
      ) as `0x${string}`;

      // 4. Submit directly from user's wallet — no relay, msg.sender = voter
      setEncryptStep("awaiting wallet signature...");
      const feeData = await publicClient.estimateFeesPerGas();

      const hash = await walletClient.writeContract({
        address: VAULTIS_ADDRESS,
        abi: VAULTIS_ABI,
        functionName: "castBallot",
        args: [
          nullifier,
          proposalIds.map(BigInt),
          encrypted.forWeights,
          encrypted.againstWeights,
        ],
        maxFeePerGas: feeData.maxFeePerGas
          ? feeData.maxFeePerGas * 2n
          : parseGwei("100"),
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? parseGwei("2"),
      });

      setEncryptStep("confirming transaction...");
      await publicClient.waitForTransactionReceipt({ hash });

      setDone(true);
    } catch (e: any) {
      console.error(e);
      setError(e?.shortMessage ?? e?.message ?? "Something went wrong");
    } finally {
      setEncrypting(false);
      setEncryptStep("");
    }
  };

  const notVotingPhase = currentPhase !== "Voting";

  return (
    <div className="min-h-screen bg-fhenix-bg text-fhenix-white flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-14 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-64 bg-fhenix-cyan/5 blur-[100px] pointer-events-none rounded-full" />

        {/* Page header */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mb-10"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-mono tracking-[0.3em] text-fhenix-cyan/50 border border-fhenix-navy px-2.5 py-1">
              PHASE 02
            </span>
            <span className="text-[10px] font-mono tracking-[0.3em] text-fhenix-muted flex items-center gap-1.5">
              <Lock size={9} /> FHE-ENCRYPTED WEIGHTS
            </span>
          </div>
          <h1 className="text-4xl font-mono font-bold tracking-tight text-fhenix-white">
            Cast Your Vote
          </h1>
          <p className="text-fhenix-muted text-sm mt-2 max-w-sm leading-relaxed">
            Vote FOR or AGAINST each proposal. Your token weight is encrypted
            before it hits the network.{" "}
            <span className="text-fhenix-purple/70">
              The market can&apos;t read your position off-chain.
            </span>
          </p>
        </motion.div>

        {/* Not connected */}
        <AnimatePresence>
          {!isConnected && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="border border-fhenix-navy bg-fhenix-card px-6 py-5 text-fhenix-muted text-sm mb-8 flex items-center gap-3 font-mono"
            >
              <Lock size={14} className="text-fhenix-cyan/40 shrink-0" />
              connect your wallet to vote
            </motion.div>
          )}
        </AnimatePresence>

        {/* Wrong phase */}
        <AnimatePresence>
          {isConnected && notVotingPhase && !done && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="border border-fhenix-navy bg-fhenix-card px-6 py-5 text-fhenix-muted text-sm mb-8 flex items-center gap-3 font-mono"
            >
              <Lock size={14} className="text-fhenix-cyan/40 shrink-0" />
              voting is not open — current phase:{" "}
              <span className="text-fhenix-cyan/60">
                {currentPhase ?? "..."}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success */}
        <AnimatePresence>
          {done && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="border border-fhenix-cyan/30 bg-fhenix-cyan/5 px-6 py-5 mb-8 flex items-center gap-3"
            >
              <CheckCircle2 size={16} className="text-fhenix-cyan shrink-0" />
              <div>
                <p className="text-sm text-fhenix-cyan font-mono">
                  encrypted ballot submitted
                </p>
                <p className="text-[10px] text-fhenix-muted mt-0.5">
                  your token-weighted votes are sealed on-chain — invisible
                  until the cycle executes
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="border border-red-500/30 bg-red-500/5 px-6 py-4 mb-8 text-red-400 text-xs font-mono"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main voting UI */}
        {isConnected && !notVotingPhase && !done && (
          <>
            <motion.div
              custom={1}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="flex items-center gap-2 mb-5 px-3 py-2 border border-fhenix-navy/50 bg-fhenix-card/30"
            >
              <ShieldCheck size={11} className="text-fhenix-cyan/40 shrink-0" />
              <p className="text-[10px] font-mono text-fhenix-muted/70 tracking-wide">
                vote weights are your governance token balance, FHE-encrypted
                client-side. abstain = excluded from tally.
              </p>
            </motion.div>

            {proposals.length === 0 ? (
              <div className="border border-fhenix-navy bg-fhenix-card px-4 py-8 text-center text-fhenix-muted text-sm font-mono">
                no proposals in this cycle
              </div>
            ) : (
              <motion.div
                custom={2}
                variants={fadeUp}
                initial="hidden"
                animate="show"
                className="space-y-3 mb-8"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono tracking-[0.2em] text-fhenix-muted">
                    PROPOSALS · {proposals.length} ACTIVE
                  </span>
                  <span className="text-[10px] font-mono text-fhenix-cyan/50 border border-fhenix-navy px-2 py-0.5">
                    {activeVotes.length} VOTED
                  </span>
                </div>
                {proposals.map((p) => (
                  <VoteCard
                    key={p.id}
                    proposal={p}
                    choice={choices[p.id] ?? "abstain"}
                    onChoice={setChoice}
                    disabled={isEncrypting}
                  />
                ))}
              </motion.div>
            )}

            <motion.div
              custom={3}
              variants={fadeUp}
              initial="hidden"
              animate="show"
            >
              <button
                onClick={handleVote}
                disabled={
                  isEncrypting || !hasVotedOnAny || proposals.length === 0
                }
                className="group relative w-full border border-fhenix-cyan text-fhenix-cyan py-3.5 text-xs font-mono tracking-[0.2em] hover:bg-fhenix-cyan hover:text-fhenix-bg transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed overflow-hidden flex items-center justify-center gap-2"
              >
                <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                <Fingerprint size={12} />
                {isEncrypting
                  ? encryptStep.toUpperCase()
                  : `ENCRYPT & SUBMIT BALLOT${
                      activeVotes.length > 0
                        ? ` (${activeVotes.length} VOTE${
                            activeVotes.length !== 1 ? "S" : ""
                          })`
                        : ""
                    }`}
              </button>

              {!hasVotedOnAny && proposals.length > 0 && (
                <p className="text-[10px] font-mono text-fhenix-muted text-center mt-3 tracking-wide">
                  VOTE FOR OR AGAINST AT LEAST ONE PROPOSAL TO SUBMIT
                </p>
              )}
            </motion.div>
          </>
        )}
      </main>
    </div>
  );
}
