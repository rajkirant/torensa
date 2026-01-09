import { createTheme } from "@mui/material/styles";

const light = createTheme({
  palette: {
    mode: "light",

    info: { main: "#e0e7ff" },
    primary: { main: "#2563eb" },
    secondary: { main: "#7c3aed" },

    background: {
      default: "#f8fafc",
      paper: "#ffffff",
    },

    text: {
      primary: "#0f172a",
      secondary: "#475569",
    },

    divider: "rgba(15,23,42,0.12)",
  },

  /* 🌑 DARK GRADIENT HEADER & FOOTER */
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
  },
});

export default light;
