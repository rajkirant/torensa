
import React, { useMemo, useState } from "react";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { darkTheme } from "./theme/dark";
import { lightTheme } from "./theme/light";

export function Root() {
    const [themeName, setThemeName] = useState<"light" | "dark">("dark");

    const theme = useMemo(
        () => (themeName === "dark" ? darkTheme : lightTheme),
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
