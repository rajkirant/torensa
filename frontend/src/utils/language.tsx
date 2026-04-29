import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import serviceCardsEn from "../metadata/serviceCards.json";
import serviceCardsDe from "../metadata/serviceCards.de.json";
import serviceCardsNl from "../metadata/serviceCards.nl.json";
import translationsEn from "../metadata/translations.json";
import translationsDe from "../metadata/translations.de.json";
import translationsNl from "../metadata/translations.nl.json";
import type { ServiceCardConfig } from "./serviceCards";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: translationsEn },
    de: { translation: translationsDe },
    nl: { translation: translationsNl },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export type LanguageCode = "en" | "de" | "nl";

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
    if (i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
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
  if (trimmed === "/nl" || trimmed.startsWith("/nl/")) return "nl";
  if (trimmed === "/en" || trimmed.startsWith("/en/")) return "en";
  return null;
}

export function stripLanguagePrefix(pathname: string) {
  if (!pathname) return "/";
  const trimmed = pathname.trim();
  if (trimmed === "/de" || trimmed === "/en" || trimmed === "/nl") return "/";
  if (trimmed.startsWith("/de/")) return `/${trimmed.slice(4)}`;
  if (trimmed.startsWith("/nl/")) return `/${trimmed.slice(4)}`;
  if (trimmed.startsWith("/en/")) return `/${trimmed.slice(4)}`;
  return trimmed;
}

export function withLanguagePrefix(
  pathname: string,
  language: LanguageCode,
  options: { forcePrefix?: boolean } = {},
) {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (language !== "de" && language !== "nl" && !options.forcePrefix) {
    return stripLanguagePrefix(normalized);
  }
  const stripped = stripLanguagePrefix(normalized);
  return stripped === "/" ? `/${language}` : `/${language}${stripped}`;
}

export function getServiceCardsForLanguage(language: LanguageCode) {
  if (language === "de") return serviceCardsDe as ServiceCardConfig[];
  if (language === "nl") return serviceCardsNl as ServiceCardConfig[];
  return serviceCardsEn as ServiceCardConfig[];
}

export function useServiceCards() {
  const { language } = useLanguage();
  return useMemo(() => getServiceCardsForLanguage(language), [language]);
}

export function getPageDescriptionsForLanguage(language: LanguageCode) {
  if (language === "de") return translationsDe.pages;
  if (language === "nl") return translationsNl.pages;
  return translationsEn.pages;
}

export function usePageDescriptions() {
  const { language } = useLanguage();
  return useMemo(() => getPageDescriptionsForLanguage(language), [language]);
}
