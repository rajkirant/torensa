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

const STATIC_ROUTES = [
  { path: "", element: <Home /> },
  { path: "about", element: <Contact /> },
  { path: "privacy", element: <PrivacyPolicy /> },
  { path: "terms", element: <TermsOfService /> },
  { path: "login", element: <Login /> },
  { path: "signup", element: <Signup /> },
  { path: "verify-email", element: <VerifyEmail /> },
  { path: "chatbot-plans", element: <ChatbotPlans /> },
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
                {STATIC_ROUTES.map((route) => (
                  <Route
                    key={route.path}
                    path={route.path}
                    element={route.element}
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
