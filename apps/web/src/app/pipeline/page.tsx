import { Suspense } from "react";

import { Spinner } from "@/components/ui/spinner";

import PipelineView from "./pipeline-view";

export default function PipelinePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <PipelineView />
    </Suspense>
  );
}
