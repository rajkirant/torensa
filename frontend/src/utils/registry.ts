import { lazy } from "react";

/**
 * Vite: include all page modules in build graph.
 * Supports .tsx and .ts (if you ever export React components from .ts, otherwise remove .ts)
 */
const modules = import.meta.glob("../pages/**/*.{tsx,ts}");

function toPageId(filePath: string) {
  const base = filePath
    .replace("../pages/", "")
    .replace(/\.(tsx|ts)$/, "")
    .split("/")
    .pop()!;

  // camelCase / PascalCase -> kebab-case
  return base
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

export const toolPages: Record<
  string,
  React.LazyExoticComponent<any>
> = Object.fromEntries(
  Object.entries(modules).map(([path, loader]) => [
    toPageId(path),
    lazy(() => loader() as Promise<any>),
  ]),
);
