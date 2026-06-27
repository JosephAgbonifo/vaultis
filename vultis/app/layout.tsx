import { Montserrat, Space_Mono } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Footer } from "@/components/Footer";

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Vaultis | Private DAO Treasury Management",
  description:
    "Encrypted on-chain treasury governance. DAOs manage runway, allocations, and unlock schedules with FHE-encrypted voting — invisible to the market until execution.",

  // Explicitly mapping the icons to your logo.png file
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png", // Used if users save your Web3 app to their iOS home screen
  },

  openGraph: {
    title: "Vaultis — Private On-Chain Treasury Allocation",
    description:
      "Runway, allocations, and unlock schedules — encrypted on-chain. Powered by Fhenix FHE hardware-accelerated confidentiality.",
    url: "https://vaultis.xyz",
    siteName: "Vaultis",
    images: [
      {
        url: "/og-image.png", // This remains your large social link preview image
        width: 1200,
        height: 630,
        alt: "Vaultis Encrypted Treasury UI Preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vaultis | Confidential DAO Treasury Nodes",
    description:
      "The market can't front-run what it can't see. Allocations stay private until the cycle executes.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceMono.variable} ${montserrat.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col font-montserrat bg-black text-white"
        style={{ fontFamily: "var(--font-montserrat)" }}
      >
        <Providers>
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
