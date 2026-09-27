"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getCareerBrain, listResumes } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  deriveOnboardingSteps,
  setOnboardingSkipCookie,
  type OnboardingStep,
  type StepStatus,
} from "@/lib/onboarding";
import type { CareerBrain, ResumeSummary } from "@/lib/types";

function stepLabelKey(step: OnboardingStep["id"]) {
  switch (step) {
    case "upload_resume":
      return "start.step1";
    case "review_career_brain":
      return "start.step2";
    case "contact_info":
      return "welcome.steps.contactInfo";
    case "extension_setup":
      return "welcome.steps.extensionSetup";
    case "browse_jobs":
      return "start.step3";
  }
}

function statusLabelKey(status: StepStatus) {
  switch (status) {
    case "completed":
      return "welcome.status.completed";
    case "current":
      return "welcome.status.current";
    case "optional":
      return "welcome.status.optional";
  }
}

function statusClasses(status: StepStatus) {
  switch (status) {
    case "completed":
      return "border-evidence-strong-border bg-evidence-strong-bg text-status-offer-ink";
    case "current":
      return "border-accent-soft-border bg-accent-tint text-accent";
    case "optional":
      return "border-border bg-rail text-ink-3";
  }
}

export default function StartPage() {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const [resumes, setResumes] = useState<ResumeSummary[] | null>(null);
  const [brain, setBrain] = useState<CareerBrain | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const fetchProgressData = useCallback(async () => {
    const token = await getToken();
    if (!token) return null;
    const [resumeData, brainData] = await Promise.all([
      listResumes(token),
      getCareerBrain(token),
    ]);
    return { resumeData, brainData };
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let cancelled = false;

    void (async () => {
      try {
        const result = await fetchProgressData();
        if (cancelled) return;
        if (!result) {
          setLoadError(t("welcome.loadError"));
          return;
        }
        setResumes(result.resumeData);
        setBrain(result.brainData);
        setLoadError(null);
      } catch {
        if (!cancelled) {
          setLoadError(t("welcome.loadError"));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchProgressData, isLoaded, isSignedIn, t]);

  async function retryLoadProgress() {
    setRetrying(true);
    setLoadError(null);
    try {
      const result = await fetchProgressData();
      if (!result) {
        setLoadError(t("welcome.loadError"));
        return;
      }
      setResumes(result.resumeData);
      setBrain(result.brainData);
      setLoadError(null);
    } catch {
      setLoadError(t("welcome.loadError"));
    } finally {
      setRetrying(false);
    }
  }

  function handleBrowseDiscover() {
    if (userId) {
      setOnboardingSkipCookie(userId);
    }
    router.push("/discover");
  }

  const loading =
    isLoaded && isSignedIn && resumes === null && brain === null && !loadError;
  const steps =
    !loadError && resumes && brain ? deriveOnboardingSteps(resumes, brain) : [];

  if (!isLoaded || loading) return <Spinner />;

  if (!isSignedIn) {
    return <p className="text-sm text-ink-2">{t("welcome.signInRequired")}</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {t("start.title")}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-2">
          {t("start.body")}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/me/resumes?upload=1">
            <Button>{t("start.step1")}</Button>
          </Link>
          <Link href="/me">
            <Button variant="secondary">{t("start.byHand")}</Button>
          </Link>
          <Button variant="ghost" onClick={handleBrowseDiscover}>
            {t("start.browseDiscover")}
          </Button>
        </div>
      </section>

      <section
        className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8"
        aria-labelledby="onboarding-progress-heading"
      >
        <h2
          id="onboarding-progress-heading"
          className="text-base font-semibold text-ink"
        >
          {t("welcome.progress.title")}
        </h2>
        {loadError ? (
          <div
            className="mt-4 rounded-lg border border-evidence-gap-border bg-evidence-gap-bg p-4 text-sm text-[#6F3627]"
            role="alert"
          >
            <p>{loadError}</p>
            <Button
              variant="secondary"
              className="mt-3"
              onClick={() => void retryLoadProgress()}
              disabled={retrying}
            >
              {t("errors.retry")}
            </Button>
          </div>
        ) : (
          <ol className="mt-4 space-y-3">
            {steps.map((step, index) => (
              <li key={step.id}>
                <Link
                  href={step.href}
                  className="flex items-start gap-3 rounded-xl border border-border p-4 transition hover:border-border hover:bg-sunken"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sunken text-xs font-semibold text-ink-2">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">
                      {t(stepLabelKey(step.id))}
                    </span>
                    <span
                      className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusClasses(step.status)}`}
                    >
                      {t(statusLabelKey(step.status))}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section
        id="extension-setup"
        className="rounded-2xl border border-dashed border-border bg-surface p-6 sm:p-8"
      >
        <h2 className="text-base font-semibold text-ink">
          {t("welcome.extensionSetup.title")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-2">
          {t("welcome.extensionSetup.description")}
        </p>
        <Link
          href="/setup"
          className="mt-4 inline-flex text-sm font-medium text-accent hover:text-accent-hover"
        >
          {t("welcome.extensionSetup.link")}
        </Link>
      </section>
    </div>
  );
}
