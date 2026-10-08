"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useCallback } from "react";

import { CompanyMark } from "@/components/company-mark";
import { LoadErrorBanner } from "@/components/load-error-banner";
import { Spinner } from "@/components/ui/spinner";
import { getJob, listResumes } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { Job, ResumeSummary } from "@/lib/types";
import { useDataFetch } from "@/lib/use-data-fetch";

import { DraftsTab } from "../drafts-tab";
import { PrepTab } from "../prep-tab";
import { TailorTab } from "../tailor-tab";

type Tab = "tailor" | "drafts" | "prep";
const TABS: Tab[] = ["tailor", "drafts", "prep"];

export default function MaterialsPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const { t } = useI18n();
  const requested = searchParams.get("tab");
  const tab: Tab = TABS.includes(requested as Tab)
    ? (requested as Tab)
    : "tailor";

  const fetchContext = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error("Missing authentication token");
    const [job, resumes] = await Promise.all([
      getJob(token, jobId),
      listResumes(token),
    ]);
    return { job, resumes };
  }, [getToken, jobId]);

  const { data, isInitialLoading, loadError, retry } = useDataFetch<{
    job: Job | null;
    resumes: ResumeSummary[];
  }>({
    enabled: isLoaded && Boolean(isSignedIn),
    resetKey: `${userId ?? ""}:${jobId}`,
    initialData: { job: null, resumes: [] },
    fetch: fetchContext,
    deps: [getToken, isLoaded, isSignedIn, jobId],
  });

  if (!isLoaded || isInitialLoading) return <Spinner />;
  if (loadError) {
    return (
      <LoadErrorBanner
        error={loadError}
        onRetry={retry}
        retryLabel={t("errors.retry")}
        t={t}
      />
    );
  }
  const { job, resumes } = data;
  if (!job) return <Spinner />;

  const labels: Record<Tab, string> = {
    tailor: t("materials.tab.tailor"),
    drafts: t("materials.tab.drafts"),
    prep: t("materials.tab.prep"),
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link
        href={`/discover?focus=${job.id}`}
        className="text-sm font-semibold text-accent hover:underline print:hidden"
      >
        ← {t("materials.back")}
      </Link>
      <header className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          {t("materials.eyebrow")}
        </p>
        <div className="mt-3 flex items-start gap-4">
          <CompanyMark company={job.company} size="lg" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-2">{job.company}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              {job.title}
            </h1>
          </div>
        </div>
        <p className="mt-4 rounded-lg bg-accent-tint px-3 py-2 text-xs leading-5 text-ink-2">
          {t("materials.promise")}
        </p>
      </header>

      <nav
        aria-label={t("materials.eyebrow")}
        className="flex gap-1 border-b border-border print:hidden"
      >
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            aria-current={tab === key ? "page" : undefined}
            onClick={() => router.replace(`${pathname}?tab=${key}`)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
              tab === key
                ? "border-accent text-accent"
                : "border-transparent text-ink-3 hover:text-ink-2"
            }`}
          >
            {labels[key]}
          </button>
        ))}
      </nav>

      {tab === "tailor" && <TailorTab jobId={job.id} resumes={resumes} />}
      {tab === "drafts" && <DraftsTab jobId={job.id} />}
      {tab === "prep" && <PrepTab jobId={job.id} />}
    </div>
  );
}
