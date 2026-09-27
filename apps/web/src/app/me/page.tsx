"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";

import { EducationSection } from "@/components/education-section";
import { ExperienceSection } from "@/components/experience-section";
import { CareerBrainOverview } from "@/components/career-brain-overview";
import { ProjectSection } from "@/components/project-section";
import { SkillSection } from "@/components/skill-section";
import { Spinner } from "@/components/ui/spinner";
import { getCareerBrain } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { CareerBrain } from "@/lib/types";

import { MeTabs } from "./me-tabs";

export default function CareerBrainPage() {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const { user } = useUser();
  const { t } = useI18n();
  const retryLabel = t("errors.retry");
  const [brain, setBrain] = useState<CareerBrain | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const [prevUserId, setPrevUserId] = useState(userId);
  if (userId !== prevUserId) {
    setPrevUserId(userId);
    setBrain(null);
    setError(null);
  }

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let cancelled = false;

    async function load() {
      try {
        const token = await getToken();
        if (cancelled) return;
        if (!token) {
          setError(t("career.authTokenError"));
          return;
        }
        const brainData = await getCareerBrain(token);
        if (cancelled) return;
        setBrain(brainData);
        setError(null);
      } catch {
        if (!cancelled) {
          setError(t("career.loadError"));
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId, getToken, fetchKey, t]);

  const refetch = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await getCareerBrain(token);
      setBrain(data);
      setError(null);
    } catch {
      setError(t("career.loadError"));
    }
  }, [getToken, t]);

  const dataLoading =
    isLoaded && isSignedIn && brain === null && error === null;

  if (!isLoaded) {
    return <Spinner />;
  }

  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-border bg-surface p-8 text-center">
        <h1 className="text-lg font-semibold text-ink">
          {t("career.signInRequired.title")}
        </h1>
        <p className="mt-2 text-sm text-ink-3">
          {t("career.signInRequired.description")}
        </p>
      </div>
    );
  }

  if (dataLoading) {
    return <Spinner />;
  }

  if (error || !brain) {
    return (
      <div className="rounded-xl border border-evidence-gap-border bg-evidence-gap-bg p-6 text-center">
        <p className="text-sm font-medium text-[#6F3627]">
          {error || t("errors.unknown")}
        </p>
        <button
          onClick={() => {
            setError(null);
            setBrain(null);
            setFetchKey((k) => k + 1);
          }}
          className="mt-3 text-sm font-medium text-[#8A4530] underline hover:text-[#6F3627]"
        >
          {retryLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-2xl border border-border bg-surface px-5 py-6 shadow-sm sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          {t("career.eyebrow")}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {t("career.title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-2">
          {t("career.intro")}
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-3">
          {t("me.notAResume")}
        </p>
        {user?.primaryEmailAddress?.emailAddress && (
          <p className="mt-4 text-xs font-medium text-ink-3">
            {t("career.signedInAs")} {user.primaryEmailAddress.emailAddress}
          </p>
        )}
      </div>

      <MeTabs />

      <CareerBrainOverview brain={brain} />

      <div id="education">
        <EducationSection educations={brain.educations} onMutate={refetch} />
      </div>
      <div id="experience">
        <ExperienceSection experiences={brain.experiences} onMutate={refetch} />
      </div>
      <div id="projects">
        <ProjectSection projects={brain.projects} onMutate={refetch} />
      </div>
      <div id="skills">
        <SkillSection skills={brain.skills} onMutate={refetch} />
      </div>
    </div>
  );
}
