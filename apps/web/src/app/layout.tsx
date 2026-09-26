import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { cookies } from "next/headers";
import { IBM_Plex_Mono, IBM_Plex_Sans, Noto_Sans_SC } from "next/font/google";

import { LocaleProvider, type Locale } from "@/lib/i18n";

import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

const plexSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-sans-sc",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CareerOS",
  description: "A grounded workspace for your job search",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const savedLocale = (await cookies()).get("careeros_locale")?.value;
  const locale: Locale = savedLocale === "zh-CN" ? "zh-CN" : "en";

  return (
    <ClerkProvider>
      <html
        lang={locale}
        className={`${plexSans.variable} ${plexSansSC.variable} ${plexMono.variable}`}
      >
        <body>
          <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
