"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletConnect } from "./WalletConnect";
import { PhaseTag } from "./PhaseTag";
import { NetworkSwitcher } from "./NetworkSwitcher";
import { useReadContract, usePublicClient, useWalletClient } from "wagmi";
import {
  VAULTIS_LENS_ADDRESS,
  VAULTIS_LENS_ABI,
  GOVERNANCE_TOKEN_ADDRESS,
  GOVERNANCE_TOKEN_ABI,
} from "@/lib/config/contract";
import { motion, AnimatePresence } from "framer-motion";
import { parseGwei } from "viem";
import {
  Home,
  FileText,
  Vote,
  BarChart2,
  Menu,
  X,
  ShieldCheck,
  Coins,
  Droplets,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useAccount } from "wagmi";
import { formatEther } from "viem";

const NAV_LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/propose", label: "Propose", icon: FileText },
  { href: "/vote", label: "Vote", icon: Vote },
  { href: "/result", label: "Results", icon: BarChart2 },
];

// ─── Contract countdown hook ──────────────────────────────────────────────────
function useContractCountdown() {
  const { data } = useReadContract({
    address: VAULTIS_LENS_ADDRESS,
    abi: VAULTIS_LENS_ABI,
    functionName: "getTimeUntilNextPhase",
    query: { refetchInterval: 30_000 },
  });

  const { data: currentPhase } = useReadContract({
    address: VAULTIS_LENS_ADDRESS,
    abi: VAULTIS_LENS_ABI,
    functionName: "getCurrentPhase",
    query: { refetchInterval: 30_000 },
  });

  type PhaseResult = readonly [string, bigint];
  const contractSeconds = data ? Number((data as PhaseResult)[1]) : null;
  const nextPhaseLabel = data ? (data as PhaseResult)[0] : "";
  const phase = (currentPhase as string | undefined) ?? "";

  const [remaining, setRemaining] = useState<number | null>(null);
  const seedRef = useRef<number | null>(null);

  useEffect(() => {
    if (contractSeconds === null) return;
    if (
      seedRef.current === null ||
      Math.abs(contractSeconds - (remaining ?? 0)) > 2
    ) {
      seedRef.current = contractSeconds;
      setRemaining(contractSeconds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractSeconds]);

  useEffect(() => {
    if (remaining === null || remaining <= 0) return;
    const id = setTimeout(
      () => setRemaining((r) => (r !== null ? r - 1 : 0)),
      1_000
    );
    return () => clearTimeout(id);
  }, [remaining]);

  const activePhase =
    phase === "Proposal" || phase === "Voting" || phase === "Veto";
  const expired = remaining !== null && remaining <= 0 && activePhase;

  return { remaining, nextPhaseLabel, phase, expired };
}

// ─── Token balance + faucet hook ─────────────────────────────────────────────
function useGovernanceToken() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [claimSuccess, setClaimSuccess] = useState(false);

  const { data: balance, refetch: refetchBalance } = useReadContract({
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
    query: { enabled: !!address },
  });

  const { data: claimData, refetch: refetchClaim } = useReadContract({
    address: GOVERNANCE_TOKEN_ADDRESS,
    abi: GOVERNANCE_TOKEN_ABI,
    functionName: "canClaim",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  const [eligible, cooldownEndsAt] = (claimData as
    | [boolean, bigint]
    | undefined) ?? [false, 0n];

  const hoursLeft = cooldownEndsAt
    ? Math.max(
        0,
        Math.ceil((Number(cooldownEndsAt) - Date.now() / 1000) / 3600)
      )
    : 0;

  const hasNoTokens =
    !!address && balance !== undefined && (balance as bigint) === 0n;

  const handleClaim = async () => {
    if (!walletClient || !publicClient) return;
    setIsClaiming(true);
    setClaimError("");
    setClaimSuccess(false);
    try {
      const feeData = await publicClient.estimateFeesPerGas();
      const hash = await walletClient.writeContract({
        address: GOVERNANCE_TOKEN_ADDRESS,
        abi: GOVERNANCE_TOKEN_ABI,
        functionName: "faucet",
        account: walletClient.account,
        maxFeePerGas: feeData.maxFeePerGas
          ? feeData.maxFeePerGas * 2n
          : parseGwei("100"),
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? parseGwei("2"),
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setClaimSuccess(true);
      await refetchBalance();
      await refetchClaim();
    } catch (e: any) {
      setClaimError(e?.shortMessage ?? e?.message ?? "Claim failed");
    } finally {
      setIsClaiming(false);
    }
  };

  const formattedBalance =
    balance !== undefined
      ? parseFloat(formatEther(balance as bigint)).toFixed(2)
      : null;

  return {
    formattedBalance,
    symbol: (symbol as string | undefined) ?? "VLT",
    eligible: eligible as boolean,
    hoursLeft,
    hasNoTokens,
    isClaiming,
    claimError,
    claimSuccess,
    handleClaim,
  };
}

// ─── Faucet popup ─────────────────────────────────────────────────────────────
function FaucetPopup({
  symbol,
  isClaiming,
  claimError,
  claimSuccess,
  onClaim,
  onDismiss,
}: {
  symbol: string;
  isClaiming: boolean;
  claimError: string;
  claimSuccess: boolean;
  onClaim: () => void;
  onDismiss: () => void;
}) {
  return (
    <AnimatePresence>
      <motion.div
        key="faucet-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
        onClick={onDismiss}
      >
        <motion.div
          key="faucet-modal"
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm border border-fhenix-cyan/30 bg-fhenix-bg p-8 flex flex-col items-center gap-5 text-center"
        >
          {/* Icon */}
          <div className="w-12 h-12 rounded-full border border-fhenix-cyan/30 flex items-center justify-center bg-fhenix-cyan/5">
            <Droplets size={22} className="text-fhenix-cyan" />
          </div>

          {/* Heading */}
          <div>
            <div className="text-[10px] font-mono tracking-[0.3em] text-fhenix-cyan/50 mb-2">
              GOVERNANCE ACCESS
            </div>
            <h2 className="text-lg font-mono font-bold text-fhenix-white">
              You have no {symbol}
            </h2>
            <p className="text-xs font-mono text-fhenix-muted mt-2 leading-relaxed max-w-[260px]">
              You need <span className="text-fhenix-cyan">{symbol}</span> tokens
              to submit proposals and vote. Claim 10 free tokens from the
              testnet faucet.
            </p>
          </div>

          {/* Error */}
          {claimError && (
            <p className="text-[10px] font-mono text-red-400 max-w-[260px]">
              {claimError}
            </p>
          )}

          {/* Success */}
          {claimSuccess ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-[11px] font-mono text-fhenix-cyan">
                ✓ 10 {symbol} claimed successfully
              </p>
              <button
                onClick={onDismiss}
                className="border border-fhenix-navy text-fhenix-muted px-5 py-2 text-[10px] font-mono tracking-widest hover:border-fhenix-cyan/30 hover:text-fhenix-white transition-all duration-200"
              >
                CLOSE
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 w-full">
              <motion.button
                onClick={onClaim}
                disabled={isClaiming}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full border border-fhenix-cyan text-fhenix-cyan py-2.5 text-[11px] font-mono tracking-widest hover:bg-fhenix-cyan hover:text-fhenix-bg transition-all duration-200 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Droplets size={12} />
                {isClaiming ? "CLAIMING..." : `OKAY — GET 10 ${symbol}`}
              </motion.button>
              <button
                onClick={onDismiss}
                className="w-full border border-fhenix-navy text-fhenix-muted/50 py-2 text-[10px] font-mono tracking-widest hover:text-fhenix-muted transition-all duration-200"
              >
                DISMISS
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── NavLink ──────────────────────────────────────────────────────────────────
function NavLink({
  href,
  label,
  icon: Icon,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`
        group relative flex items-center gap-1.5
        text-[11px] font-mono tracking-[0.18em] uppercase
        transition-colors duration-200
        ${
          active
            ? "text-fhenix-cyan"
            : "text-fhenix-white/60 hover:text-fhenix-white"
        }
      `}
    >
      <Icon
        size={12}
        strokeWidth={1.75}
        className={`transition-colors duration-200 ${
          active ? "text-fhenix-cyan" : "group-hover:text-fhenix-cyan/70"
        }`}
      />
      {label}
      {active && (
        <motion.span
          layoutId="nav-underline"
          className="absolute -bottom-1 left-0 right-0 h-px bg-fhenix-cyan"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
    </Link>
  );
}

// ─── Countdown pill ───────────────────────────────────────────────────────────
function CountdownPill({
  remaining,
  nextPhaseLabel,
  className,
}: {
  remaining: number | null;
  nextPhaseLabel: string;
  className?: string;
}) {
  if (remaining === null || remaining <= 0 || nextPhaseLabel === "")
    return null;

  const urgent = remaining <= 60;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <motion.div
      animate={urgent ? { scale: [1, 1.05, 1] } : {}}
      transition={{ repeat: Infinity, duration: 0.8 }}
      className={`
        flex items-center gap-1.5 font-mono text-[10px] tracking-widest
        px-2 py-1 border rounded-sm
        ${
          urgent
            ? "border-red-500/70 text-red-400 bg-red-500/10"
            : "border-fhenix-navy/60 text-fhenix-white/40"
        }
        ${className ?? ""}
      `}
    >
      <span className={urgent ? "animate-pulse" : ""}>⏱</span>
      {mm}:{ss}
    </motion.div>
  );
}

// ─── Token balance pill ───────────────────────────────────────────────────────
function TokenBalancePill({
  formattedBalance,
  symbol,
  eligible,
  hoursLeft,
  isClaiming,
  onClaim,
}: {
  formattedBalance: string | null;
  symbol: string;
  eligible: boolean;
  hoursLeft: number;
  isClaiming: boolean;
  onClaim: () => void;
}) {
  if (formattedBalance === null) return null;

  return (
    <div className="flex items-center gap-2">
      {/* Balance */}
      <div className="flex items-center gap-1.5 border border-fhenix-navy bg-fhenix-card px-2.5 py-1 text-[10px] font-mono">
        <Coins size={9} className="text-fhenix-cyan/50" />
        <span className="text-fhenix-white tabular-nums">
          {formattedBalance}
        </span>
        <span className="text-fhenix-muted/50">{symbol}</span>
      </div>

      {/* Faucet */}
      {eligible ? (
        <motion.button
          onClick={onClaim}
          disabled={isClaiming}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-1 border border-fhenix-cyan/50 text-fhenix-cyan px-2.5 py-1 text-[10px] font-mono tracking-widest hover:bg-fhenix-cyan hover:text-fhenix-bg transition-all duration-200 disabled:opacity-40"
        >
          <Droplets size={9} />
          {isClaiming ? "..." : "+10"}
        </motion.button>
      ) : (
        <div className="flex items-center gap-1 border border-fhenix-navy px-2.5 py-1 text-[10px] font-mono text-fhenix-muted/30">
          <Droplets size={9} />
          {hoursLeft}h
        </div>
      )}
    </div>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
export function Navbar() {
  const [open, setOpen] = useState(false);
  const [popupDismissed, setPopupDismissed] = useState(false);
  const { remaining, nextPhaseLabel, expired } = useContractCountdown();
  const urgent = remaining !== null && remaining <= 60;
  const { address } = useAccount();

  const {
    formattedBalance,
    symbol,
    eligible,
    hoursLeft,
    hasNoTokens,
    isClaiming,
    claimError,
    claimSuccess,
    handleClaim,
  } = useGovernanceToken();

  // Reset dismissed state when wallet changes
  useEffect(() => {
    setPopupDismissed(false);
  }, [address]);

  const showFaucetPopup = hasNoTokens && !popupDismissed;

  return (
    <>
      {/* ── Faucet popup ──────────────────────────────── */}
      {showFaucetPopup && (
        <FaucetPopup
          symbol={symbol}
          isClaiming={isClaiming}
          claimError={claimError}
          claimSuccess={claimSuccess}
          onClaim={handleClaim}
          onDismiss={() => setPopupDismissed(true)}
        />
      )}

      <motion.nav
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-fhenix-navy bg-fhenix-bg/80 backdrop-blur-md sticky top-0 z-50"
      >
        {/* ── Left: brand ────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ rotate: -8, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Image src="/logo.png" alt="Vaultis" width={28} height={28} />
          </motion.div>

          <Link href="/" className="group flex items-center gap-3">
            <span className="text-xs font-mono font-bold tracking-[0.25em] text-fhenix-white group-hover:text-fhenix-cyan transition-colors duration-300">
              VAULTIS
            </span>
            <span className="hidden sm:inline text-[10px] font-mono text-fhenix-navy border border-fhenix-navy px-1.5 py-0.5 tracking-widest group-hover:border-fhenix-cyan/40 group-hover:text-fhenix-cyan/60 transition-all duration-300">
              PRIVATE TREASURY
            </span>
          </Link>

          <div className="w-px h-4 bg-fhenix-navy mx-1" />
          <PhaseTag />
        </div>

        {/* ── Centre: desktop nav links ──────────────────── */}
        <div className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((l) => (
            <NavLink key={l.href} {...l} />
          ))}
        </div>

        {/* ── Right: controls ────────────────────────────── */}
        <div className="flex items-center gap-3">
          <CountdownPill
            remaining={remaining}
            nextPhaseLabel={nextPhaseLabel}
            className="hidden sm:flex"
          />

          <div className="hidden md:flex items-center gap-3">
            {/* Token balance + faucet */}
            <TokenBalancePill
              formattedBalance={formattedBalance}
              symbol={symbol}
              eligible={eligible}
              hoursLeft={hoursLeft}
              isClaiming={isClaiming}
              onClaim={handleClaim}
            />

            <div className="w-px h-4 bg-fhenix-navy" />
            <NetworkSwitcher />
            <div className="w-px h-4 bg-fhenix-navy" />
            <WalletConnect />
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            className="md:hidden text-fhenix-white/60 hover:text-fhenix-white transition-colors"
          >
            {open ? (
              <X size={18} strokeWidth={1.5} />
            ) : (
              <Menu size={18} strokeWidth={1.5} />
            )}
          </button>
        </div>
      </motion.nav>

      {/* ── Phase-expired reload prompt ─────────────────── */}
      <AnimatePresence>
        {expired && (
          <motion.div
            key="reload-prompt"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="sticky top-[57px] z-40 flex items-center justify-between gap-4 px-5 py-2.5 bg-fhenix-bg border-b border-fhenix-cyan/30 text-[11px] font-mono"
          >
            <span className="text-fhenix-cyan/70 tracking-widest flex items-center gap-2">
              <ShieldCheck size={11} />
              PHASE ENDED — RELOAD TO SEE UPDATED STATE
            </span>
            <button
              onClick={() => window.location.reload()}
              className="border border-fhenix-cyan text-fhenix-cyan px-3 py-1 tracking-widest hover:bg-fhenix-cyan hover:text-fhenix-bg transition-all duration-200"
            >
              RELOAD
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mobile drawer ───────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="md:hidden overflow-hidden border-b border-fhenix-navy bg-fhenix-bg/95 backdrop-blur-md z-40"
          >
            <div className="flex flex-col gap-1 px-5 py-4">
              {NAV_LINKS.map((l, i) => (
                <motion.div
                  key={l.href}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <NavLink {...l} onClick={() => setOpen(false)} />
                </motion.div>
              ))}

              <div className="my-3 h-px bg-fhenix-navy" />

              {/* Countdown in mobile drawer */}
              {remaining !== null && remaining > 0 && nextPhaseLabel !== "" && (
                <div
                  className={`flex items-center gap-2 font-mono text-[10px] tracking-widest mb-3 ${
                    urgent ? "text-red-400" : "text-fhenix-white/40"
                  }`}
                >
                  <span>UNTIL {nextPhaseLabel.toUpperCase()}</span>
                  <span
                    className={`tabular-nums ${urgent ? "animate-pulse" : ""}`}
                  >
                    {String(Math.floor((remaining ?? 0) / 60)).padStart(2, "0")}
                    :{String((remaining ?? 0) % 60).padStart(2, "0")}
                  </span>
                </div>
              )}

              {/* Token balance in mobile drawer */}
              <div className="mb-3">
                <TokenBalancePill
                  formattedBalance={formattedBalance}
                  symbol={symbol}
                  eligible={eligible}
                  hoursLeft={hoursLeft}
                  isClaiming={isClaiming}
                  onClaim={handleClaim}
                />
              </div>

              <div className="flex flex-col gap-3">
                <NetworkSwitcher />
                <WalletConnect />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
