import React, { useMemo, useState, useEffect, Suspense } from "react";
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
} from "./utils/routes";
import { useScrollTop } from "./hooks/useScrollTop";

export function Root() {
  const [themeName, setThemeName] = useState<ThemeName>(() => {
    return (localStorage.getItem("themeName") as ThemeName) || "light";
  });

  useEffect(() => {
    localStorage.setItem("themeName", themeName);
  }, [themeName]);

  return (
    <HelmetProvider>
      <LanguageProvider>
        <RootRoutes themeName={themeName} setThemeName={setThemeName} />
      </LanguageProvider>
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
        <BrowserRouter>
          <ScrollToTop />
          <SeoManager />
          <Suspense fallback={null}>
            <Routes>
              <Route
                path="/"
                element={<App themeName={themeName} setThemeName={setThemeName} />}
              >
                <Route index element={<Home />} />
                <Route path="about" element={<Contact />} />
                <Route path="contact" element={<Contact />} />
                <Route path="privacy" element={<PrivacyPolicy />} />
                <Route path="terms" element={<TermsOfService />} />
                <Route path="login" element={<Login />} />
                <Route path="signup" element={<Signup />} />
                <Route path="verify-email" element={<VerifyEmail />} />

                {tools.map((tool) => {
                  const key = tool.id.toLowerCase();
                  const Page = toolComponentMap[key];

                  if (!Page) return null;

                  return (
                    <Route
                      key={tool.id}
                      path={tool.path}
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
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useScrollTop([pathname]);

  return null;
}
