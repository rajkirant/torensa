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

  banners: {
    cronInfo: {
      background:
        "linear-gradient(110deg, rgba(62, 24, 94, 0.9) 0%, rgba(30, 58, 138, 0.85) 38%, rgba(13, 148, 136, 0.82) 70%, rgba(101, 163, 13, 0.8) 100%)",
      border: "rgba(255, 255, 255, 0.35)",
      accent:
        "linear-gradient(180deg, #ff007f 0%, #7c3aed 34%, #06b6d4 67%, #84cc16 100%)",
      icon: "#f0abfc",
      text: "#f8fafc",
      shadow: "0 12px 28px rgba(20, 14, 44, 0.45)",
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
          backgroundColor: "#1e293b",
          backgroundImage:
            "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
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
