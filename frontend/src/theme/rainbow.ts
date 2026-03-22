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
    searchBar: {
      background:
        "linear-gradient(160deg, rgba(30,20,60,0.8) 0%, rgba(15,15,40,0.85) 100%)",
      backgroundHover:
        "linear-gradient(160deg, rgba(35,25,70,0.85) 0%, rgba(20,18,50,0.9) 100%)",
      backgroundFocused:
        "linear-gradient(160deg, rgba(40,28,75,0.9) 0%, rgba(22,20,55,0.95) 100%)",
      gradient:
        "linear-gradient(90deg, rgba(255,0,0,0.4), rgba(255,127,0,0.4), rgba(255,255,0,0.35), rgba(0,255,0,0.35), rgba(0,0,255,0.4), rgba(75,0,130,0.4), rgba(143,0,255,0.4))",
      gradientFocused:
        "linear-gradient(90deg, rgba(255,0,0,0.6), rgba(255,127,0,0.6), rgba(255,255,0,0.5), rgba(0,255,0,0.5), rgba(0,0,255,0.6), rgba(75,0,130,0.6), rgba(143,0,255,0.6))",
      focusShadow:
        "0 0 20px rgba(255,0,127,0.15), 0 0 40px rgba(59,130,246,0.1)",
      iconColor: "rgba(255,255,255,0.55)",
      placeholderColor: "rgba(255,255,255,0.4)",
      textColor: "rgba(255,255,255,0.9)",
    },
  },

  header: {
    text: "#ffffff",
    textMuted: "rgba(255,255,255,0.8)",
    border: "rgba(255,255,255,0.2)",
  },

  dropzone: {
    background: "rgba(236,72,153,0.14)",
    active: "rgba(59,130,246,0.2)",
  },

  contactForm: {
    background: "#1a1a2e",
    inputBackground: "#1e1e2e",
    inputBorder: "#444",
    inputText: "#e0e0e0",
    buttonBackground: "linear-gradient(135deg, #ff007f, #7c3aed)",
    buttonBackgroundDisabled: "linear-gradient(135deg, #ff007f88, #7c3aed88)",
    buttonText: "#ffffff",
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

export { default as icon } from "@mui/icons-material/AutoAwesome";

export default rainbow;
