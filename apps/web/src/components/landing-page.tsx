"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";
import Image from "next/image";

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
            <div className="brand-link flex items-center gap-2.5">
              <Image
                src="/brand/careeros-buddy.png"
                alt=""
                width={34}
                height={34}
                priority
                className="brand-buddy rounded-[10px]"
              />
              <p className="text-sm font-bold tracking-tight">
                Career<span className="text-blue-400">OS</span>
              </p>
            </div>
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
          className="mt-20 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70 shadow-2xl shadow-blue-950/20"
          aria-labelledby="landing-product-preview"
        >
          <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
            <div className="border-b border-slate-800 p-6 sm:p-8 lg:border-b-0 lg:border-r">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
                {t("landing.preview.eyebrow")}
              </p>
              <h2
                id="landing-product-preview"
                className="mt-3 text-2xl font-semibold tracking-tight"
              >
                {t("landing.preview.title")}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {t("landing.preview.description")}
              </p>
              <ul className="mt-6 space-y-3 text-sm text-slate-300">
                {["evidence", "review", "memory"].map((key) => (
                  <li key={key} className="flex gap-2">
                    <span
                      className="mt-0.5 text-emerald-400"
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                    {t(`landing.preview.${key}` as Parameters<typeof t>[0])}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-slate-950/55 p-4 sm:p-6">
              <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4 shadow-xl sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-400">
                      Databricks
                    </p>
                    <h3 className="mt-1 text-lg font-semibold">
                      {t("landing.preview.role")}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      San Francisco · Hybrid · {t("landing.preview.recent")}
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                    {t("landing.preview.verdict")}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ["landing.preview.evidenceFit", "landing.preview.strong"],
                    ["landing.preview.preferenceFit", "landing.preview.good"],
                    ["landing.preview.freshness", "landing.preview.recent"],
                    ["landing.preview.reviewState", "landing.preview.ready"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-xl border border-slate-800 bg-slate-900 p-3"
                    >
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">
                        {t(label as Parameters<typeof t>[0])}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-200">
                        {t(value as Parameters<typeof t>[0])}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t("landing.preview.why")}
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-slate-300">
                    <p>✓ {t("landing.preview.whyBackend")}</p>
                    <p>✓ {t("landing.preview.whyEvidence")}</p>
                    <p className="text-amber-300">
                      △ {t("landing.preview.whyGap")}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <span className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300">
                    {t("landing.preview.viewEvidence")}
                  </span>
                  <span className="rounded-lg bg-blue-500 px-3 py-2 text-xs font-semibold text-white">
                    {t("landing.preview.apply")}
                  </span>
                </div>
              </div>
            </div>
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
