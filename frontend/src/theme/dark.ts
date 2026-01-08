import { createTheme } from "@mui/material/styles";

export const darkTheme = createTheme({
  palette: {
    mode: "dark",

    /* BRAND / HEADER */
    info: { main: "#020617" }, // deep navy
    primary: { main: "#3b82f6" }, // blue-500 (slightly brighter)
    secondary: { main: "#8b5cf6" }, // violet-500

    /* PAGE */
    background: {
      default: "#0f172a", // slate-900 (lighter than before)
      paper: "#1e293b", // slate-800 (cards & sections)
    },

    /* TEXT */
    text: {
      primary: "#f8fafc", // slate-50
      secondary: "#cbd5e1", // slate-300
    },

    divider: "rgba(255,255,255,0.08)",
  },

  gradients: {
    header: "linear-gradient(90deg, #020617, #0b3aa4, #3b0ca3)",
    footer: "linear-gradient(90deg, #020617, #0b3aa4, #3b0ca3)",
  },

  header: {
    text: "#ffffff",
    textMuted: "#e5e7eb",
    border: "rgba(255,255,255,0.12)",
  },

  typography: {
    fontFamily: `"Inter", system-ui, sans-serif`,
  },

  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          textTransform: "none",
          fontWeight: 600,
        },
      },
    },
  },
});
