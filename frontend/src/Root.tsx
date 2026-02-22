import React, { useMemo, useState, useEffect, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

import App from "./App";
import { AuthProvider } from "./utils/auth";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import SeoManager from "./components/SeoManager";

import { themes } from "./theme";
import type { ThemeName } from "./theme";

import ProtectedRoute from "./pages/ProtectedRoute";

import serviceCards from "./metadata/serviceCards.json";

import {
  Home,
  Contact,
  Login,
  Signup,
  toolComponentMap,
  NotFound,
} from "./utils/routes";

type ServiceCardConfig = {
  id: string;
  title: string;
  description: string;
  path: string;
  ctaLabel: string;
  offlineEnabled: boolean;
  isActive?: boolean;
  authRequired?: boolean;
};

export function Root() {
  const [themeName, setThemeName] = useState<ThemeName>(() => {
    return (localStorage.getItem("themeName") as ThemeName) || "light";
  });

  useEffect(() => {
    localStorage.setItem("themeName", themeName);
  }, [themeName]);

  const theme = useMemo(() => themes[themeName], [themeName]);

  const tools = (serviceCards as ServiceCardConfig[]).filter(
    (tool) => tool.isActive !== false,
  );

  return (
    <HelmetProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <BrowserRouter>
            <SeoManager />
            <Suspense fallback={null}>
              <Routes>
                <Route
                  path="/"
                  element={
                    <App themeName={themeName} setThemeName={setThemeName} />
                  }
                >
                  <Route index element={<Home />} />
                  <Route path="contact" element={<Contact />} />
                  <Route path="login" element={<Login />} />
                  <Route path="signup" element={<Signup />} />

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
    </HelmetProvider>
  );
}
