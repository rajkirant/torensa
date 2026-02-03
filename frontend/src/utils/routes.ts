import React from "react";
import serviceCards from "../metadata/serviceCards.json";

type ServiceCardConfig = {
  id: string;
  pageId?: string;
  component: string; // ✅ required now
};

const tools = serviceCards as ServiceCardConfig[];

// Grab all TSX pages under /pages at build time
const pageModules = import.meta.glob("../pages/**/*.tsx");

function toModuleKey(component: string) {
  // component like "ExcelUploadToCsv" or "BulkEmail/BulkEmail"
  return `../pages/${component}.tsx`;
}

function lazyFrom(component: string): React.LazyExoticComponent<any> {
  const moduleKey = toModuleKey(component);
  const importer = pageModules[moduleKey];

  if (!importer) {
    // Fail with a helpful message if JSON points to a non-existent file
    return React.lazy(async () => {
      throw new Error(
        `toolPages: Cannot find module "${moduleKey}". ` +
          `Check serviceCards.json component="${component}" and file casing.`,
      );
    });
  }

  return React.lazy(importer as any);
}

/**
 * Build map:
 * key = (pageId ?? id).toLowerCase()
 * value = lazy component resolved from tool.component
 */
export const toolComponentMap: Record<
  string,
  React.LazyExoticComponent<any>
> = tools.reduce(
  (acc, tool) => {
    const key = (tool.pageId ?? tool.id).toLowerCase();
    acc[key] = lazyFrom(tool.component);
    return acc;
  },
  {} as Record<string, React.LazyExoticComponent<any>>,
);
