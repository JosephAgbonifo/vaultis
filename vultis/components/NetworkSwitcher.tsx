"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { useEffect } from "react";
import { arbitrumSepolia } from "wagmi/chains";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Radio } from "lucide-react";

const NETWORKS = [{ chain: arbitrumSepolia, label: "Arb Sepolia" }];

export function NetworkSwitcher() {
  const { chainId, isConnected } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  useEffect(() => {
    if (isConnected && chainId !== arbitrumSepolia.id) {
      switchChain({ chainId: arbitrumSepolia.id });
    }
  }, [isConnected, chainId]);

  if (!isConnected) return null;

  return (
    <div className="flex items-center gap-1">
      {NETWORKS.map(({ chain, label }) => {
        const isActive = chainId === chain.id;
        const isSwitching = isPending && !isActive;

        return (
          <motion.button
            key={chain.id}
            onClick={() => switchChain({ chainId: chain.id })}
            disabled={isActive || isPending}
            whileHover={!isActive && !isPending ? { y: -1 } : {}}
            whileTap={!isActive && !isPending ? { scale: 0.96 } : {}}
            className={`
              relative flex items-center gap-1.5 text-[10px] font-mono tracking-widest
              px-2.5 py-1 border transition-all duration-200
              disabled:cursor-default overflow-hidden
              ${
                isActive
                  ? "border-fhenix-cyan text-fhenix-cyan bg-fhenix-cyan/5"
                  : "border-fhenix-navy text-fhenix-muted hover:border-fhenix-cyan/40 hover:text-fhenix-white bg-transparent"
              }
            `}
          >
            {/* active glow line at bottom */}
            {isActive && (
              <motion.span
                layoutId="network-indicator"
                className="absolute bottom-0 left-0 right-0 h-px bg-fhenix-cyan"
              />
            )}

            <AnimatePresence mode="wait">
              {isActive ? (
                <motion.span
                  key="dot"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-1 h-1 rounded-full bg-fhenix-cyan"
                />
              ) : isSwitching ? (
                <motion.span
                  key="spinner"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <Loader2
                    size={9}
                    className="animate-spin text-fhenix-indigo"
                  />
                </motion.span>
              ) : (
                <motion.span
                  key="radio"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.3 }}
                >
                  <Radio size={9} />
                </motion.span>
              )}
            </AnimatePresence>

            {isSwitching ? (
              <span className="text-fhenix-indigo">switching</span>
            ) : (
              label
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
