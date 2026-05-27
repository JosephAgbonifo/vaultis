"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { CONTRACT_ADDRESS, ABI } from "@/lib/contract";
import { Navbar } from "@/components/NavBar";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  BookMarked,
  UserPlus,
  CheckCircle2,
  ShieldCheck,
  Feather,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: "easeOut" as const },
  }),
};

export default function NominatePage() {
  const { address, isConnected } = useAccount();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [joinTxHash, setJoinTxHash] = useState<`0x${string}` | undefined>();

  const { data: isMember, refetch: refetchMember } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "members",
    args: [address!],
    query: { enabled: !!address },
  });

  const { data: hasNominated } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "hasNominated",
    args: [address!],
    query: { enabled: !!address },
  });

  const { data: books } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "getAllBooks",
  });

  const { writeContract, isPending } = useWriteContract();

  const { isLoading: isJoining } = useWaitForTransactionReceipt({
    hash: joinTxHash,
    query: { enabled: !!joinTxHash },
    onReplaced: () => refetchMember(),
  });

  useWaitForTransactionReceipt({
    hash: joinTxHash,
    query: { enabled: !!joinTxHash },
  });

  const handleJoin = () => {
    writeContract(
      { address: CONTRACT_ADDRESS, abi: ABI, functionName: "joinClub" },
      {
        onSuccess: (hash) => setJoinTxHash(hash),
        onError: (err) => console.error("Join error:", err),
      },
    );
  };

  const handleNominate = () => {
    if (!title || !author) return;
    writeContract(
      {
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "nominateBook",
        args: [title, author],
      },
      {
        onSuccess: () => {
          setSubmitted(true);
          setTitle("");
          setAuthor("");
        },
      },
    );
  };

  type AllBooksReturn = readonly [string[], string[]];
  const titles = (books as AllBooksReturn | undefined)?.[0] ?? [];
  const authors = (books as AllBooksReturn | undefined)?.[1] ?? [];
  const member = isMember === true;
  const nominated = hasNominated === true;
  const joiningInProgress = isPending || isJoining;

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
              PHASE 01
            </span>
            <span className="text-[10px] font-mono tracking-[0.3em] text-fhenix-muted flex items-center gap-1.5">
              <Lock size={9} /> ANONYMOUS
            </span>
          </div>
          <h1 className="text-4xl font-mono font-bold tracking-tight text-fhenix-white">
            Nominations
          </h1>
          <p className="text-fhenix-muted text-sm mt-2 max-w-sm leading-relaxed">
            Your pick is encrypted on-chain.{" "}
            <span className="text-fhenix-purple/70">
              No one sees who nominated what.
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
              className="border border-fhenix-navy bg-fhenix-card px-6 py-5 text-fhenix-muted text-sm mb-8 flex items-center gap-3"
            >
              <Lock size={14} className="text-fhenix-cyan/40 shrink-0" />
              connect your wallet to participate
            </motion.div>
          )}
        </AnimatePresence>

        {/* Not a member */}
        <AnimatePresence>
          {isConnected && !member && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="border border-fhenix-orange/30 bg-fhenix-orange/5 px-6 py-5 mb-8"
            >
              <p className="text-sm text-fhenix-white/70 mb-4 flex items-center gap-2">
                <UserPlus size={14} className="text-fhenix-orange/60" />
                you&apos;re not a member yet
              </p>
              <motion.button
                onClick={handleJoin}
                disabled={joiningInProgress}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 text-xs font-mono tracking-widest border border-fhenix-orange/50 text-fhenix-orange px-5 py-2.5 hover:bg-fhenix-orange hover:text-fhenix-bg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <UserPlus size={11} />
                {isPending
                  ? "confirm in wallet..."
                  : isJoining
                    ? "joining..."
                    : "join the club"}
              </motion.button>
              {joinTxHash && isJoining && (
                <p className="text-[10px] font-mono text-fhenix-muted mt-3">
                  tx: {joinTxHash.slice(0, 10)}···{joinTxHash.slice(-6)}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Nomination form */}
        <AnimatePresence>
          {isConnected && member && !nominated && !submitted && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="border border-fhenix-navy bg-fhenix-card px-6 py-6 mb-8"
            >
              <div className="flex items-center gap-2 mb-6">
                <ShieldCheck size={13} className="text-fhenix-cyan/50" />
                <p className="text-[10px] font-mono tracking-[0.2em] text-fhenix-muted">
                  YOUR NOMINATION · FHE ENCRYPTED
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="text-[10px] font-mono text-fhenix-muted block mb-2 tracking-[0.2em]">
                    BOOK TITLE
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. The Left Hand of Darkness"
                    className="w-full bg-fhenix-bg border border-fhenix-navy text-fhenix-white text-sm font-mono px-4 py-3 focus:outline-none focus:border-fhenix-cyan/50 placeholder:text-fhenix-navy transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-fhenix-muted block mb-2 tracking-[0.2em]">
                    AUTHOR
                  </label>
                  <input
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="e.g. Ursula K. Le Guin"
                    className="w-full bg-fhenix-bg border border-fhenix-navy text-fhenix-white text-sm font-mono px-4 py-3 focus:outline-none focus:border-fhenix-cyan/50 placeholder:text-fhenix-navy transition-colors"
                  />
                </div>

                <motion.button
                  onClick={handleNominate}
                  disabled={isPending || !title || !author}
                  whileHover={{ scale: 1.005 }}
                  whileTap={{ scale: 0.98 }}
                  className="group relative w-full border border-fhenix-cyan text-fhenix-cyan py-3 text-xs font-mono tracking-[0.2em] hover:bg-fhenix-cyan hover:text-fhenix-bg transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed overflow-hidden mt-1 flex items-center justify-center gap-2"
                >
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                  <Feather size={11} />
                  {isPending ? "confirm in wallet..." : "SUBMIT NOMINATION"}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success state */}
        <AnimatePresence>
          {(nominated || submitted) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="border border-fhenix-cyan/30 bg-fhenix-cyan/5 px-6 py-5 mb-8 flex items-center gap-3"
            >
              <CheckCircle2 size={16} className="text-fhenix-cyan shrink-0" />
              <div>
                <p className="text-sm text-fhenix-cyan font-mono">
                  nomination submitted
                </p>
                <p className="text-[10px] text-fhenix-muted mt-0.5">
                  encrypted and recorded on-chain anonymously
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Books list */}
        <motion.div
          custom={5}
          variants={fadeUp}
          initial="hidden"
          animate="show"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-mono tracking-[0.2em] text-fhenix-muted flex items-center gap-2">
              <BookMarked size={11} className="text-fhenix-cyan/40" />
              NOMINATED BOOKS
            </span>
            <span className="text-[10px] font-mono text-fhenix-cyan/50 border border-fhenix-navy px-2 py-0.5">
              {titles.length} TOTAL
            </span>
          </div>

          {titles.length === 0 ? (
            <div className="border border-fhenix-navy px-4 py-8 text-center text-fhenix-muted text-sm font-mono">
              no nominations yet
            </div>
          ) : (
            <div className="space-y-1.5">
              {titles.map((t: string, i: number) => (
                <motion.div
                  key={i}
                  custom={i}
                  variants={fadeUp}
                  initial="hidden"
                  animate="show"
                  className="flex items-center justify-between border border-fhenix-navy bg-fhenix-card px-4 py-3 hover:border-fhenix-cyan/20 transition-colors group"
                >
                  <div>
                    <div className="text-sm font-mono text-fhenix-white group-hover:text-fhenix-cyan/90 transition-colors">
                      {t}
                    </div>
                    <div className="text-xs text-fhenix-muted mt-0.5">
                      {authors[i]}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-fhenix-navy group-hover:text-fhenix-cyan/30 transition-colors">
                    #{String(i + 1).padStart(2, "0")}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
