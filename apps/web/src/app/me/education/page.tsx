"use client";

import { EducationSection } from "@/components/education-section";

import { MeTabs } from "../me-tabs";
import { CareerBrainGate, useCareerBrain } from "../use-career-brain";

export default function EducationPage() {
  const state = useCareerBrain();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <MeTabs />
      <CareerBrainGate state={state}>
        {(brain) => (
          <EducationSection
            educations={brain.educations}
            onMutate={state.refetch}
          />
        )}
      </CareerBrainGate>
    </div>
  );
}
