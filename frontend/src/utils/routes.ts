import React from "react";
import serviceCards from "../metadata/serviceCards.json";

type ServiceCardConfig = {
  id: string;
  path: string;
  authRequired?: boolean;
  pageId?: string;
  component?: string; // e.g. "BulkEmail/BulkEmail" or "TextToQr"
};

// 1) Build-time discovered modules (Vite style).
// This collects *all* .tsx files under /pages and allows dynamic lookup.
const pageModules = import.meta.glob("../pages/**/*.tsx");

// 2) Helper: convert "TextToQr" -> "../pages/TextToQr.tsx"
//            convert "BulkEmail/BulkEmail" -> "../pages/BulkEmail/BulkEmail.tsx"
function toPageKey(component: string) {
  return `../pages/${component}.tsx`;
}

// 3) Create a lazy component from a module key
function lazyFromKey(moduleKey: string): React.LazyExoticComponent<any> {
  const importer = pageModules[moduleKey];
  if (!importer) {
    // Fail fast with a helpful message
    return React.lazy(async () => {
      throw new Error(
        `No page module found for "${moduleKey}". ` +
          `Make sure the file exists under src/pages and ends with .tsx.`,
      );
    });
  }
  return React.lazy(importer as any);
}

// 4) Build the map from JSON
const tools = (serviceCards as ServiceCardConfig[]) ?? [];

export const toolComponentMap: Record<
  string,
  React.LazyExoticComponent<any>
> = tools.reduce(
  (acc, tool) => {
    const key = (tool.pageId ?? tool.id).toLowerCase();

    // Prefer explicit JSON mapping (recommended)
    if (tool.component) {
      const moduleKey = toPageKey(tool.component);
      acc[key] = lazyFromKey(moduleKey);
      return acc;
    }

    // Optional fallback: if you want, try to infer from id -> PascalCase file name.
    // Example "text-to-qr" -> "TextToQr" -> "../pages/TextToQr.tsx"
    // If you don’t want inference, delete this block.
    const inferred = tool.id
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
    const inferredKey = toPageKey(inferred);

    acc[key] = lazyFromKey(inferredKey);
    return acc;
  },
  {} as Record<string, React.LazyExoticComponent<any>>,
);
