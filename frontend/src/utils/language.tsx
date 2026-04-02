import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import serviceCardsEn from "../metadata/serviceCards.json";
import serviceCardsDe from "../metadata/serviceCards.de.json";
import type { ServiceCardConfig } from "./serviceCards";

export type LanguageCode = "en" | "de";

const LANGUAGE_STORAGE_KEY = "language";
const DEFAULT_LANGUAGE: LanguageCode = "en";

type LanguageContextValue = {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
};

const LanguageContext = createContext<LanguageContextValue>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const derivedLanguage = useMemo<LanguageCode>(() => {
    const fromPath = getLanguageFromPath(location.pathname);
    return fromPath ?? DEFAULT_LANGUAGE;
  }, [location.pathname]);

  const [language, setLanguageState] = useState<LanguageCode>(derivedLanguage);

  useEffect(() => {
    if (language !== derivedLanguage) {
      setLanguageState(derivedLanguage);
    }
  }, [derivedLanguage, language]);

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  const setLanguage = (nextLanguage: LanguageCode) => {
    setLanguageState(nextLanguage);
  };

  const value = useMemo(
    () => ({
      language,
      setLanguage,
    }),
    [language],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function getLanguageFromPath(pathname: string): LanguageCode | null {
  if (!pathname) return null;
  const trimmed = pathname.trim();
  if (trimmed === "/de" || trimmed.startsWith("/de/")) return "de";
  if (trimmed === "/en" || trimmed.startsWith("/en/")) return "en";
  return null;
}

export function stripLanguagePrefix(pathname: string) {
  if (!pathname) return "/";
  const trimmed = pathname.trim();
  if (trimmed === "/de" || trimmed === "/en") return "/";
  if (trimmed.startsWith("/de/")) return `/${trimmed.slice(4)}`;
  if (trimmed.startsWith("/en/")) return `/${trimmed.slice(4)}`;
  return trimmed;
}

export function withLanguagePrefix(
  pathname: string,
  language: LanguageCode,
  options: { forcePrefix?: boolean } = {},
) {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (language !== "de" && !options.forcePrefix) {
    return stripLanguagePrefix(normalized);
  }
  const stripped = stripLanguagePrefix(normalized);
  return stripped === "/" ? `/${language}` : `/${language}${stripped}`;
}

export function getServiceCardsForLanguage(language: LanguageCode) {
  return (language === "de" ? serviceCardsDe : serviceCardsEn) as ServiceCardConfig[];
}

export function useServiceCards() {
  const { language } = useLanguage();
  return useMemo(() => getServiceCardsForLanguage(language), [language]);
}
