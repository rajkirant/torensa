import React, { useMemo, useState, useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import { themes } from "./theme";
import type { ThemeName } from "./theme";

export function Root() {
  const [themeName, setThemeName] = useState<ThemeName>(() => {
    const saved = localStorage.getItem("themeName");
    return (saved as ThemeName) || "dark";
  });

  useEffect(() => {
    localStorage.setItem("themeName", themeName as string);
  }, [themeName]);

  const theme = useMemo(() => themes[themeName], [themeName]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <App themeName={themeName} setThemeName={setThemeName} />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
