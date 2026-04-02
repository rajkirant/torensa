import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
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
  const [language, setLanguage] = useState<LanguageCode>(() => {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return stored === "de" ? "de" : DEFAULT_LANGUAGE;
  });

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

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

export function getServiceCardsForLanguage(language: LanguageCode) {
  return (language === "de" ? serviceCardsDe : serviceCardsEn) as ServiceCardConfig[];
}

export function useServiceCards() {
  const { language } = useLanguage();
  return useMemo(() => getServiceCardsForLanguage(language), [language]);
}
