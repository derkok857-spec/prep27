"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, Bug, CalendarRange, FlaskConical, LayoutGrid } from "lucide-react";
import { cloudConfigured, getSupabase } from "@/lib/supabase/client";
import { MODE_KEY } from "@/lib/mode";
import { Logo } from "../Logo";
import { Button, Field, inputClass } from "../ui";

const FEATURES = [
  {
    icon: CalendarRange,
    title: "Adaptive plan",
    text: "Recomputes every day from what you actually finished and how many hours you really have.",
  },
  { icon: Bug, title: "Mistake bank", text: "Every miss comes back after 3, 7 and 21 days, and the app flags the patterns behind them." },
  { icon: FlaskConical, title: "Question Lab", text: "A weekly AI run writes and verifies practice questions aimed at your weak spots." },
  { icon: LayoutGrid, title: "Knowledge map", text: "The whole curriculum sized by exam weight and colored by how well you know it." },
];

export function LoginView() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openDemo = () => {
    try {
      window.localStorage.setItem(MODE_KEY, "demo");
    } catch {
      // storage blocked, the app falls back to memory
    }
    router.push("/");
  };

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) {
      setError(err.message === "Invalid login credentials" ? "That email and password do not match." : err.message);
      return;
    }
    try {
      window.localStorage.removeItem(MODE_KEY);
    } catch {
      // ignore
    }
    router.replace("/");
  };

  return (
    <div className="mx-auto grid min-h-screen max-w-5xl grid-cols-1 items-center gap-10 px-5 py-10 md:grid-cols-2">
      <div>
        <div className="mb-6 flex items-center gap-2.5">
          <Logo className="h-9 w-9" />
          <span className="text-2xl font-semibold tracking-tight">Prep27</span>
        </div>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">A study system for the May 2027 Level I exam.</h1>
        <p className="mt-3 text-ink-2">
          Prep27 plans your study, keeps every mistake until you stop making it, writes practice questions aimed at your weak spots and
          shows what you actually know.
        </p>
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex gap-3">
              <f.icon size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              <div>
                <p className="text-sm font-semibold">{f.title}</p>
                <p className="text-[13px] text-ink-3">{f.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
        {cloudConfigured ? (
          <form onSubmit={signIn} className="space-y-4">
            <h2 className="text-lg font-semibold">Sign in</h2>
            <Field label="Email">
              <input
                type="email"
                autoComplete="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                autoComplete="current-password"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
            {error ? (
              <p role="alert" className="text-sm text-bad">
                {error}
              </p>
            ) : null}
            <Button variant="primary" type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        ) : (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Demo deployment</h2>
            <p className="text-sm text-ink-2">
              This copy of Prep27 has no database connected, so it runs on sample data stored in your browser.
            </p>
          </div>
        )}
        <div className="mt-6 border-t border-line pt-5">
          <p className="mb-3 text-sm text-ink-3">Want to look around first? The demo has seven weeks of sample study data.</p>
          <Button onClick={openDemo} className="w-full" variant={cloudConfigured ? "secondary" : "primary"}>
            Explore the demo <ArrowRight size={16} aria-hidden />
          </Button>
        </div>
      </div>
      <p className="text-[12px] text-ink-3 md:col-span-2">
        Independent study tool, not affiliated with or endorsed by CFA Institute. CFA® and Chartered Financial Analyst® are trademarks owned
        by CFA Institute.
      </p>
    </div>
  );
}
