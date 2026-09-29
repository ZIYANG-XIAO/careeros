"use client";

import { UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type ReactNode,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import { CaptureDialog } from "@/components/capture-dialog";
import { CommandPalette } from "@/components/command-palette";
import { useI18n } from "@/lib/i18n";
import { type Theme, useTheme } from "@/lib/theme";

const navItems = [
  {
    label: "nav.home" as const,
    href: "/home",
    path: "M4 10.5L12 4l8 6.5V20H5V10.5zm5 9v-6h6v6",
  },
  {
    label: "nav.discover" as const,
    href: "/discover",
    path: "M11 4a7 7 0 100 14 7 7 0 000-14zm9 16l-5.2-5.2",
  },
  {
    label: "nav.applications" as const,
    href: "/pipeline",
    path: "M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2zm2 5h6m-6 4h6m-6 4h4",
  },
  {
    label: "nav.careerBrain" as const,
    href: "/me",
    path: "M12 12a4 4 0 100-8 4 4 0 000 8zm7 9a7 7 0 00-14 0",
  },
] as const;

const SIDEBAR_STORAGE_KEY = "careeros.sidebarCollapsed";
const SIDEBAR_CHANGE_EVENT = "careeros:sidebar-change";

function subscribeToSidebar(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(SIDEBAR_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SIDEBAR_CHANGE_EVENT, callback);
  };
}

function getSidebarSnapshot() {
  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
}

function getSidebarServerSnapshot() {
  return false;
}

function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarCollapsed = useSyncExternalStore(
    subscribeToSidebar,
    getSidebarSnapshot,
    getSidebarServerSnapshot,
  );
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
      if (event.key === "Escape") {
        setAddMenuOpen(false);
        setSettingsOpen(false);
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("[data-sidebar-popover-area]")
      ) {
        return;
      }
      setSettingsOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function closeSidebarMenus() {
    setAddMenuOpen(false);
    setSettingsOpen(false);
  }

  function toggleSidebar() {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!sidebarCollapsed));
    window.dispatchEvent(new Event(SIDEBAR_CHANGE_EVENT));
    closeSidebarMenus();
  }

  const collapsedLabelClass = sidebarCollapsed ? "md:hidden" : "";

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
        className={`fixed inset-y-0 left-0 z-40 flex w-[var(--spacing-rail)] flex-col border-r border-border bg-rail transition-[width,transform] duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          sidebarCollapsed ? "md:w-[72px]" : ""
        } ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div
          className={`flex h-20 items-center justify-between ${sidebarCollapsed ? "md:px-3" : "px-5"}`}
        >
          <Link
            href="/home"
            className={`group flex items-center gap-2.5 ${sidebarCollapsed ? "md:mx-auto" : ""}`}
            onClick={() => setSidebarOpen(false)}
            title={sidebarCollapsed ? "CareerOS" : undefined}
          >
            <Image
              src="/brand/careeros-buddy.png"
              alt=""
              width={38}
              height={38}
              priority
              className="rounded-xl"
            />
            <span className={collapsedLabelClass}>
              <span className="block text-base font-bold tracking-tight text-ink">
                Career<span className="text-accent">OS</span>
              </span>
              <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-3">
                {t("shell.tagline")}
              </span>
            </span>
          </Link>
          <button
            type="button"
            onClick={toggleSidebar}
            className={`rounded-lg p-2 text-ink-3 hover:bg-sunken hover:text-ink ${sidebarCollapsed ? "md:hidden" : "hidden md:block"}`}
            aria-label={t("shell.collapse")}
            title={t("shell.collapse")}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                d="M4 5h16v14H4zM9 5v14m6-10l-3 3 3 3"
              />
            </svg>
          </button>
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

        {sidebarCollapsed && (
          <button
            type="button"
            onClick={toggleSidebar}
            className="mx-auto hidden rounded-lg p-2 text-ink-3 hover:bg-sunken hover:text-ink md:block"
            aria-label={t("shell.expand")}
            title={t("shell.expand")}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                d="M4 5h16v14H4zM9 5v14m3-2l3-3-3-3"
              />
            </svg>
          </button>
        )}

        <div className="relative space-y-2 px-3 pb-1">
          <button
            type="button"
            onClick={() => {
              setAddMenuOpen((current) => !current);
              setSettingsOpen(false);
            }}
            aria-expanded={addMenuOpen}
            className={`flex w-full items-center rounded-xl bg-accent py-2 text-sm font-semibold text-white hover:bg-accent-hover ${sidebarCollapsed ? "md:justify-center md:px-0" : "gap-2 px-3"}`}
            title={sidebarCollapsed ? t("shell.add") : undefined}
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
            <span className={collapsedLabelClass}>{t("shell.add")}</span>
          </button>
          {addMenuOpen && (
            <div
              className={`absolute top-12 right-3 left-3 z-50 w-auto rounded-xl border border-border bg-surface p-2 shadow-lg ${sidebarCollapsed ? "md:top-0 md:right-auto md:left-[68px] md:w-64" : ""}`}
            >
              <Link
                href="/discover#add-job"
                onClick={() => {
                  closeSidebarMenus();
                  setSidebarOpen(false);
                }}
                className="flex gap-3 rounded-lg px-3 py-2 hover:bg-sunken"
              >
                <span className="text-accent" aria-hidden="true">
                  ＋
                </span>
                <span>
                  <strong className="block text-sm font-semibold text-ink">
                    {t("shell.addJob")}
                  </strong>
                  <span className="block text-xs text-ink-3">
                    {t("shell.addJobHint")}
                  </span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  closeSidebarMenus();
                  setCaptureOpen(true);
                }}
                className="flex w-full gap-3 rounded-lg px-3 py-2 text-left hover:bg-sunken"
              >
                <span className="text-accent" aria-hidden="true">
                  ✓
                </span>
                <span>
                  <strong className="block text-sm font-semibold text-ink">
                    {t("shell.recordApplication")}
                  </strong>
                  <span className="block text-xs text-ink-3">
                    {t("shell.recordApplicationHint")}
                  </span>
                </span>
              </button>
              <Link
                href="/me/resumes"
                onClick={closeSidebarMenus}
                className="flex gap-3 rounded-lg px-3 py-2 hover:bg-sunken"
              >
                <span className="text-accent" aria-hidden="true">
                  ↑
                </span>
                <span>
                  <strong className="block text-sm font-semibold text-ink">
                    {t("shell.uploadResume")}
                  </strong>
                  <span className="block text-xs text-ink-3">
                    {t("shell.uploadResumeHint")}
                  </span>
                </span>
              </Link>
              <Link
                href="/me"
                onClick={closeSidebarMenus}
                className="flex gap-3 rounded-lg px-3 py-2 hover:bg-sunken"
              >
                <span className="text-accent" aria-hidden="true">
                  ✦
                </span>
                <span>
                  <strong className="block text-sm font-semibold text-ink">
                    {t("shell.addExperience")}
                  </strong>
                  <span className="block text-xs text-ink-3">
                    {t("shell.addExperienceHint")}
                  </span>
                </span>
              </Link>
            </div>
          )}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className={`flex w-full items-center rounded-xl border border-border bg-surface py-2 text-sm font-medium text-ink-2 hover:bg-sunken ${sidebarCollapsed ? "md:justify-center md:px-0" : "justify-between px-3"}`}
            title={sidebarCollapsed ? t("shell.search") : undefined}
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
              <span className={collapsedLabelClass}>{t("shell.search")}</span>
            </span>
            <kbd
              className={`rounded border border-border-strong bg-rail px-1.5 py-0.5 text-[10px] text-ink-3 ${collapsedLabelClass}`}
            >
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
                    title={sidebarCollapsed ? t(item.label) : undefined}
                    className={`relative flex items-center rounded-xl py-2.5 text-sm font-medium transition-colors ${sidebarCollapsed ? "md:justify-center md:px-0" : "gap-3 px-3"} ${
                      active
                        ? "bg-accent-soft text-accent before:absolute before:top-2.5 before:bottom-2.5 before:left-0 before:w-[3px] before:rounded-full before:bg-accent"
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
                    <span className={collapsedLabelClass}>{t(item.label)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div
          className={`border-t border-border ${sidebarCollapsed ? "md:p-2" : "p-4"}`}
        >
          <Link
            href="/setup"
            onClick={() => setSidebarOpen(false)}
            title={sidebarCollapsed ? t("shell.assistantSetup") : undefined}
            className={`mb-2 flex items-center rounded-lg py-2 text-xs font-medium text-ink-3 hover:bg-sunken hover:text-ink-2 ${sidebarCollapsed ? "md:justify-center md:px-0" : "gap-2 px-2"}`}
          >
            <svg
              className="h-4 w-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 10h8m-7 4h6M9 4h6l1 3h2a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h2l1-3z"
              />
            </svg>
            <span className={collapsedLabelClass}>
              {t("shell.assistantSetup")}
            </span>
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full bg-status-offer-ink ${collapsedLabelClass}`}
              aria-hidden="true"
            />
          </Link>
          <div className="relative mb-2" data-sidebar-popover-area>
            <button
              type="button"
              onClick={() => {
                setSettingsOpen((current) => !current);
                setAddMenuOpen(false);
              }}
              aria-expanded={settingsOpen}
              aria-controls="sidebar-settings-menu"
              className={`flex w-full items-center rounded-lg py-2 text-xs font-medium text-ink-3 hover:bg-sunken hover:text-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${sidebarCollapsed ? "md:justify-center md:px-0" : "gap-2 px-2"}`}
              title={sidebarCollapsed ? t("shell.settings") : undefined}
            >
              <svg
                className="h-4 w-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm7-3.5l2-1-2-3-2 .5a8 8 0 00-1.5-1L15 5h-4l-.5 2.5a8 8 0 00-1.5 1L7 8l-2 3 2 1a8 8 0 000 2L5 15l2 3 2-.5a8 8 0 001.5 1L11 21h4l.5-2.5a8 8 0 001.5-1l2 .5 2-3-2-1a8 8 0 000-2z"
                />
              </svg>
              <span className={collapsedLabelClass}>{t("shell.settings")}</span>
            </button>
            {settingsOpen && (
              <div
                id="sidebar-settings-menu"
                aria-label={t("shell.settings")}
                data-testid="settings-menu"
                className={`absolute bottom-11 left-0 z-50 max-h-[calc(100vh-2rem)] w-56 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-border bg-surface shadow-xl ${sidebarCollapsed ? "md:bottom-0 md:left-[56px]" : ""}`}
              >
                <div className="border-b border-border px-3 py-2">
                  <p className="text-sm font-semibold text-ink">
                    {t("shell.settings")}
                  </p>
                </div>
                <div className="space-y-2 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                    {t("shell.interface")}
                  </p>
                  <div>
                    <p className="mb-1 text-[11px] font-medium text-ink-2">
                      {t("shell.language")}
                    </p>
                    <div className="flex rounded-lg bg-sunken p-0.5">
                      {(["en", "zh-CN"] as const).map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setLocale(item)}
                          aria-pressed={locale === item}
                          className={`flex-1 rounded-md px-2 py-1 text-[11px] font-semibold ${locale === item ? "bg-surface text-ink shadow-sm" : "text-ink-3"}`}
                        >
                          {item === "en" ? "English" : "中文"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-medium text-ink-2">
                      {t("shell.theme")}
                    </p>
                    <div className="flex rounded-lg bg-sunken p-0.5">
                      {(
                        ["light", "system", "dark"] as const satisfies Theme[]
                      ).map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setTheme(item)}
                          aria-pressed={theme === item}
                          className={`flex-1 rounded-md px-2 py-1 text-[11px] font-semibold ${theme === item ? "bg-surface text-ink shadow-sm" : "text-ink-3"}`}
                        >
                          {item === "light"
                            ? t("shell.themeLight")
                            : item === "dark"
                              ? t("shell.themeDark")
                              : t("shell.themeSystem")}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={toggleSidebar}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[11px] font-medium text-ink-2 hover:bg-sunken"
                  >
                    <span>{t("shell.sidebar")}</span>
                    <span className="text-ink-3">
                      {sidebarCollapsed
                        ? t("shell.sidebarExpand")
                        : t("shell.sidebarCollapse")}
                    </span>
                  </button>
                </div>
                <div className="border-t border-border px-2 py-1">
                  <p className="px-1.5 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                    {t("shell.jobSearch")}
                  </p>
                  <Link
                    href="/me/goals"
                    onClick={closeSidebarMenus}
                    className="group flex items-center justify-between rounded-lg px-1.5 py-1 hover:bg-sunken"
                  >
                    <span className="text-xs font-medium text-ink-2 group-hover:text-ink">
                      {t("shell.searchGoals")}
                    </span>
                    <span className="text-ink-3" aria-hidden="true">
                      ›
                    </span>
                  </Link>
                </div>
                <div className="border-t border-border px-2 py-1">
                  <p className="px-1.5 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                    {t("shell.accountData")}
                  </p>
                  {[
                    {
                      href: "/me/contact",
                      label: t("shell.contactInfo"),
                    },
                    {
                      href: "/me/account",
                      label: t("nav.account"),
                    },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeSidebarMenus}
                      className="group flex items-center justify-between rounded-lg px-1.5 py-1 hover:bg-sunken"
                    >
                      <span className="text-xs font-medium text-ink-2 group-hover:text-ink">
                        {item.label}
                      </span>
                      <span className="text-ink-3" aria-hidden="true">
                        ›
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-sunken">
            <UserButton />
            <Link
              href="/me/account"
              onClick={() => setSidebarOpen(false)}
              className={`min-w-0 flex-1 rounded-lg px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${sidebarCollapsed ? "md:hidden" : ""}`}
            >
              <span className="block truncate text-sm font-medium text-ink">
                {t("shell.yourWorkspace")}
              </span>
              <span className="block truncate text-xs text-ink-3">
                {t("shell.account")}
              </span>
            </Link>
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
            href="/home"
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
