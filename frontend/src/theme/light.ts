import { createTheme } from "@mui/material/styles";

const light = createTheme({
  palette: {
    mode: "light",

    info: { main: "#e0e7ff" },
    primary: { main: "#2563eb" },
    secondary: { main: "#7c3aed" },

    /* 🌤️ LIGHT BACKGROUND (NOT PURE WHITE) */
    background: {
      default: "#f1f5f9", // slate-100 (page background)
      paper: "#f8fafc", // slate-50 (cards / drawer)
    },

    text: {
      primary: "#0f172a", // slate-900
      secondary: "#475569", // slate-600
    },

    divider: "rgba(15,23,42,0.12)",
  },

  /* 🌑 DARK HEADER & FOOTER (INTENTIONAL CONTRAST) */
  gradients: {
    header: "linear-gradient(90deg, #020617, #0f172a, #020617)",
    footer: "linear-gradient(90deg, #020617, #0f172a, #020617)",
  },

  header: {
    text: "#ffffff",
    textMuted: "#cbd5e1",
    border: "rgba(255,255,255,0.14)",
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

    /* OPTIONAL: nicer Select & Drawer contrast */
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
  },
});

export default light;
