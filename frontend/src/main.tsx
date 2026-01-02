import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";

import App from "./App";
import { AuthProvider } from "./auth";
import "./styles.css";

import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import { appTheme } from "./theme/theme";
import { darkTheme } from "./theme/darkTheme";

/* ================= ROOT ================= */

function Root() {
  const [themeName, setThemeName] = useState<"default" | "dark">("dark");

  const theme = useMemo(
    () => (themeName === "dark" ? darkTheme : appTheme),
    [themeName]
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <HashRouter>
          <App themeName={themeName} setThemeName={setThemeName} />
        </HashRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
