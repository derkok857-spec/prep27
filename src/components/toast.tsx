"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "./ui";

type Kind = "info" | "good" | "bad";
interface Toast {
  id: number;
  text: string;
  kind: Kind;
}

const ToastCtx = createContext<(text: string, kind?: Kind) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback((text: string, kind: Kind = "info") => {
    const id = ++seq.current;
    setItems((xs) => [...xs.slice(-2), { id, text, kind }]);
    setTimeout(() => setItems((xs) => xs.filter((t) => t.id !== id)), kind === "bad" ? 6000 : 3200);
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-3">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === "bad" ? "alert" : "status"}
            className={cx(
              "toast-in pointer-events-auto max-w-md rounded-xl border px-4 py-2.5 text-sm shadow-lg",
              t.kind === "bad" && "border-bad/40 bg-bad-soft text-bad",
              t.kind === "good" && "border-good/40 bg-good-soft text-good",
              t.kind === "info" && "border-line-strong bg-surface text-ink",
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
