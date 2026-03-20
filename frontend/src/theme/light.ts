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
      primary: "#0f172a", // slate-900 (pages)
      secondary: "#475569", // slate-600
    },

    divider: "rgba(15,23,42,0.12)",
  },

  /* 🌑 DARK HEADER & FOOTER (INTENTIONAL CONTRAST) */
  gradients: {
    header: "linear-gradient(90deg, #020617, #0f172a, #020617)",
    footer: "linear-gradient(90deg, #020617, #0f172a, #020617)",
  },

  home: {
    card: {
      background: "#f8fafc",
      border: undefined,
      boxShadow: undefined,
    },
    searchBar: {
      background: "rgba(255,255,255,0.9)",
      backgroundHover: "rgba(245,245,255,0.95)",
      backgroundFocused: "rgba(255,255,255,1)",
      gradient:
        "linear-gradient(135deg, rgba(120,80,220,0.3), rgba(60,120,220,0.25), rgba(120,80,220,0.2))",
      gradientFocused:
        "linear-gradient(135deg, rgba(120,80,220,0.5), rgba(60,120,220,0.4), rgba(120,80,220,0.35))",
      focusShadow: "0 0 0 3px rgba(100,80,220,0.12)",
      iconColor: "rgba(0,0,0,0.4)",
      placeholderColor: "rgba(0,0,0,0.4)",
      textColor: "#0f172a",
    },
  },

  header: {
    text: "#ffffff",
    textMuted: "#6392cb",
    border: "rgba(255,255,255,0.14)",
  },

  dropzone: {
    background: "rgba(37,99,235,0.08)",
    active: "rgba(37,99,235,0.16)",
  },

  typography: {
    fontFamily: `"Inter", system-ui, sans-serif`,
  },

  components: {
    /* ================= BUTTONS ================= */
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          textTransform: "none",
          fontWeight: 600,
        },
      },
    },

    /* ================= CARDS / DRAWERS ================= */
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          borderRadius: 16,
        },
      },
    },

    /* ================= HEADER SELECT FIX (LIGHT ONLY) ================= */
    MuiSelect: {
      styleOverrides: {
        icon: {
          color: "#100c0c", // dropdown arrow
        },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(15,23,42,0.45)",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#2563eb",
            borderWidth: 2,
          },
        },
      },
    },
  },
});

export { default as icon } from "@mui/icons-material/LightMode";

export default light;
