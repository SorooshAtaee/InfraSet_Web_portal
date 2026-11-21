import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "InfraSet \u2014 Parametric LCA & MFA for Transport Infrastructure Assets",
  description:
    "Web portal for InfraSet: extract roads, railways and ancillary assets from OpenStreetMap, assign them to the InfraSet element database and run life cycle assessment and material flow analysis with user-defined scenarios. Companion of the InfraSet Grasshopper plugin (PhD thesis, UCLouvain).",
  keywords: ["InfraSet", "LCA", "MFA", "transport infrastructure", "OpenStreetMap", "Grasshopper", "EPiC", "embodied energy", "GHG"],
  authors: [{ name: "Soroosh Ataee" }],
  icons: {
    icon: "/logo.png",
  },
  openGraph: {
    title: "InfraSet Web Tool",
    description: "OSM-powered LCA and material flow analysis for transport infrastructure assets",
    siteName: "InfraSet",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
