"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletConnect } from "./WalletConnect";
import { NetworkSwitcher } from "./NetworkSwitcher";
import { useReadContract, usePublicClient, useWalletClient } from "wagmi";
import {
  VAULTIS_ADDRESS,
  VAULTIS_ABI,
  GOVERNANCE_TOKEN_ADDRESS,
  GOVERNANCE_TOKEN_ABI,
} from "@/lib/config/contract";
import { motion, AnimatePresence } from "framer-motion";
import { parseGwei } from "viem";
import {
  Home,
  FileText,
  ListChecks,
  Menu,
  X,
  Coins,
  Droplets,
} from "lucide-react";
import { useState, useEffect } from "react";
import Image from "next/image";
import { useAccount } from "wagmi";
import { formatEther } from "viem";

const NAV_LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/propose", label: "Propose", icon: FileText },
  { href: "/proposals", label: "Proposals", icon: ListChecks },
];

// ─── Aurora pulse line — the signature motif, reused across nav/modal edges ──
function AuroraLine({ className = "" }: { className?: string }) {
  return (
    <motion.div
      aria-hidden
      className={`pointer-events-none h-px w-full ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(90deg, transparent, #22d3ee, #a78bfa, #fb923c, transparent)",
        backgroundSize: "200% 100%",
      }}
      animate={{ backgroundPosition: ["0% 50%", "200% 50%"] }}
      transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
    />
  );
}

// ─── Token balance + faucet hook ─────────────────────────────────────────────
// balanceOf/symbol read from the token contract; faucet()/canClaimFaucet()
// now live on Vaultis itself, since the faucet draws from its treasury balance.
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
    address: VAULTIS_ADDRESS,
    abi: VAULTIS_ABI,
    functionName: "canClaimFaucet",
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
        address: VAULTIS_ADDRESS,
        abi: VAULTIS_ABI,
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
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4"
        onClick={onDismiss}
      >
        <motion.div
          key="faucet-modal"
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: "spring", stiffness: 280, damping: 26 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-fhenix-bg/70  p-8 flex flex-col items-center gap-5 text-center shadow-[0_0_60px_-15px_rgba(34,211,238,0.35)]"
        >
          <AuroraLine className="absolute top-0 left-0" />

          <div className="w-14 h-14 rounded-full border border-fhenix-cyan/30 bg-fhenix-cyan/10 flex items-center justify-center shadow-[0_0_30px_-5px_rgba(34,211,238,0.5)]">
            <Droplets size={24} className="text-fhenix-cyan" />
          </div>

          <div>
            <div className="text-[10px] tracking-[0.3em] text-fhenix-cyan/50 mb-2">
              GOVERNANCE ACCESS
            </div>
            <h2 className="text-lg font-bold text-fhenix-white">
              You have no {symbol}
            </h2>
            <p className="text-xs text-fhenix-muted mt-2 leading-relaxed max-w-[260px]">
              You need <span className="text-fhenix-cyan">{symbol}</span> tokens
              to submit proposals and vote. Claim 10 free tokens from the
              treasury faucet.
            </p>
          </div>

          {claimError && (
            <p className="text-[10px] text-red-400 max-w-[260px]">
              {claimError}
            </p>
          )}

          {claimSuccess ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-[11px] text-fhenix-cyan">
                ✓ 10 {symbol} claimed successfully
              </p>
              <button
                onClick={onDismiss}
                className="rounded-lg border border-white/10 text-fhenix-muted px-5 py-2 text-[10px] tracking-widest hover:border-fhenix-cyan/30 hover:text-fhenix-white transition-all duration-200"
              >
                CLOSE
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 w-full">
              <motion.button
                onClick={onClaim}
                disabled={isClaiming}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full rounded-lg border border-fhenix-cyan/60 bg-fhenix-cyan/10 text-fhenix-cyan py-2.5 text-[11px] tracking-widest hover:bg-fhenix-cyan hover:text-fhenix-bg hover:shadow-[0_0_25px_-3px_rgba(34,211,238,0.7)] transition-all duration-200 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Droplets size={12} />
                {isClaiming ? "CLAIMING..." : `OKAY — GET 10 ${symbol}`}
              </motion.button>
              <button
                onClick={onDismiss}
                className="w-full rounded-lg border border-white/5 text-fhenix-muted/50 py-2 text-[10px] tracking-widest hover:text-fhenix-muted transition-all duration-200"
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
      className="group relative flex items-center"
    >
      {active && (
        <motion.span
          layoutId="nav-pill"
          className="absolute inset-0 -mx-3 -my-1.5 rounded-full bg-fhenix-cyan/10 border border-fhenix-cyan/30 shadow-[0_0_20px_-4px_rgba(34,211,238,0.6)]"
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        />
      )}
      <span
        className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 text-[11px] tracking-[0.18em] uppercase transition-colors duration-200 ${
          active
            ? "text-fhenix-cyan"
            : "text-fhenix-white/55 hover:text-fhenix-white"
        }`}
      >
        <Icon
          size={12}
          strokeWidth={1.75}
          className={`transition-colors duration-200 ${
            active ? "text-fhenix-cyan" : "group-hover:text-fhenix-cyan/70"
          }`}
        />
        {label}
      </span>
    </Link>
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
      <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-mono">
        <Coins size={9} className="text-fhenix-cyan/60" />
        <span className="text-fhenix-white tabular-nums">
          {formattedBalance}
        </span>
        <span className="text-fhenix-muted/50">{symbol}</span>
      </div>

      {eligible ? (
        <motion.button
          onClick={onClaim}
          disabled={isClaiming}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.96 }}
          className="flex items-center gap-1 rounded-full border border-fhenix-cyan/50 bg-fhenix-cyan/5 text-fhenix-cyan px-2.5 py-1 text-[10px] tracking-widest hover:bg-fhenix-cyan hover:text-fhenix-bg hover:shadow-[0_0_18px_-3px_rgba(34,211,238,0.7)] transition-all duration-200 disabled:opacity-40"
        >
          <Droplets size={9} />
          {isClaiming ? "..." : "+10"}
        </motion.button>
      ) : (
        <div className="flex items-center gap-1 rounded-full border border-white/5 px-2.5 py-1 text-[10px] text-fhenix-muted/30">
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
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex items-center justify-between px-4 sm:px-6 py-4 bg-fhenix-bg/60 sticky top-0 z-50"
      >
        {/* ── Left: brand ────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ rotate: -8, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="rounded-full p-0.5 shadow-[0_0_16px_-4px_rgba(34,211,238,0.6)]"
          >
            <Image src="/logo.png" alt="Vaultis" width={28} height={28} />
          </motion.div>

          <Link href="/" className="group flex items-center gap-3">
            <span
              className="text-xs font-bold tracking-[0.25em] bg-clip-text text-transparent transition-all duration-300"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #e7faff, #67e8f9, #e7faff)",
              }}
            >
              VAULTIS
            </span>
            <span className="hidden sm:inline text-[10px] text-fhenix-white/30 border border-white/10 rounded-full px-2 py-0.5 tracking-widest group-hover:border-fhenix-cyan/40 group-hover:text-fhenix-cyan/60 transition-all duration-300">
              PRIVATE TREASURY
            </span>
          </Link>
        </div>

        {/* ── Centre: desktop nav links ──────────────────── */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((l) => (
            <NavLink key={l.href} {...l} />
          ))}
        </div>

        {/* ── Right: controls ────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-3">
            <TokenBalancePill
              formattedBalance={formattedBalance}
              symbol={symbol}
              eligible={eligible}
              hoursLeft={hoursLeft}
              isClaiming={isClaiming}
              onClaim={handleClaim}
            />

            <div className="w-px h-4 bg-white/10" />
            <NetworkSwitcher />
            <div className="w-px h-4 bg-white/10" />
            <WalletConnect />
          </div>

          {/* Mobile hamburger */}
          <motion.button
            onClick={() => setOpen((v) => !v)}
            whileTap={{ scale: 0.9 }}
            aria-label="Toggle menu"
            className="md:hidden rounded-full border border-white/10 p-2 text-fhenix-white/60 hover:text-fhenix-white hover:border-fhenix-cyan/30 transition-colors"
          >
            {open ? (
              <X size={16} strokeWidth={1.5} />
            ) : (
              <Menu size={16} strokeWidth={1.5} />
            )}
          </motion.button>
        </div>

        <AuroraLine className="absolute bottom-0 left-0" />
      </motion.nav>

      {/* ── Mobile drawer ───────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="md:hidden overflow-hidden bg-fhenix-bg/80  border-b border-white/10 z-40"
          >
            <div className="flex flex-col gap-1 px-5 py-4">
              {NAV_LINKS.map((l, i) => (
                <motion.div
                  key={l.href}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06, ease: "easeOut" }}
                >
                  <NavLink {...l} onClick={() => setOpen(false)} />
                </motion.div>
              ))}

              <div className="my-3 h-px bg-white/10" />

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
