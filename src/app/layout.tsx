import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import OfflineIndicator from "@/components/OfflineIndicator";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Scana — Scanner & Éditeur PDF",
  description:
    "Scanner de documents et éditeur PDF, 100% hors-ligne, sans compte, sans publicité.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Scana",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563EB",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className="bg-page text-ink font-display">
        <OfflineIndicator />
        {children}
      </body>
    </html>
  );
}
