import { Suspense } from "react";

import { Spinner } from "@/components/ui/spinner";

import DiscoverView from "./discover-view";

export default function DiscoverPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <DiscoverView />
    </Suspense>
  );
}
