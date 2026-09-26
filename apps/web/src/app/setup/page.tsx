"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useI18n } from "@/lib/i18n";

const CLERK_EXTENSION_DOCS =
  "https://clerk.com/docs/reference/chrome-extension/overview";

function SetupSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
        {children}
      </div>
    </section>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800">
      {children}
    </pre>
  );
}

export default function SetupPage() {
  const { t } = useI18n();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
          {t("setup.eyebrow")}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          {t("setup.title")}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          {t("setup.subtitle")}
        </p>
        <p className="mt-4 text-sm">
          <Link
            href="/welcome#extension-setup"
            className="font-medium text-blue-700 hover:text-blue-800"
          >
            {t("setup.backToWelcome")}
          </Link>
        </p>
      </header>

      <SetupSection title={t("setup.buildExtension.title")}>
        <p>{t("setup.buildExtension.body")}</p>
        <CodeBlock>npm run extension:build</CodeBlock>
      </SetupSection>

      <SetupSection title={t("setup.loadChrome.title")}>
        <p>{t("setup.loadChrome.body")}</p>
        <CodeBlock>apps/extension/build</CodeBlock>
      </SetupSection>

      <SetupSection title={t("setup.reload.title")}>
        <p>{t("setup.reload.body")}</p>
      </SetupSection>

      <SetupSection title={t("setup.clerk.title")}>
        <p>{t("setup.clerk.body")}</p>
        <p>
          <a
            href={CLERK_EXTENSION_DOCS}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blue-700 hover:text-blue-800"
          >
            {t("setup.clerk.link")}
          </a>
        </p>
      </SetupSection>

      <SetupSection title={t("setup.verify.title")}>
        <p>{t("setup.verify.body")}</p>
      </SetupSection>

      <SetupSection title={t("setup.fixture.title")}>
        <p>{t("setup.fixture.body")}</p>
        <CodeBlock>
          {`npm --workspace @careeros/extension run fixture\nhttp://localhost:4173/application-page.html`}
        </CodeBlock>
      </SetupSection>

      <SetupSection title={t("setup.devNote.title")}>
        <p>{t("setup.devNote.body")}</p>
      </SetupSection>

      <SetupSection title={t("setup.issues.title")}>
        <ul className="list-disc space-y-4 pl-5">
          <li>
            <strong className="text-slate-900">
              {t("setup.issues.oldBehavior.title")}
            </strong>
            <p className="mt-1">{t("setup.issues.oldBehavior.body")}</p>
          </li>
          <li>
            <strong className="text-slate-900">
              {t("setup.issues.authFails.title")}
            </strong>
            <p className="mt-1">{t("setup.issues.authFails.body")}</p>
          </li>
          <li>
            <strong className="text-slate-900">
              {t("setup.issues.fieldsNotDetected.title")}
            </strong>
            <p className="mt-1">{t("setup.issues.fieldsNotDetected.body")}</p>
          </li>
        </ul>
      </SetupSection>
    </div>
  );
}
