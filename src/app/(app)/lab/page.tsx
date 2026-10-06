import type { Metadata } from "next";
import { Suspense } from "react";
import { LabView } from "@/components/views/LabView";

export const metadata: Metadata = { title: "Question Lab" };

export default function LabPage() {
  return (
    <Suspense>
      <LabView />
    </Suspense>
  );
}
