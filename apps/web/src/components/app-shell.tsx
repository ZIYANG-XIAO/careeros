"use client";

import { UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { CaptureDialog } from "@/components/capture-dialog";
import { CommandPalette } from "@/components/command-palette";
import { useI18n, type Locale } from "@/lib/i18n";
import { type Theme, useTheme } from "@/lib/theme";

const navItems = [
  { label: "nav.home" as const, href: "/home" },
  { label: "nav.discover" as const, href: "/discover" },
  { label: "nav.applications" as const, href: "/pipeline" },
  { label: "nav.careerBrain" as const, href: "/me" },
] as const;

function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { locale, setLocale, t } = useI18n();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    function closeAllMenus() {
      setMobileMenuOpen(false);
      setMobileSettingsOpen(false);
      setAddMenuOpen(false);
      setSettingsOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (event.key === "Escape") closeAllMenus();
    }
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-shell-popover]")) {
        return;
      }
      closeAllMenus();
    }
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  function closeMenus() {
    setMobileMenuOpen(false);
    setMobileSettingsOpen(false);
    setAddMenuOpen(false);
    setSettingsOpen(false);
  }

  const primaryNav = (
    <nav aria-label={t("shell.primaryNav")}>
      <ul className="flex flex-col gap-1 md:h-16 md:flex-row md:items-stretch md:gap-0.5">
        {navItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="md:flex">
              <Link
                href={item.href}
                onClick={closeMenus}
                aria-current={active ? "page" : undefined}
                className={`flex items-center rounded-lg px-3 py-2 text-sm font-semibold transition-colors md:rounded-none md:border-b-[3px] md:px-3.5 md:pt-[3px] ${
                  active
                    ? "bg-accent-soft text-accent md:border-accent md:bg-transparent"
                    : "text-ink-2 hover:bg-sunken hover:text-ink md:border-transparent"
                }`}
              >
                {t(item.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <div className="min-h-screen bg-ground">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            href="/home"
            onClick={closeMenus}
            className="flex shrink-0 items-center gap-2.5"
          >
            <Image
              src="/brand/careeros-buddy.png"
              alt=""
              width={36}
              height={36}
              priority
              className="rounded-xl"
            />
            <span className="text-base font-bold tracking-tight text-ink">
              Career<span className="text-accent">OS</span>
            </span>
          </Link>

          <div className="hidden md:block">{primaryNav}</div>

          <div className="ml-auto flex items-center gap-1.5" data-shell-popover>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2 rounded-lg p-2 text-sm font-medium text-ink-2 hover:bg-sunken lg:border lg:border-border lg:bg-surface lg:px-3"
              aria-label={t("shell.search")}
            >
              <SearchIcon />
              <span className="hidden lg:inline">{t("shell.search")}</span>
              <kbd className="hidden rounded border border-border-strong bg-rail px-1.5 py-0.5 text-[10px] text-ink-3 lg:inline">
                ⌘K
              </kbd>
            </button>

            <Link
              href="/setup"
              className="hidden rounded-lg p-2 text-ink-2 hover:bg-sunken sm:block"
              aria-label={t("shell.assistantSetup")}
              title={t("shell.assistantSetup")}
            >
              <AssistantIcon />
            </Link>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setAddMenuOpen((current) => !current);
                  setSettingsOpen(false);
                  setMobileMenuOpen(false);
                }}
                aria-expanded={addMenuOpen}
                aria-controls="top-add-menu"
                className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
              >
                <span aria-hidden="true">＋</span>
                <span className="hidden sm:inline">{t("shell.add")}</span>
              </button>
              {addMenuOpen && (
                <AddMenu
                  t={t}
                  closeMenus={closeMenus}
                  openCapture={() => setCaptureOpen(true)}
                />
              )}
            </div>

            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen((current) => !current);
                  setAddMenuOpen(false);
                  setMobileMenuOpen(false);
                }}
                aria-expanded={settingsOpen}
                aria-controls="top-settings-menu"
                className="rounded-lg p-2 text-ink-2 hover:bg-sunken"
                aria-label={t("shell.settings")}
              >
                <SettingsIcon />
              </button>
              {settingsOpen && (
                <SettingsMenu
                  locale={locale}
                  theme={theme}
                  setLocale={setLocale}
                  setTheme={setTheme}
                  closeMenus={closeMenus}
                  t={t}
                />
              )}
            </div>

            <div className="hidden sm:block">
              <UserButton />
            </div>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen((current) => !current);
                setMobileSettingsOpen(false);
                setAddMenuOpen(false);
                setSettingsOpen(false);
              }}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
              className="rounded-lg p-2 text-ink-2 hover:bg-sunken md:hidden"
              aria-label={
                mobileMenuOpen ? t("shell.closeMenu") : t("shell.openMenu")
              }
            >
              <MenuIcon open={mobileMenuOpen} />
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div
            id="mobile-navigation"
            data-testid="mobile-menu"
            className="border-t border-border bg-surface px-4 py-3 md:hidden"
            data-shell-popover
          >
            {primaryNav}
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3 sm:hidden">
              <Link
                href="/setup"
                onClick={closeMenus}
                className="text-sm font-medium text-ink-2"
              >
                {t("shell.assistantSetup")}
              </Link>
              <button
                type="button"
                onClick={() => setMobileSettingsOpen((current) => !current)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-ink-2 hover:bg-sunken"
                aria-expanded={mobileSettingsOpen}
              >
                {t("shell.settings")}
              </button>
              <UserButton />
            </div>
            {mobileSettingsOpen && (
              <SettingsMenu
                locale={locale}
                theme={theme}
                setLocale={setLocale}
                setTheme={setTheme}
                closeMenus={closeMenus}
                t={t}
                mobile
              />
            )}
          </div>
        )}
      </header>

      <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-[1600px] p-4 sm:p-6 lg:p-8 xl:p-10">
        {children}
      </main>

      <CaptureDialog open={captureOpen} onClose={() => setCaptureOpen(false)} />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}

type Translate = ReturnType<typeof useI18n>["t"];

function AddMenu({
  t,
  closeMenus,
  openCapture,
}: {
  t: Translate;
  closeMenus: () => void;
  openCapture: () => void;
}) {
  return (
    <div
      id="top-add-menu"
      data-testid="add-menu"
      className="absolute right-0 top-12 z-50 w-72 rounded-xl border border-border bg-surface p-2 shadow-xl"
    >
      <AddLink
        href="/discover#add-job"
        symbol="＋"
        title={t("shell.addJob")}
        hint={t("shell.addJobHint")}
        closeMenus={closeMenus}
      />
      <button
        type="button"
        onClick={() => {
          closeMenus();
          openCapture();
        }}
        className="flex w-full gap-3 rounded-lg px-3 py-2 text-left hover:bg-sunken"
      >
        <span className="text-accent" aria-hidden="true">
          ✓
        </span>
        <MenuCopy
          title={t("shell.recordApplication")}
          hint={t("shell.recordApplicationHint")}
        />
      </button>
      <AddLink
        href="/me/resumes"
        symbol="↑"
        title={t("shell.uploadResume")}
        hint={t("shell.uploadResumeHint")}
        closeMenus={closeMenus}
      />
      <AddLink
        href="/me"
        symbol="✦"
        title={t("shell.addExperience")}
        hint={t("shell.addExperienceHint")}
        closeMenus={closeMenus}
      />
    </div>
  );
}

function AddLink({
  href,
  symbol,
  title,
  hint,
  closeMenus,
}: {
  href: string;
  symbol: string;
  title: string;
  hint: string;
  closeMenus: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={closeMenus}
      className="flex gap-3 rounded-lg px-3 py-2 hover:bg-sunken"
    >
      <span className="text-accent" aria-hidden="true">
        {symbol}
      </span>
      <MenuCopy title={title} hint={hint} />
    </Link>
  );
}

function MenuCopy({ title, hint }: { title: string; hint: string }) {
  return (
    <span>
      <strong className="block text-sm text-ink">{title}</strong>
      <span className="text-xs text-ink-3">{hint}</span>
    </span>
  );
}

function SettingsMenu({
  locale,
  theme,
  setLocale,
  setTheme,
  closeMenus,
  t,
  mobile = false,
}: {
  locale: Locale;
  theme: Theme;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: Theme) => void;
  closeMenus: () => void;
  t: Translate;
  mobile?: boolean;
}) {
  return (
    <div
      id="top-settings-menu"
      aria-label={t("shell.settings")}
      data-testid="settings-menu"
      className={`${mobile ? "mt-3 w-full" : "absolute right-0 top-12 w-64"} z-50 rounded-xl border border-border bg-surface shadow-xl`}
    >
      <div className="border-b border-border px-3 py-2">
        <p className="text-sm font-semibold text-ink">{t("shell.settings")}</p>
      </div>
      <div className="space-y-3 px-3 py-3">
        <PreferenceGroup
          label={t("shell.language")}
          values={["en", "zh-CN"]}
          current={locale}
          labels={["English", "中文"]}
          onChange={setLocale}
        />
        <PreferenceGroup
          label={t("shell.theme")}
          values={["light", "system", "dark"]}
          current={theme}
          labels={[
            t("shell.themeLight"),
            t("shell.themeSystem"),
            t("shell.themeDark"),
          ]}
          onChange={setTheme}
        />
      </div>
      <div className="border-t border-border p-2">
        {[
          { href: "/me/goals", label: t("shell.searchGoals") },
          { href: "/me/contact", label: t("shell.contactInfo") },
          { href: "/me/account", label: t("nav.account") },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={closeMenus}
            className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs font-medium text-ink-2 hover:bg-sunken hover:text-ink"
          >
            {item.label}
            <span aria-hidden="true" className="text-ink-3">
              ›
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function PreferenceGroup<T extends string>({
  label,
  values,
  current,
  labels,
  onChange,
}: {
  label: string;
  values: readonly T[];
  current: T;
  labels: readonly string[];
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-ink-2">{label}</p>
      <div className="flex rounded-lg bg-sunken p-0.5">
        {values.map((item, index) => (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            aria-pressed={current === item}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold ${current === item ? "bg-surface text-ink shadow-sm" : "text-ink-3"}`}
          >
            {labels[index]}
          </button>
        ))}
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="M20 20l-4.3-4.3" />
    </svg>
  );
}
function AssistantIcon() {
  return (
    <svg
      className="h-5 w-5"
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
  );
}
function SettingsIcon() {
  return (
    <svg
      className="h-5 w-5"
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
  );
}
function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"}
      />
    </svg>
  );
}

export { AppShell };
