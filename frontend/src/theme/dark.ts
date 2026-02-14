import { createTheme } from "@mui/material/styles";

const dark = createTheme({
  shape: {
    borderRadius: 16, // ✅ global rounding
  },

  palette: {
    mode: "dark",
    info: { main: "#020617" },
    primary: { main: "#3b82f6" },
    secondary: { main: "#8b5cf6" },
    background: {
      default: "#0f172a",
      paper: "#1e293b",
    },
    text: {
      primary: "#f8fafc",
      secondary: "#cbd5e1",
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
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16, // ✅ ensures Drawer / Card / Menu rounding
        },
      },
    },

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

export default dark;
