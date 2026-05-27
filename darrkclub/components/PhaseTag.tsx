"use client";

import { useReadContract } from "wagmi";
import { CONTRACT_ADDRESS, ABI } from "@/lib/contract";
import { motion, AnimatePresence } from "framer-motion";

const PHASE_CONFIG: Record<
  string,
  { border: string; text: string; bg: string; dot: string; pulse: boolean }
> = {
  Nomination: {
    border: "border-fhenix-orange/60",
    text: "text-fhenix-orange",
    bg: "bg-fhenix-orange/5",
    dot: "bg-fhenix-orange",
    pulse: true,
  },
  Voting: {
    border: "border-fhenix-cyan/60",
    text: "text-fhenix-cyan",
    bg: "bg-fhenix-cyan/5",
    dot: "bg-fhenix-cyan",
    pulse: true,
  },
  Closed: {
    border: "border-fhenix-navy",
    text: "text-fhenix-muted",
    bg: "bg-transparent",
    dot: "bg-fhenix-muted",
    pulse: false,
  },
};

const FALLBACK = {
  border: "border-fhenix-navy",
  text: "text-fhenix-muted",
  bg: "bg-transparent",
  dot: "bg-fhenix-navy",
  pulse: false,
};

export function PhaseTag() {
  const { data: phase } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "getPhase",
  });

  const phase_str = (phase as string) ?? "...";
  const config = PHASE_CONFIG[phase_str] ?? FALLBACK;

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={phase_str}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        className={`
          inline-flex items-center gap-1.5
          text-[10px] font-mono tracking-[0.2em]
          border px-2.5 py-1
          ${config.border} ${config.text} ${config.bg}
        `}
      >
        {/* live dot */}
        <span className="relative flex h-1.5 w-1.5">
          {config.pulse && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${config.dot}`}
            />
          )}
          <span
            className={`relative inline-flex rounded-full h-1.5 w-1.5 ${config.dot}`}
          />
        </span>

        {phase_str === "..." ? "···" : phase_str.toUpperCase()}
      </motion.span>
    </AnimatePresence>
  );
}
