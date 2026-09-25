"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";

import { useI18n } from "@/lib/i18n";

const navItems = [
  {
    label: "shell.jobs" as const,
    href: "/jobs",
    path: "M9 6h6m-7 4h8m-9 4h10m-8 4h6M6 3h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z",
  },
  {
    label: "shell.applications" as const,
    href: "/applications",
    path: "M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2zm2 5h6m-6 4h6m-6 4h4",
  },
  {
    label: "shell.resumes" as const,
    href: "/resumes",
    path: "M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2zm7 0v6h6M9 13h6m-6 4h6",
  },
  {
    label: "shell.profile" as const,
    href: "/career",
    path: "M12 12a4 4 0 100-8 4 4 0 000 8zm7 9a7 7 0 00-14 0",
  },
] as const;

function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="flex min-h-screen bg-slate-50">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-950/35 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label={t("shell.closeMenu")}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200/80 bg-white transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 items-center justify-between px-6">
          <Link
            href="/jobs"
            className="group"
            onClick={() => setSidebarOpen(false)}
          >
            <span className="block text-base font-bold tracking-tight text-slate-950">
              Career<span className="text-blue-700">OS</span>
            </span>
            <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {t("shell.tagline")}
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"
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

        <nav className="flex-1 px-3 py-4" aria-label={t("shell.primaryNav")}>
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {t("shell.workspace")}
          </p>
          <ul className="mt-3 space-y-1">
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
                        ? "bg-blue-50 text-blue-800"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
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

        <div className="border-t border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between gap-3 px-2">
            <span className="text-xs font-medium text-slate-500">
              {t("shell.language")}
            </span>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
              {(["en", "zh-CN"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setLocale(item)}
                  aria-pressed={locale === item}
                  className={`rounded-md px-2 py-1 text-xs font-semibold transition ${
                    locale === item
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {item === "en" ? "EN" : "中文"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <UserButton />
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">
                {t("shell.yourWorkspace")}
              </p>
              <p className="text-xs text-slate-500">{t("shell.account")}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
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
            href="/jobs"
            className="ml-3 text-sm font-bold tracking-tight text-slate-950"
          >
            Career<span className="text-blue-700">OS</span>
          </Link>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-10">{children}</main>
      </div>
    </div>
  );
}

export { AppShell };
