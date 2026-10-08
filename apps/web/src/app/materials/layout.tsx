import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";

export default function MaterialsLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
