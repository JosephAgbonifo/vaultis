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
              relative flex items-center gap-1.5 text-[10px] tracking-widest
              px-3 py-1.5 rounded-full border backdrop-blur-sm transition-all duration-200
              disabled:cursor-default overflow-hidden
              ${
                isActive
                  ? "border-fhenix-cyan/60 text-fhenix-cyan bg-fhenix-cyan/[0.07] shadow-[0_0_18px_-5px_rgba(34,211,238,0.6)]"
                  : "border-white/10 text-fhenix-muted hover:border-fhenix-cyan/30 hover:text-fhenix-white bg-white/[0.02]"
              }
            `}
          >
            <AnimatePresence mode="wait">
              {isActive ? (
                <motion.span
                  key="dot"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-1.5 h-1.5 rounded-full bg-fhenix-cyan shadow-[0_0_8px_rgba(34,211,238,0.9)]"
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
