import "@mui/material/styles";

declare module "@mui/material/styles" {
  interface Theme {
    gradients: {
      header: string;
      footer: string;
    };
    banners: {
      cronInfo: {
        background: string;
        border: string;
        accent: string;
        icon: string;
        text: string;
        shadow: string;
      };
    };
    header: {
      text: string;
      textMuted: string;
      border: string;
    };
  }

  interface ThemeOptions {
    gradients?: {
      header?: string;
      footer?: string;
    };
    banners?: {
      cronInfo?: {
        background?: string;
        border?: string;
        accent?: string;
        icon?: string;
        text?: string;
        shadow?: string;
      };
    };
    header?: {
      text?: string;
      textMuted?: string;
      border?: string;
    };
  }
}
