"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/** Width of an element in CSS pixels, kept current with a ResizeObserver. Charts draw at this size so text stays crisp. */
export function useMeasure<T extends HTMLElement>(fallback = 720): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}
