import React from "react";
import { Theme } from "@mui/material/styles";

export const brandLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 22,
  fontWeight: 900,
  color: "#ffffff",
  textDecoration: "none",
  letterSpacing: 0.8,
};

export const navLinkBase: React.CSSProperties = {
  textDecoration: "none",
  fontWeight: 500,
  color: "#e5e7eb",
};

export const navStyle = {
  display: "flex",
  alignItems: "center",
  gap: 20,
};

export const sectionBase: React.CSSProperties = {
  padding: "28px 24px",
  maxWidth: 1100,
  margin: "0 auto",
};

export const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 16,
  padding: 24,
  boxShadow: "0 18px 36px rgba(0,0,0,0.3)",
  cursor: "pointer",
  textAlign: "center",
};

export const userGreetingStyle = (headerTextColor: string) => ({
  marginLeft: 12,
  color: headerTextColor,
  fontWeight: 600,
  fontSize: 14,
});

export const themeSelectSx = (
  theme: Theme,
  isMobile: boolean,
  headerTextColor: string,
) => ({
  minWidth: 120,
  color: headerTextColor,

  "& .MuiOutlinedInput-input": {
    color: headerTextColor,
  },

  "& .MuiSvgIcon-root": {
    color: headerTextColor,
  },

  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: isMobile ? theme.palette.divider : theme.header.border,
  },

  "&:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: headerTextColor,
  },

  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: theme.palette.primary.main,
  },
});

export const drawerNavButtonStyle = (theme: Theme) => ({
  justifyContent: "flex-start",
  color: theme.palette.text.primary,

  "& .MuiSvgIcon-root": {
    color: theme.palette.text.primary,
  },

  "&.active": {
    color: theme.palette.primary.main,
    fontWeight: 600,
  },
});

export const headerStyle = (theme: Theme): React.CSSProperties => ({
  background: theme.gradients.header,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 16px",
  boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
  color: theme.header.text,
  flexWrap: "wrap",
  gap: 12,
  overflow: "visible",
});

export const footerStyle = (theme: Theme): React.CSSProperties => ({
  width: "100%",           // ✅ stretch across screen
  marginTop: 60,
  padding: "70px 0",       // ✅ taller footer
  background: theme.gradients.footer,
  borderTop: `1px solid ${theme.header.border}`,
  color: theme.header.text,
});


export const footerInner: React.CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto",
  padding: "0 20px",
  textAlign: "center",
};
