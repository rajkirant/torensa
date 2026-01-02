import { createTheme } from "@mui/material/styles";

export const appTheme = createTheme({
  palette: {
    mode: "light",

    /* BRAND */
    info: { main: "#1e3a8a" }, // deep blue
    primary: { main: "#4f46e5" }, // indigo
    secondary: { main: "#7c3aed" }, // purple

    /* PAGE */
    background: {
      default: "#f8fafc", // page background (very light)
      paper: "#ffffff", // cards / surfaces
    },

    /* TEXT */
    text: {
      primary: "#0f172a", // slate-900
      secondary: "#334155", // slate-700
    },

    /* DIVIDERS */
    divider: "rgba(15,23,42,0.08)",
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
