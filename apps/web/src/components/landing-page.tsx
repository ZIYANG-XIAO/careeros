"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";

import { useI18n, type Locale } from "@/lib/i18n";

const spineItems = [
  {
    key: "knowMe" as const,
    accent: "text-blue-400",
  },
  {
    key: "discover" as const,
    accent: "text-emerald-400",
  },
  {
    key: "applyAnywhere" as const,
    accent: "text-violet-400",
  },
  {
    key: "remember" as const,
    accent: "text-amber-400",
  },
] as const;

const localeOptions: { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "zh-CN", label: "中文" },
];

export function LandingPage() {
  const { locale, setLocale, t } = useI18n();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <section className="max-w-3xl">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold tracking-tight">
              Career<span className="text-blue-400">OS</span>
            </p>
            <div
              className="flex gap-1 rounded-lg border border-slate-700 p-0.5"
              role="radiogroup"
              aria-label={t("shell.language")}
            >
              {localeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={locale === option.value}
                  onClick={() => setLocale(option.value)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    locale === option.value
                      ? "bg-slate-700 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-16 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
            {t("landing.tagline")}
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">
            {t("landing.hero.title")}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
            {t("landing.hero.subtitle")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <SignUpButton mode="modal">
              <button className="rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
                {t("landing.getStarted")}
              </button>
            </SignUpButton>
            <SignInButton mode="modal">
              <button className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
                {t("landing.signIn")}
              </button>
            </SignInButton>
          </div>
        </section>

        <section
          className="mt-20 grid gap-4 sm:grid-cols-2"
          aria-label={t("landing.spine.heading")}
        >
          {spineItems.map((item, index) => (
            <article
              key={item.key}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h2
                className={`mt-3 text-lg font-semibold tracking-tight ${item.accent}`}
              >
                {t(`landing.spine.${item.key}.title`)}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {t(`landing.spine.${item.key}.description`)}
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
