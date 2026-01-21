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

  header: {
    text: "#ffffff",
    textMuted: "#6392cb",
    border: "rgba(255,255,255,0.14)",
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
        select: {
          color: "#000000", // selected value text
        },
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

export default light;
