"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { CaptureDialog } from "@/components/capture-dialog";
import { CommandPalette } from "@/components/command-palette";
import { useI18n } from "@/lib/i18n";
import { type Theme, useTheme } from "@/lib/theme";

const navItems = [
  {
    label: "nav.pipeline" as const,
    href: "/pipeline",
    path: "M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2zm2 5h6m-6 4h6m-6 4h4",
  },
  {
    label: "nav.discover" as const,
    href: "/discover",
    path: "M11 4a7 7 0 100 14 7 7 0 000-14zm9 16l-5.2-5.2",
  },
  {
    label: "nav.me" as const,
    href: "/me",
    path: "M12 12a4 4 0 100-8 4 4 0 000 8zm7 9a7 7 0 00-14 0",
  },
] as const;

function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { locale, setLocale, t } = useI18n();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    function handleGlobalKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  return (
    <div className="flex min-h-screen bg-ground">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-ink/35 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label={t("shell.closeMenu")}
        />
      )}

      <aside
        style={{ width: "var(--spacing-rail)" }}
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-rail transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 items-center justify-between px-5">
          <Link
            href="/pipeline"
            className="group"
            onClick={() => setSidebarOpen(false)}
          >
            <span className="block text-base font-bold tracking-tight text-ink">
              Career<span className="text-accent">OS</span>
            </span>
            <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-3">
              {t("shell.tagline")}
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-ink-2 hover:bg-sunken md:hidden"
            aria-label={t("shell.closeMenu")}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden="true"
            >
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="space-y-2 px-3 pb-1">
          <button
            type="button"
            onClick={() => setCaptureOpen(true)}
            className="flex w-full items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            <svg
              className="h-4 w-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" d="M12 5v14m-7-7h14" />
            </svg>
            {t("shell.capture")}
          </button>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-ink-2 hover:bg-sunken"
          >
            <span className="flex items-center gap-2">
              <svg
                className="h-4 w-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" strokeLinecap="round" />
                <path strokeLinecap="round" d="M20 20l-4.3-4.3" />
              </svg>
              {t("shell.search")}
            </span>
            <kbd className="rounded border border-border-strong bg-rail px-1.5 py-0.5 text-[10px] text-ink-3">
              ⌘K
            </kbd>
          </button>
        </div>

        <nav className="flex-1 px-3 py-4" aria-label={t("shell.primaryNav")}>
          <ul className="space-y-1">
            {navItems.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-accent-soft text-accent"
                        : "text-ink-2 hover:bg-sunken hover:text-ink"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    <svg
                      className="h-5 w-5 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.7}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d={item.path}
                      />
                    </svg>
                    {t(item.label)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-border p-4">
          <Link
            href="/setup"
            onClick={() => setSidebarOpen(false)}
            className="mb-3 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-3 hover:bg-sunken hover:text-ink-2"
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-icon-muted"
              aria-hidden="true"
            />
            {t("shell.assistantOff")}
          </Link>
          <div className="mb-3 flex items-center justify-between gap-3 px-2">
            <span className="text-xs font-medium text-ink-3">
              {t("shell.language")}
            </span>
            <div className="inline-flex rounded-lg bg-sunken p-0.5">
              {(["en", "zh-CN"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setLocale(item)}
                  aria-pressed={locale === item}
                  className={`rounded-md px-2 py-1 text-xs font-semibold transition ${
                    locale === item
                      ? "bg-surface text-ink shadow-sm"
                      : "text-ink-3 hover:text-ink-2"
                  }`}
                >
                  {item === "en" ? "EN" : "中文"}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-3 flex items-center justify-between gap-3 px-2">
            <span className="text-xs font-medium text-ink-3">
              {t("shell.theme")}
            </span>
            <div className="inline-flex rounded-lg bg-sunken p-0.5">
              {(["light", "system", "dark"] as const satisfies Theme[]).map(
                (item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setTheme(item)}
                    aria-pressed={theme === item}
                    className={`rounded-md px-2 py-1 text-xs font-semibold transition ${
                      theme === item
                        ? "bg-surface text-ink shadow-sm"
                        : "text-ink-3 hover:text-ink-2"
                    }`}
                  >
                    {item === "light"
                      ? t("shell.themeLight")
                      : item === "dark"
                        ? t("shell.themeDark")
                        : t("shell.themeSystem")}
                  </button>
                ),
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <UserButton />
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">
                {t("shell.yourWorkspace")}
              </p>
              <p className="text-xs text-ink-3">{t("shell.account")}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center border-b border-border bg-surface/95 px-4 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-ink-2 hover:bg-sunken"
            aria-label={t("shell.openMenu")}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden="true"
            >
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <Link
            href="/pipeline"
            className="ml-3 text-sm font-bold tracking-tight text-ink"
          >
            Career<span className="text-accent">OS</span>
          </Link>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-10">{children}</main>
      </div>

      <CaptureDialog open={captureOpen} onClose={() => setCaptureOpen(false)} />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}

export { AppShell };
