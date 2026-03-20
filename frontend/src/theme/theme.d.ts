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
      searchBar: {
        background: string;
        backgroundHover: string;
        backgroundFocused: string;
        gradient: string;
        gradientFocused: string;
        focusShadow: string;
        iconColor: string;
        placeholderColor: string;
        textColor: string;
      };
    };
    header: {
      text: string;
      textMuted: string;
      border: string;
    };
    dropzone: {
      background: string;
      active: string;
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
      searchBar?: {
        background?: string;
        backgroundHover?: string;
        backgroundFocused?: string;
        gradient?: string;
        gradientFocused?: string;
        focusShadow?: string;
        iconColor?: string;
        placeholderColor?: string;
        textColor?: string;
      };
    };
    header?: {
      text?: string;
      textMuted?: string;
      border?: string;
    };
    dropzone?: {
      background?: string;
      active?: string;
    };
  }
}
