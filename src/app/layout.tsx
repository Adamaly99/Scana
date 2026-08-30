import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
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
  description: "Scanner de documents et éditeur PDF, 100% hors-ligne, sans compte, sans publicité.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Scana",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563EB",
};

export default async function RootLayout({
  children,
  params: { locale }
}: Readonly<{
  children: React.ReactNode;
  params: { locale: string };
}>) {
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }
  
  const messages = await getMessages();

  return (
    <html lang={locale} className={inter.variable} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <body className="bg-page text-ink font-display">
        <NextIntlClientProvider messages={messages}>
          <OfflineIndicator />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
      }
