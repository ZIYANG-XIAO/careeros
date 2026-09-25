import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { cookies } from "next/headers";

import { LocaleProvider, type Locale } from "@/lib/i18n";

import "./globals.css";

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
      <html lang={locale}>
        <body>
          <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
