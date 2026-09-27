import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { cookies } from "next/headers";
import { IBM_Plex_Mono, IBM_Plex_Sans, Noto_Sans_SC } from "next/font/google";

import { LocaleProvider, type Locale } from "@/lib/i18n";
import { ThemeProvider, type Theme } from "@/lib/theme";

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
  const cookieStore = await cookies();
  const savedLocale = cookieStore.get("careeros_locale")?.value;
  const locale: Locale = savedLocale === "zh-CN" ? "zh-CN" : "en";
  const savedTheme = cookieStore.get("careeros_theme")?.value;
  const theme: Theme =
    savedTheme === "light" || savedTheme === "dark" ? savedTheme : "system";

  return (
    <ClerkProvider>
      <html
        lang={locale}
        data-theme={theme === "system" ? undefined : theme}
        className={`${plexSans.variable} ${plexSansSC.variable} ${plexMono.variable}`}
      >
        <body>
          <ThemeProvider initialTheme={theme}>
            <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
