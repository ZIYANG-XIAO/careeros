"use client";

import { ExperienceSection } from "@/components/experience-section";

import { MeTabs } from "../me-tabs";
import { CareerBrainGate, useCareerBrain } from "../use-career-brain";

export default function ExperiencePage() {
  const state = useCareerBrain();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <MeTabs />
      <CareerBrainGate state={state}>
        {(brain) => (
          <ExperienceSection
            experiences={brain.experiences}
            onMutate={state.refetch}
          />
        )}
      </CareerBrainGate>
    </div>
  );
}
