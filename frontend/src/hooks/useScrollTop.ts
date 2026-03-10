import { useEffect, useRef } from "react";

type UseScrollTopOptions = {
  behavior?: ScrollBehavior;
};

export function useScrollTop(
  deps: unknown[] = [],
  options: UseScrollTopOptions = {},
) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: options.behavior ?? "auto",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

type UseScrollBottomOptions = {
  behavior?: ScrollBehavior;
};

/**
 * Returns a ref to attach to the scroll container element.
 * Scrolls to the bottom whenever `deps` change.
 */
export function useScrollBottom<T extends HTMLElement>(
  deps: unknown[] = [],
  options: UseScrollBottomOptions = {},
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: options.behavior ?? "smooth",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}
