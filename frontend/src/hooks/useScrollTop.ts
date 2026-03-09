import { useEffect } from "react";

type UseScrollTopOptions = {
  behavior?: ScrollBehavior;
};

export function useScrollTop(deps: unknown[] = [], options: UseScrollTopOptions = {}) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: options.behavior ?? "auto",
    });
  }, deps);
}
