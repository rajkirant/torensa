import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getLanguageFromPath, withLanguagePrefix } from "../utils/language";
import type { LanguageCode } from "../utils/language";

const STORAGE_KEY = "geo_redirect_done";

const COUNTRY_TO_LANGUAGE: Record<string, LanguageCode> = {
  DE: "de",
  AT: "de", // Austria also speaks German
  CH: "de", // Switzerland (German-speaking)
  NL: "nl",
  BE: "nl", // Belgium (Dutch-speaking)
};

async function fetchCountryCode(): Promise<string | null> {
  try {
    const res = await fetch("https://ipapi.co/json/", {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { country_code?: string };
    return data.country_code ?? null;
  } catch {
    return null;
  }
}

/**
 * Detects the user's country via IP geolocation and redirects to the
 * appropriate language prefix (/nl, /de) if they are visiting for the
 * first time without an explicit language in the URL.
 *
 * Only runs once per browser session (stored in sessionStorage).
 */
export function useGeoRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Skip if we already redirected this session
    if (sessionStorage.getItem(STORAGE_KEY)) return;

    // Skip if the URL already has an explicit language prefix
    if (getLanguageFromPath(location.pathname) !== null) {
      sessionStorage.setItem(STORAGE_KEY, "1");
      return;
    }

    let cancelled = false;

    fetchCountryCode().then((countryCode) => {
      if (cancelled) return;
      sessionStorage.setItem(STORAGE_KEY, "1");

      if (!countryCode) return;

      const targetLang = COUNTRY_TO_LANGUAGE[countryCode.toUpperCase()];
      if (!targetLang) return;

      const targetPath = withLanguagePrefix(location.pathname, targetLang);
      navigate(targetPath, { replace: true });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
