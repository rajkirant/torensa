import { useMemo, useState, useEffect, Suspense } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

import App from "./App";
import { AuthProvider } from "./utils/auth";
import { LanguageProvider, useServiceCards } from "./utils/language";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import SeoManager from "./components/SeoManager";

import { themes } from "./theme";
import type { ThemeName } from "./theme";

import ProtectedRoute from "./pages/ProtectedRoute";

import {
  type ServiceCardConfig,
  getActiveServiceCards,
} from "./utils/serviceCards";

import {
  Home,
  Contact,
  Login,
  Signup,
  VerifyEmail,
  PrivacyPolicy,
  TermsOfService,
  toolComponentMap,
  NotFound,
  ChatbotPlans,
  ChatbotWindow,
} from "./utils/routes";
import { useScrollTop } from "./hooks/useScrollTop";
import { useGeoRedirect } from "./hooks/useGeoRedirect";

const STATIC_ROUTE_PATHS = [
  { path: "", component: Home },
  { path: "about", component: Contact },
  { path: "privacy", component: PrivacyPolicy },
  { path: "terms", component: TermsOfService },
  { path: "login", component: Login },
  { path: "signup", component: Signup },
  { path: "verify-email", component: VerifyEmail },
  { path: "chatbot-plans", component: ChatbotPlans },
];

const LANGUAGE_PREFIXES = ["", "/en", "/de", "/nl"];

export function Root() {
  const [themeName, setThemeName] = useState<ThemeName>(() => {
    return (localStorage.getItem("themeName") as ThemeName) || "light";
  });

  useEffect(() => {
    localStorage.setItem("themeName", themeName);
  }, [themeName]);

  return (
    <HelmetProvider>
      <BrowserRouter>
        <LanguageProvider>
          <RootRoutes themeName={themeName} setThemeName={setThemeName} />
        </LanguageProvider>
      </BrowserRouter>
    </HelmetProvider>
  );
}

function RootRoutes({
  themeName,
  setThemeName,
}: {
  themeName: ThemeName;
  setThemeName: (name: ThemeName) => void;
}) {
  const theme = useMemo(() => themes[themeName], [themeName]);
  const serviceCards = useServiceCards();
  const tools = getActiveServiceCards(serviceCards as ServiceCardConfig[]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <ScrollToTop />
        <SeoManager />
        <Suspense fallback={null}>
          <Routes>
            {/* Standalone chatbot window — no App shell, must be before language-prefix routes */}
            <Route path="/chatbot/:id" element={<ChatbotWindow />} />

            {LANGUAGE_PREFIXES.map((prefix) => (
              <Route
                key={prefix || "default"}
                path={prefix || "/"}
                element={
                  <App themeName={themeName} setThemeName={setThemeName} />
                }
              >
                {STATIC_ROUTE_PATHS.map(({ path, component: Component }) => (
                  <Route
                    key={path}
                    path={path}
                    element={<Component />}
                  />
                ))}

                {tools.map((tool) => {
                  const key = tool.id.toLowerCase();
                  const Page = toolComponentMap[key];

                  if (!Page) return null;

                  const routePath = tool.path.replace(/^\//, "");

                  return (
                    <Route
                      key={`${prefix}-${tool.id}`}
                      path={routePath}
                      element={
                        tool.authRequired ? (
                          <ProtectedRoute>
                            <Page />
                          </ProtectedRoute>
                        ) : (
                          <Page />
                        )
                      }
                    />
                  );
                })}
              </Route>
            ))}

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </ThemeProvider>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useScrollTop([pathname]);
  useGeoRedirect();

  return null;
}
