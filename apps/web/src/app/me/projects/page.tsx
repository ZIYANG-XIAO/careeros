"use client";

import { ProjectSection } from "@/components/project-section";

import { MeTabs } from "../me-tabs";
import { CareerBrainGate, useCareerBrain } from "../use-career-brain";

export default function ProjectsPage() {
  const state = useCareerBrain();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <MeTabs />
      <CareerBrainGate state={state}>
        {(brain) => (
          <ProjectSection projects={brain.projects} onMutate={state.refetch} />
        )}
      </CareerBrainGate>
    </div>
  );
}
