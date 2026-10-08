"use client";

import { SkillSection } from "@/components/skill-section";

import { MeTabs } from "../me-tabs";
import { CareerBrainGate, useCareerBrain } from "../use-career-brain";

export default function SkillsPage() {
  const state = useCareerBrain();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <MeTabs />
      <CareerBrainGate state={state}>
        {(brain) => (
          <SkillSection skills={brain.skills} onMutate={state.refetch} />
        )}
      </CareerBrainGate>
    </div>
  );
}
