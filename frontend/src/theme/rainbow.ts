import { createTheme } from "@mui/material/styles";

const rainbow = createTheme({
  palette: {
    mode: "dark",

    primary: { main: "#ff007f" },
    secondary: { main: "#7c3aed" },
    info: { main: "#00b4d8" },

    /* 🌈 LIGHTER PASTEL MULTICOLOUR BACKGROUND */
    background: {
      default:
        "linear-gradient(135deg, #312e81, #4338ca, #0f766e, #047857, #65a30d)",
      paper: "#1e293b",
    },

    text: {
      primary: "#f8fafc",
      secondary: "#cbd5e1",
    },

    divider: "rgba(255,255,255,0.08)",
  },

  gradients: {
    header:
      "linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #8f00ff)",
    footer:
      "linear-gradient(90deg, #8f00ff, #4b0082, #0000ff, #00ff00, #ffff00, #ff7f00, #ff0000)",
  },

  home: {
    card: {
      background:
        "linear-gradient(140deg, rgba(239,68,68,0.26) 0%, rgba(245,158,11,0.24) 18%, rgba(234,179,8,0.22) 33%, rgba(34,197,94,0.22) 50%, rgba(6,182,212,0.24) 67%, rgba(59,130,246,0.24) 82%, rgba(168,85,247,0.26) 100%), linear-gradient(160deg, rgba(30,41,59,0.88) 0%, rgba(15,23,42,0.9) 100%)",
      border: "1px solid rgba(255,255,255,0.34)",
      boxShadow:
        "0 18px 36px rgba(2,6,23,0.45), 0 0 0 1px rgba(244,114,182,0.22), 0 0 24px rgba(59,130,246,0.18), inset 0 1px 0 rgba(255,255,255,0.12)",
    },
  },

  header: {
    text: "#ffffff",
    textMuted: "rgba(255,255,255,0.8)",
    border: "rgba(255,255,255,0.2)",
  },

  typography: {
    fontFamily: `"Inter", system-ui, sans-serif`,
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background:
            "linear-gradient(135deg, #312e81, #4338ca, #0f766e, #047857, #65a30d)",
          backgroundAttachment: "fixed",
          backgroundSize: "300% 300%",
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: "#1a2440",
          backgroundImage:
            "linear-gradient(150deg, rgba(244,114,182,0.12) 0%, rgba(59,130,246,0.12) 45%, rgba(16,185,129,0.1) 100%)",
          borderRadius: 16,
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
        containedPrimary: {
          background: "linear-gradient(135deg, #ff007f, #7c3aed)",
          color: "#fff",
        },
      },
    },
  },
});

export default rainbow;
