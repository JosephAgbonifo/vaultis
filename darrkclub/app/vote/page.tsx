"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import { Navbar } from "@/components/NavBar";
import { CONTRACT_ADDRESS, ABI } from "@/lib/contract";
import { connectCofhe, encryptRankings } from "@/lib/fhenix";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  CheckCircle2,
  ListOrdered,
  Plus,
  ArrowUp,
  ArrowDown,
  X,
  Fingerprint,
} from "lucide-react";

interface Book {
  id: number;
  title: string;
  author: string;
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: "easeOut" as const },
  }),
};

export default function VotePage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [ranked, setRanked] = useState<Book[]>([]);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [encryptStep, setEncryptStep] = useState("");
  const [voteError, setVoteError] = useState("");
  const [isCofheReady, setIsCofheReady] = useState(false);
  const [cofheInitError, setCofheInitError] = useState("");
  const [done, setDone] = useState(false);

  const { data: hasVoted } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "hasVoted",
    args: [address!],
    query: { enabled: !!address },
  });

  const { data: rawBooks } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "getAllBooks",
  });

  type AllBooksReturn = readonly [string[], string[]];
  const books = useMemo((): Book[] => {
    if (!rawBooks) return [];
    const [titles = [], authors = []] = (rawBooks as AllBooksReturn) ?? [];
    return titles.map((t, i) => ({
      id: i,
      title: t,
      author: authors[i],
    }));
  }, [rawBooks]);

  const unranked = useMemo((): Book[] => {
    const rankedIds = new Set(ranked.map((b) => b.id));
    return books.filter((b) => !rankedIds.has(b.id));
  }, [books, ranked]);

  const { writeContract } = useWriteContract();

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!isConnected || !publicClient || !walletClient) {
        if (!cancelled) {
          setIsCofheReady(false);
          setCofheInitError("");
        }
        return;
      }

      if (!cancelled) {
        setCofheInitError("");
      }

      try {
        await connectCofhe(publicClient, walletClient);
        if (!cancelled) {
          setIsCofheReady(true);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setIsCofheReady(false);
          setCofheInitError(
            "encryption runtime is still initializing. keep wallet open and retry in a moment.",
          );
        }
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [isConnected, publicClient, walletClient]);

  const moveToRanked = (book: Book) => {
    setRanked((prev) => {
      if (prev.some((b) => b.id === book.id)) return prev;
      return [...prev, book];
    });
  };

  const removeFromRanked = (book: Book) => {
    setRanked((prev) => prev.filter((b) => b.id !== book.id));
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...ranked];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setRanked(next);
  };

  const moveDown = (index: number) => {
    if (index === ranked.length - 1) return;
    const next = [...ranked];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setRanked(next);
  };

  const handleVote = async () => {
    if (!publicClient || !walletClient) return;
    if (!isCofheReady) {
      setVoteError(
        "encryption runtime is not ready yet. please wait a moment and try again.",
      );
      return;
    }
    if (ranked.length !== books.length) return;

    try {
      setIsEncrypting(true);
      setVoteError("");
      setEncryptStep("encrypting your rankings...");
      const rankArray = new Array(books.length).fill(0);
      ranked.forEach((book, position) => {
        rankArray[book.id] = position + 1;
      });

      const encrypted = await encryptRankings(rankArray);
      type SubmitVoteRank = {
        ctHash: bigint;
        securityZone: number;
        utype: number;
        signature: `0x${string}`;
      };
      const encryptedRanks: SubmitVoteRank[] = encrypted.map((item) => ({
        ctHash: item.ctHash,
        securityZone: item.securityZone,
        utype: item.utype,
        signature: (item.signature.startsWith("0x")
          ? item.signature
          : `0x${item.signature}`) as `0x${string}`,
      }));

      setEncryptStep("submitting to contract...");
      writeContract(
        {
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: "submitVote",
          args: [encryptedRanks],
        },
        {
          onSuccess: () => {
            setDone(true);
            setIsEncrypting(false);
          },
          onError: () => {
            setIsEncrypting(false);
            setEncryptStep("");
          },
        },
      );
    } catch (e) {
      console.error(e);
      setIsEncrypting(false);
      setEncryptStep("");
      setVoteError(
        "encryption setup timed out. please retry in a few seconds after wallet/network is ready.",
      );
    }
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
              PHASE 02
            </span>
            <span className="text-[10px] font-mono tracking-[0.3em] text-fhenix-muted flex items-center gap-1.5">
              <Lock size={9} /> CLIENT-SIDE ENCRYPTION
            </span>
          </div>
          <h1 className="text-4xl font-mono font-bold tracking-tight text-fhenix-white">
            Cast Your Vote
          </h1>
          <p className="text-fhenix-muted text-sm mt-2 max-w-sm leading-relaxed">
            Rankings are fully sealed before hitting the network.{" "}
            <span className="text-fhenix-purple/70">
              Nobody tracking the chain can decrypt your picks.
            </span>
          </p>
        </motion.div>

        {/* Not connected state */}
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

        {/* Voted or success state */}
        <AnimatePresence>
          {(hasVoted || done) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="border border-fhenix-cyan/30 bg-fhenix-cyan/5 px-6 py-5 mb-8 flex items-center gap-3"
            >
              <CheckCircle2 size={16} className="text-fhenix-cyan shrink-0" />
              <div>
                <p className="text-sm text-fhenix-cyan font-mono">
                  encrypted vote has been submitted
                </p>
                <p className="text-[10px] text-fhenix-muted mt-0.5">
                  your private cryptographic ballot is securely processed
                  on-chain
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main voting pipeline */}
        {isConnected && !hasVoted && !done && (
          <>
            {/* Ranked List */}
            <motion.div
              custom={1}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="mb-8"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono tracking-[0.2em] text-fhenix-muted flex items-center gap-2">
                  <ListOrdered size={12} className="text-fhenix-cyan/40" />
                  YOUR RANKING
                </span>
                <span className="text-[10px] font-mono text-fhenix-cyan/50 border border-fhenix-navy px-2 py-0.5">
                  {ranked.length} / {books.length} RANKED
                </span>
              </div>

              {ranked.length === 0 ? (
                <div className="border border-dashed border-fhenix-navy bg-fhenix-card/30 px-4 py-8 text-center text-fhenix-muted/60 text-xs font-mono">
                  select items from the unranked pool below to build your
                  priority ballot
                </div>
              ) : (
                <div className="space-y-1.5">
                  {ranked.map((book, i) => (
                    <div
                      key={book.id}
                      className="flex items-center gap-4 border border-fhenix-navy bg-fhenix-card px-4 py-3 group hover:border-fhenix-cyan/20 transition-colors"
                    >
                      <span className="text-xs font-mono text-fhenix-cyan/60 w-4 font-bold">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-mono text-fhenix-white truncate">
                          {book.title}
                        </div>
                        <div className="text-xs text-fhenix-muted truncate mt-0.5">
                          {book.author}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => moveUp(i)}
                          disabled={i === 0}
                          className="p-1.5 text-fhenix-muted hover:text-fhenix-cyan disabled:opacity-20 disabled:hover:text-fhenix-muted transition-colors"
                          title="Move up"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          onClick={() => moveDown(i)}
                          disabled={i === ranked.length - 1}
                          className="p-1.5 text-fhenix-muted hover:text-fhenix-cyan disabled:opacity-20 disabled:hover:text-fhenix-muted transition-colors"
                          title="Move down"
                        >
                          <ArrowDown size={13} />
                        </button>
                        <button
                          onClick={() => removeFromRanked(book)}
                          className="p-1.5 text-fhenix-muted hover:text-fhenix-orange ml-1 transition-colors"
                          title="Remove from ballot"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Unranked Pool */}
            <AnimatePresence>
              {unranked.length > 0 && (
                <motion.div
                  custom={2}
                  variants={fadeUp}
                  initial="hidden"
                  animate="show"
                  className="mb-10"
                >
                  <h3 className="text-[10px] font-mono tracking-[0.2em] text-fhenix-muted mb-3">
                    UNRANKED POOL
                  </h3>
                  <div className="space-y-1.5">
                    {unranked.map((book) => (
                      <button
                        key={book.id}
                        onClick={() => moveToRanked(book)}
                        className="w-full flex items-center justify-between border border-fhenix-navy bg-fhenix-card/50 hover:bg-fhenix-card hover:border-fhenix-cyan/30 px-4 py-3 text-left transition-all group"
                      >
                        <div className="min-w-0 flex-1 pr-4">
                          <div className="text-sm font-mono text-fhenix-white/80 group-hover:text-fhenix-white transition-colors truncate">
                            {book.title}
                          </div>
                          <div className="text-xs text-fhenix-muted/70 truncate mt-0.5">
                            {book.author}
                          </div>
                        </div>
                        <span className="text-[10px] font-mono border border-fhenix-navy text-fhenix-muted group-hover:text-fhenix-cyan group-hover:border-fhenix-cyan/40 px-2 py-1 transition-colors flex items-center gap-1 shrink-0">
                          <Plus size={10} /> RANK
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action Trigger */}
            <motion.div
              custom={3}
              variants={fadeUp}
              initial="hidden"
              animate="show"
            >
              <button
                onClick={handleVote}
                disabled={
                  isEncrypting ||
                  !isCofheReady ||
                  ranked.length !== books.length ||
                  books.length === 0
                }
                className="group relative w-full border border-fhenix-cyan text-fhenix-cyan py-3.5 text-xs font-mono tracking-[0.2em] hover:bg-fhenix-cyan hover:text-fhenix-bg transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed overflow-hidden flex items-center justify-center gap-2"
              >
                <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                <Fingerprint size={12} />
                {isEncrypting
                  ? encryptStep.toUpperCase()
                  : "ENCRYPT & SUBMIT VOTE"}
              </button>

              {ranked.length !== books.length && books.length > 0 && (
                <p className="text-[10px] font-mono text-fhenix-muted text-center mt-3 tracking-wide">
                  MUST RANK ALL {books.length} BOOKS TO COMPLETE SUBMISSION
                  PIPELINE
                </p>
              )}
              {voteError && (
                <p className="text-[10px] font-mono text-fhenix-orange text-center mt-3 tracking-wide">
                  {voteError}
                </p>
              )}
              {cofheInitError && !voteError && (
                <p className="text-[10px] font-mono text-fhenix-orange text-center mt-3 tracking-wide">
                  {cofheInitError}
                </p>
              )}
              {!cofheInitError && !isCofheReady && (
                <p className="text-[10px] font-mono text-fhenix-muted text-center mt-3 tracking-wide">
                  INITIALIZING ENCRYPTION RUNTIME...
                </p>
              )}
            </motion.div>
          </>
        )}
      </main>
    </div>
  );
}
