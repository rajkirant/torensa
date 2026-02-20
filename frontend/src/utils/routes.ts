import React, { lazy } from "react";
import serviceCards from "../metadata/serviceCards.json";
import HomePage from "../pages/Home";

/* ===================== APP PAGES ===================== */
export const Home = HomePage;
export const Contact = lazy(() => import("../pages/Contact"));
export const Login = lazy(() => import("../pages/Login"));
export const Signup = lazy(() => import("../pages/Signup"));
export const NotFound = lazy(() => import("../pages/NotFound"));

/* ===================== TOOL CONFIG ===================== */
type ServiceCardConfig = {
  id: string;
  component: string;
  isActive?: boolean;
};

const tools = (serviceCards as ServiceCardConfig[]).filter(
  (tool) => tool.isActive !== false,
);

// Grab tool pages under /pages at build time.
// Exclude app-shell pages that are imported through dedicated routes.
const pageModules = import.meta.glob([
  "../pages/**/*.tsx",
  "!../pages/Home.tsx",
  "!../pages/Contact.tsx",
  "!../pages/Login.tsx",
  "!../pages/Signup.tsx",
  "!../pages/NotFound.tsx",
  "!../pages/ProtectedRoute.tsx",
]);

function toModuleKey(component: string) {
  return `../pages/${component}.tsx`;
}

function lazyFrom(component: string): React.LazyExoticComponent<any> {
  const moduleKey = toModuleKey(component);
  const importer = pageModules[moduleKey];

  if (!importer) {
    return React.lazy(async () => {
      throw new Error(
        `routes.ts: Cannot find module "${moduleKey}". ` +
          `Check serviceCards.json component="${component}" and file casing.`,
      );
    });
  }

  return React.lazy(importer as any);
}

/* ===================== TOOL ROUTES ===================== */
export const toolComponentMap: Record<
  string,
  React.LazyExoticComponent<any>
> = tools.reduce(
  (acc, tool) => {
    acc[tool.id.toLowerCase()] = lazyFrom(tool.component);
    return acc;
  },
  {} as Record<string, React.LazyExoticComponent<any>>,
);
