"use client";

import { useReadContract } from "wagmi";
import { VAULTIS_LENS_ADDRESS, VAULTIS_LENS_ABI } from "@/lib/config/contract";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

const PHASE_CONFIG: Record<
  string,
  { border: string; text: string; bg: string; dot: string; pulse: boolean }
> = {
  Proposal: {
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
  Tally: {
    border: "border-fhenix-purple/60",
    text: "text-fhenix-purple",
    bg: "bg-fhenix-purple/5",
    dot: "bg-fhenix-purple",
    pulse: true,
  },
  Veto: {
    border: "border-red-500/50",
    text: "text-red-400",
    bg: "bg-red-500/5",
    dot: "bg-red-400",
    pulse: true,
  },
  Executed: {
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

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0)
    return `${String(h).padStart(2, "0")}:${String(m).padStart(
      2,
      "0"
    )}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// All reads here go through VaultisLens — getCurrentPhase and
// getTimeUntilNextPhase live there now, not on the core Vaultis contract.
export function PhaseTag() {
  const { data: phase } = useReadContract({
    address: VAULTIS_LENS_ADDRESS,
    abi: VAULTIS_LENS_ABI,
    functionName: "getCurrentPhase",
  });

  const { data: timerData } = useReadContract({
    address: VAULTIS_LENS_ADDRESS,
    abi: VAULTIS_LENS_ABI,
    functionName: "getTimeUntilNextPhase",
  });

  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!timerData) return;
    const [, secs] = timerData as [string, bigint];
    const n = Number(secs);
    if (n > 0) setSecondsLeft(n);
  }, [timerData]);

  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return;
    const id = setInterval(
      () => setSecondsLeft((s) => (s !== null && s > 0 ? s - 1 : 0)),
      1000
    );
    return () => clearInterval(id);
  }, [secondsLeft]);

  const phase_str = (phase as string) ?? "...";
  const config = PHASE_CONFIG[phase_str] ?? FALLBACK;
  const nextPhase = timerData ? (timerData as [string, bigint])[0] : null;

  const showTimer =
    secondsLeft !== null &&
    secondsLeft > 0 &&
    nextPhase &&
    phase_str !== "..." &&
    phase_str !== "Executed";

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={phase_str}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        className={`
          inline-flex items-center gap-2
          text-[10px] font-mono tracking-[0.2em]
          border px-2.5 py-1
          ${config.border} ${config.text} ${config.bg}
        `}
      >
        <span className="relative flex h-1.5 w-1.5 shrink-0">
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

        {showTimer && (
          <>
            <span className="opacity-20">|</span>
            <span className="opacity-60 tabular-nums">
              {formatCountdown(secondsLeft!)}
            </span>
            <span className="opacity-30 normal-case tracking-normal">
              → {nextPhase}
            </span>
          </>
        )}
      </motion.span>
    </AnimatePresence>
  );
}
