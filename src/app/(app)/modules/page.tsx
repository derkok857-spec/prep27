import type { Metadata } from "next";
import { Suspense } from "react";
import { ModulesView } from "@/components/views/ModulesView";

export const metadata: Metadata = { title: "Modules" };

export default function ModulesPage() {
  return (
    <Suspense>
      <ModulesView />
    </Suspense>
  );
}
