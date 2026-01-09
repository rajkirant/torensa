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

  // ✅ Light header/footer background
  gradients: {
    header: "linear-gradient(90deg, #ffffff, #eef2ff, #e0e7ff)",
    footer: "linear-gradient(90deg, #ffffff, #eef2ff, #e0e7ff)",
  },

  // ✅ Accessible text colors for light header/footer
  header: {
    text: "#0f172a", // dark text
    textMuted: "#334155",
    border: "rgba(15,23,42,0.14)",
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
