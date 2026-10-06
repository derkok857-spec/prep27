"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { Logo } from "./Logo";

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center" aria-busy="true" aria-label="Loading">
      <Logo className="h-9 w-9 animate-pulse" />
    </div>
  );
}

// The app reads localStorage, the auth session and the local date, so it renders in the browser only.
const AppShell = dynamic(() => import("./AppShell").then((m) => m.AppShell), { ssr: false, loading: Splash });

export function ClientShell({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
