import type { ReactNode } from "react";
import { ClientShell } from "@/components/ClientShell";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <ClientShell>{children}</ClientShell>;
}
