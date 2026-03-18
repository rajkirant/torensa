import { createTheme } from "@mui/material/styles";

const dark = createTheme({
  shape: {
    borderRadius: 8, // ✅ global rounding
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

  home: {
    card: {
      background:
        "linear-gradient(160deg, rgba(30,41,59,0.9) 0%, rgba(15,23,42,0.95) 100%)",
      border: "1px solid rgba(148,163,184,0.24)",
      boxShadow:
        "0 18px 36px rgba(2,6,23,0.45), inset 0 1px 0 rgba(255,255,255,0.04)",
    },
    searchBar: {
      background: "rgba(15, 15, 35, 0.7)",
      backgroundHover: "rgba(15, 15, 35, 0.85)",
      backgroundFocused: "rgba(15, 15, 35, 0.9)",
      gradient:
        "linear-gradient(135deg, rgba(120,80,220,0.5), rgba(60,120,220,0.4), rgba(120,80,220,0.3))",
      gradientFocused:
        "linear-gradient(135deg, rgba(140,90,255,0.7), rgba(70,140,255,0.6), rgba(140,90,255,0.5))",
      focusShadow: "none",
      iconColor: "rgba(255,255,255,0.5)",
      placeholderColor: "rgba(255,255,255,0.4)",
      textColor: "rgba(255,255,255,0.85)",
    },
  },

  header: {
    text: "#ffffff",
    textMuted: "#e5e7eb",
    border: "rgba(255,255,255,0.12)",
  },

  dropzone: {
    background: "rgba(59,130,246,0.12)",
    active: "rgba(59,130,246,0.22)",
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

export { default as icon } from "@mui/icons-material/DarkMode";

export default dark;
