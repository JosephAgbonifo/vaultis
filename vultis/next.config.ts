import type { NextConfig } from "next";
import type { Configuration } from "webpack";

const nextConfig: NextConfig = {
  transpilePackages: ["@cofhe/sdk"],
  webpack: (config: Configuration, { isServer }: { isServer: boolean }) => {
    if (!isServer) {
      // ensure resolve and fallback exist on the config
      // @ts-ignore - webpack types may not include resolve.fallback
      config.resolve = config.resolve || {};
      // @ts-ignore
      config.resolve.fallback = {
        // @ts-ignore
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        path: false,
        buffer: false,
      };
    }
    return config;
  },
};

export default nextConfig;
