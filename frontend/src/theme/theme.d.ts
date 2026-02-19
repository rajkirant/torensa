import "@mui/material/styles";

declare module "@mui/material/styles" {
  interface Theme {
    gradients: {
      header: string;
      footer: string;
    };
    home: {
      card: {
        background?: string;
        border?: string;
        boxShadow?: string;
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
    home?: {
      card?: {
        background?: string;
        border?: string;
        boxShadow?: string;
      };
    };
    header?: {
      text?: string;
      textMuted?: string;
      border?: string;
    };
  }
}
