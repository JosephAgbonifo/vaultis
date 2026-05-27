"use client";

import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { Navbar } from "@/components/NavBar";
import { CONTRACT_ADDRESS, ABI } from "@/lib/contract";
import { motion } from "framer-motion";
import { Lock, Award, ShieldCheck, Trophy, Layers } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: "easeOut" as const },
  }),
};

export default function ResultsPage() {
  const { address } = useAccount();
  const { writeContract, isPending } = useWriteContract();

  const { data: winner } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "winner",
  });

  const { data: owner } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "owner",
  });

  const { data: books } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "getAllBooks",
  });

  const { data: phase } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "getPhase",
  });

  const isOwner = address?.toLowerCase() === (owner as string)?.toLowerCase();
  type AllBooksReturn = readonly [string[], string[]];
  const [titles = [], authors = []] =
    (books as AllBooksReturn | undefined) ?? [];
  const hasWinner = typeof winner === "string" && winner.length > 0;

  const handleDeclare = () => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: "declareWinner",
    });
  };

  return (
    <div className="min-h-screen bg-fhenix-bg text-fhenix-white flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-14 relative">
        {/* Background glow */}
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
              PHASE 03
            </span>
            <span className="text-[10px] font-mono tracking-[0.3em] text-fhenix-muted flex items-center gap-1.5">
              <Lock size={9} /> DECRYPTED
            </span>
          </div>
          <h1 className="text-4xl font-mono font-bold tracking-tight text-fhenix-white">
            Club Results
          </h1>
          <p className="text-fhenix-muted text-sm mt-2 max-w-sm leading-relaxed">
            The tally logic executes securely on-chain.{" "}
            <span className="text-fhenix-purple/70">
              True preferences, revealed accurately.
            </span>
          </p>
        </motion.div>

        {/* Winner Announcement Area */}
        <motion.div
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mb-12"
        >
          {hasWinner ? (
            <div className="border border-fhenix-cyan bg-fhenix-card relative overflow-hidden px-6 py-10 text-center group">
              {/* shimmer sweep */}
              <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-fhenix-cyan/5 to-transparent pointer-events-none" />

              <div className="flex justify-center mb-4 text-fhenix-cyan animate-pulse">
                <Trophy size={28} />
              </div>
              <div className="text-[10px] font-mono tracking-[0.3em] text-fhenix-cyan/60 mb-2">
                NEXT READ
              </div>
              <div className="text-2xl font-mono font-bold text-fhenix-white max-w-md mx-auto leading-snug">
                {winner as string}
              </div>
              <div className="text-[10px] font-mono text-fhenix-muted mt-6 max-w-xs mx-auto leading-relaxed border-t border-fhenix-navy pt-4">
                Chosen anonymously via FHE encrypted ranked-choice voting.
              </div>
            </div>
          ) : (
            <div className="border border-fhenix-navy bg-fhenix-card px-6 py-10 text-center">
              {phase === "Closed" ? (
                <div className="flex flex-col items-center justify-center gap-4">
                  <div className="text-fhenix-white/70 text-sm font-mono">
                    voting has closed. winner not yet declared.
                  </div>
                  {isOwner && (
                    <motion.button
                      onClick={handleDeclare}
                      disabled={isPending}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      className="group relative inline-flex items-center gap-2 border border-fhenix-cyan text-fhenix-cyan px-6 py-2.5 text-xs font-mono tracking-widest hover:bg-fhenix-cyan hover:text-fhenix-bg transition-all duration-200 disabled:opacity-40 overflow-hidden"
                    >
                      <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                      <Award size={12} />
                      {isPending ? "declaring..." : "DECLARE WINNER"}
                    </motion.button>
                  )}
                </div>
              ) : (
                <div className="text-fhenix-muted text-sm font-mono flex items-center justify-center gap-2 py-4">
                  <ShieldCheck size={14} className="text-fhenix-navy" />
                  results will appear here once voting closes
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* All Nominated Books Section */}
        <motion.div
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="show"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-mono tracking-[0.2em] text-fhenix-muted flex items-center gap-2">
              <Layers size={11} className="text-fhenix-cyan/40" />
              ALL NOMINATED BOOKS
            </span>
            <span className="text-[10px] font-mono text-fhenix-cyan/50 border border-fhenix-navy px-2 py-0.5">
              {titles.length} TOTAL
            </span>
          </div>

          {titles.length === 0 ? (
            <div className="border border-fhenix-navy px-4 py-8 text-center text-fhenix-muted text-sm font-mono">
              no books nominated
            </div>
          ) : (
            <div className="space-y-1.5">
              {titles.map((t: string, i: number) => {
                const isWinnerBook = t === winner;
                return (
                  <motion.div
                    key={i}
                    custom={i}
                    variants={fadeUp}
                    initial="hidden"
                    animate="show"
                    className={`flex items-center justify-between border bg-fhenix-card px-4 py-3 transition-colors group ${
                      isWinnerBook
                        ? "border-fhenix-cyan bg-fhenix-cyan/[0.02]"
                        : "border-fhenix-navy hover:border-fhenix-cyan/20"
                    }`}
                  >
                    <div>
                      <div
                        className={`text-sm font-mono transition-colors ${
                          isWinnerBook
                            ? "text-fhenix-cyan font-bold"
                            : "text-fhenix-white group-hover:text-fhenix-cyan/90"
                        }`}
                      >
                        {t}
                      </div>
                      <div className="text-xs text-fhenix-muted mt-0.5">
                        {authors[i]}
                      </div>
                    </div>

                    {isWinnerBook ? (
                      <span className="text-[9px] font-mono border border-fhenix-cyan px-2 py-0.5 text-fhenix-cyan tracking-wider">
                        WINNER
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-fhenix-navy group-hover:text-fhenix-cyan/30 transition-colors">
                        #{String(i + 1).padStart(2, "0")}
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
