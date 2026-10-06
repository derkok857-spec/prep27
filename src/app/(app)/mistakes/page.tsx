import type { Metadata } from "next";
import { Suspense } from "react";
import { MistakesView } from "@/components/views/MistakesView";

export const metadata: Metadata = { title: "Mistake Bank" };

export default function MistakesPage() {
  return (
    <Suspense>
      <MistakesView />
    </Suspense>
  );
}
