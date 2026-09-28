"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";

import { JobSearchGoalsManager } from "@/components/job-search-goals-manager";
import { LoadErrorBanner } from "@/components/load-error-banner";
import { Spinner } from "@/components/ui/spinner";
import { listJobSearchGoals, listResumes } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { JobSearchGoal, ResumeSummary } from "@/lib/types";
import { useDataFetch } from "@/lib/use-data-fetch";

import { MeTabs } from "../me-tabs";

type GoalsData = {
  goals: JobSearchGoal[];
  resumes: ResumeSummary[];
};

export default function JobSearchGoalsPage() {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const { t } = useI18n();
  const fetchGoals = useCallback(async (): Promise<GoalsData> => {
    const token = await getToken();
    if (!token) throw new Error("Missing authentication token");
    const [goals, resumes] = await Promise.all([
      listJobSearchGoals(token),
      listResumes(token),
    ]);
    return { goals, resumes };
  }, [getToken]);

  const { data, isInitialLoading, loadError, retry } = useDataFetch<GoalsData>({
    enabled: isLoaded && isSignedIn,
    resetKey: userId ?? undefined,
    initialData: { goals: [], resumes: [] },
    fetch: fetchGoals,
    deps: [getToken, isLoaded, isSignedIn],
  });

  if (!isLoaded || (isSignedIn && isInitialLoading)) return <Spinner />;
  if (!isSignedIn) {
    return <p className="text-sm text-ink-2">{t("home.signInRequired")}</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <MeTabs />
      {loadError ? (
        <LoadErrorBanner
          error={loadError}
          onRetry={retry}
          retryLabel={t("errors.retry")}
          t={t}
        />
      ) : (
        <JobSearchGoalsManager
          initialGoals={data.goals}
          resumes={data.resumes}
        />
      )}
    </div>
  );
}
