"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Bug, CalendarRange, ChartColumn, FlaskConical, LayoutGrid, Library, LogOut, Menu, Settings, Sun, X } from "lucide-react";
import { diffDays, fmtDayYear } from "@/lib/dates";
import { LocalRepo } from "@/lib/repo/local";
import { SupabaseRepo } from "@/lib/repo/supabase";
import type { Repo } from "@/lib/repo/types";
import { cloudConfigured, getSupabase } from "@/lib/supabase/client";
import { DataProvider, useData } from "./data";
import { ToastProvider } from "./toast";
import { cx } from "./ui";
import { Logo } from "./Logo";
import { MODE_KEY } from "@/lib/mode";

type NavItem = { href: string; label: string; short: string; icon: typeof Sun; badge?: "lab" | "mistakes" | "today" };

const NAV: NavItem[] = [
  { href: "/", label: "Today", short: "Today", icon: Sun, badge: "today" },
  { href: "/plan", label: "Plan", short: "Plan", icon: CalendarRange },
  { href: "/modules", label: "Modules", short: "Modules", icon: Library },
  { href: "/lab", label: "Question Lab", short: "Lab", icon: FlaskConical, badge: "lab" },
  { href: "/mistakes", label: "Mistake Bank", short: "Mistakes", icon: Bug, badge: "mistakes" },
  { href: "/map", label: "Knowledge Map", short: "Map", icon: LayoutGrid },
  { href: "/dashboard", label: "Dashboard", short: "Stats", icon: ChartColumn },
  { href: "/settings", label: "Settings", short: "Settings", icon: Settings },
];

const MOBILE_TABS = ["/", "/plan", "/lab", "/mistakes"];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function demoRequested(): boolean {
  try {
    return window.localStorage.getItem(MODE_KEY) === "demo";
  } catch {
    return false;
  }
}

/** Client only (see ClientShell). Picks the repository: demo in this browser, or Supabase for a signed in user. */
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [repo, setRepo] = useState<Repo | null>(() => (!cloudConfigured || demoRequested() ? new LocalRepo() : null));
  const cloud = repo == null || repo.mode === "cloud";

  useEffect(() => {
    if (!cloud) return;
    const sb = getSupabase();
    let alive = true;
    sb.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (data.session) setRepo((r) => r ?? new SupabaseRepo(sb));
      else router.replace("/login");
    });
    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [cloud, router]);

  if (!repo) {
    return (
      <div className="flex min-h-screen items-center justify-center" aria-busy="true">
        <Logo className="h-9 w-9 animate-pulse" />
      </div>
    );
  }

  return (
    <ToastProvider>
      <DataProvider repo={repo}>
        <Chrome>{children}</Chrome>
      </DataProvider>
    </ToastProvider>
  );
}

function useBadges() {
  const { derived } = useData();
  return {
    today: derived.dueReviews.length + derived.dueMistakes.length,
    lab: derived.waiting.length,
    mistakes: derived.dueMistakes.length,
  };
}

function Chrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { mode, derived, ds, today } = useData();
  const badges = useBadges();
  const [drawer, setDrawer] = useState(false);

  const exitDemo = () => {
    try {
      window.localStorage.removeItem(MODE_KEY);
    } catch {
      // ignore
    }
    router.push("/login");
  };

  const signOut = async () => {
    if (mode === "cloud") await getSupabase().auth.signOut();
  };

  const days = derived.plan.daysToExam;
  const span = Math.max(1, diffDays(ds.profile.startDate, ds.profile.examDate));
  const elapsed = Math.min(1, Math.max(0, diffDays(ds.profile.startDate, today) / span));

  const navList = (onMobile: boolean) => (
    <ul className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        const n = item.badge ? badges[item.badge] : 0;
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={onMobile ? () => setDrawer(false) : undefined}
              className={cx(
                "flex items-center gap-3 rounded-xl px-3 font-medium transition-colors",
                onMobile ? "py-3 text-base" : "py-2 text-[14px]",
                active ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-ink-2 hover:bg-surface/70 hover:text-ink",
              )}
            >
              <Icon size={18} className={active ? "text-accent" : "text-ink-3"} aria-hidden />
              <span className="flex-1">{item.label}</span>
              {n > 0 ? (
                <span className="tabular rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-5 text-on-accent">{n}</span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  const footer = (
    <div className="mt-auto space-y-3 px-1">
      <div className="rounded-xl border border-line bg-surface p-3">
        <div className="tabular text-[13px] font-semibold text-ink">
          {days > 0 ? `${days} days to the exam` : days === 0 ? "Exam day" : "Exam window passed"}
        </div>
        <div className="mt-0.5 text-[12px] text-ink-3">{fmtDayYear(ds.profile.examDate)}</div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden>
          <div className="h-full rounded-full bg-accent" style={{ width: `${elapsed * 100}%` }} />
        </div>
      </div>
      {mode === "demo" ? (
        <button
          type="button"
          onClick={exitDemo}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[13px] text-ink-3 hover:bg-surface hover:text-ink"
        >
          <LogOut size={16} aria-hidden /> {cloudConfigured ? "Exit demo" : "Demo mode"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[13px] text-ink-3 hover:bg-surface hover:text-ink"
        >
          <LogOut size={16} aria-hidden /> Sign out
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-5 border-r border-line bg-canvas px-3 py-5 md:flex">
        <Link href="/" className="flex items-center gap-2 px-2">
          <Logo className="h-7 w-7" />
          <span className="ui-brand text-[17px] font-semibold tracking-tight">Prep27</span>
        </Link>
        <nav aria-label="Main">{navList(false)}</nav>
        {footer}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-6 w-6" />
          <span className="font-semibold tracking-tight">Prep27</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="tabular text-[12px] text-ink-3">{days > 0 ? `${days} days left` : ""}</span>
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={drawer}
            onClick={() => setDrawer(true)}
            className="rounded-lg p-2 text-ink-2 hover:bg-sunken"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {drawer ? (
        <div className="fixed inset-0 z-40 flex flex-col bg-canvas px-4 py-3 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 font-semibold">
              <Logo className="h-6 w-6" /> Prep27
            </span>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setDrawer(false)}
              className="rounded-lg p-2 text-ink-2 hover:bg-sunken"
            >
              <X size={20} />
            </button>
          </div>
          <nav aria-label="Main" className="flex-1 overflow-y-auto">
            {navList(true)}
          </nav>
          {footer}
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        {mode === "demo" ? (
          <div className="border-b border-mid/30 bg-mid-soft px-4 py-2 text-center text-[13px] text-mid">
            Demo with sample data. Everything you change stays in this browser.
            {cloudConfigured ? (
              <button type="button" onClick={exitDemo} className="ml-2 font-semibold underline underline-offset-2">
                Sign in instead
              </button>
            ) : null}
          </div>
        ) : null}
        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 sm:px-6 md:pb-12 md:pt-8">{children}</main>
        <footer className="mx-auto hidden max-w-5xl px-6 pb-8 text-[12px] text-ink-3 md:block">
          Prep27 is an independent study tool and is not affiliated with or endorsed by CFA Institute. CFA® and Chartered Financial Analyst®
          are trademarks owned by CFA Institute.
        </footer>
      </div>

      {/* Mobile tab bar */}
      <nav
        aria-label="Quick"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {NAV.filter((n) => MOBILE_TABS.includes(n.href)).map((item) => {
          const active = isActive(pathname, item.href);
          const n = item.badge ? badges[item.badge] : 0;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
                active ? "text-accent" : "text-ink-3",
              )}
            >
              <Icon size={20} aria-hidden />
              {item.short}
              {n > 0 ? (
                <span className="tabular absolute right-[22%] top-1 rounded-full bg-accent px-1 text-[10px] font-semibold leading-4 text-on-accent">
                  {n}
                </span>
              ) : null}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setDrawer(true)}
          className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-ink-3"
        >
          <Menu size={20} aria-hidden />
          More
        </button>
      </nav>
    </div>
  );
}
