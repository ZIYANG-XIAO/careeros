"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";

import { CareerBrainOverview } from "@/components/career-brain-overview";
import { RequirementGapsCard } from "@/components/requirement-gaps-card";
import { Spinner } from "@/components/ui/spinner";
import {
  getContactInfo,
  getRequirementGaps,
  listJobSearchGoals,
  listPendingResumeImports,
  listResumes,
  listReusableAnswers,
} from "@/lib/api";
import type {
  ContactInfo,
  JobSearchGoal,
  PendingResumeImport,
  RequirementGapsResponse,
  ResumeSummary,
  ReusableAnswer,
} from "@/lib/types";

import { MeTabs } from "./me-tabs";
import { CareerBrainGate, useCareerBrain } from "./use-career-brain";

type ProfileExtras = {
  resumes: ResumeSummary[] | null;
  contact: ContactInfo | null;
  goals: JobSearchGoal[] | null;
  answers: ReusableAnswer[] | null;
  pendingImports: PendingResumeImport[] | null;
  gaps: RequirementGapsResponse | null;
};

const NO_EXTRAS: ProfileExtras = {
  resumes: null,
  contact: null,
  goals: null,
  answers: null,
  pendingImports: null,
  gaps: null,
};

export default function CareerBrainPage() {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const state = useCareerBrain();
  const [extras, setExtras] = useState<ProfileExtras | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      if (!token || cancelled) return;
      // Each source only enriches the overview; one failing shows as
      // "unknown" there rather than blocking the profile.
      const optional = <T,>(promise: Promise<T>) => promise.catch(() => null);
      const [resumes, contact, goals, answers, pendingImports, gaps] =
        await Promise.all([
          optional(listResumes(token)),
          optional(getContactInfo(token)),
          optional(listJobSearchGoals(token)),
          optional(listReusableAnswers(token)),
          optional(listPendingResumeImports(token)),
          optional(getRequirementGaps(token)),
        ]);
      if (!cancelled) {
        setExtras({ resumes, contact, goals, answers, pendingImports, gaps });
      }
    })().catch(() => {
      if (!cancelled) setExtras(NO_EXTRAS);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, userId]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <MeTabs />
      <CareerBrainGate state={state}>
        {(brain) =>
          extras === null ? (
            <Spinner />
          ) : (
            <>
              <CareerBrainOverview
                brain={brain}
                resumes={extras.resumes}
                contact={extras.contact}
                goals={extras.goals}
                answers={extras.answers}
                pendingImports={extras.pendingImports}
              />
              <RequirementGapsCard gaps={extras.gaps} />
            </>
          )
        }
      </CareerBrainGate>
    </div>
  );
}
