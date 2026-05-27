import { Space_Mono } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Darrk Club",
  description:
    "Anonymous encrypted book voting. The introvert's book finally gets read.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceMono.variable} h-full antialiased`}>
      <body
        className="min-h-full flex flex-col font-mono bg-black text-white"
        style={{ fontFamily: "var(--font-space-mono), monospace" }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
