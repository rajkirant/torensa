import React, { useMemo, useState, useEffect, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import App from "./App";
import { AuthProvider } from "./utils/auth";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import { themes } from "./theme";
import type { ThemeName } from "./theme";

import ProtectedRoute from "./utils/ProtectedRoute";

// JSON config
import serviceCards from "./metadata/serviceCards.json";

/* ===================== LAZY PAGES ===================== */
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
  authRequired?: boolean;
};

export function Root() {
  const [themeName, setThemeName] = useState<ThemeName>(() => {
    return (localStorage.getItem("themeName") as ThemeName) || "dark";
  });

  useEffect(() => {
    localStorage.setItem("themeName", themeName);
  }, [themeName]);

  const theme = useMemo(() => themes[themeName], [themeName]);

  const tools = serviceCards as ServiceCardConfig[];

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={null}>
            <Routes>
              {/* Layout route */}
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

                {/* ✅ Auto tool routes */}
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
