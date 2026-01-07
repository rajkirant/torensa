import React from "react";

export const headerGradient =
  "linear-gradient(90deg, #020617, #0b3aa4, #3b0ca3)";

export const brandLinkStyle: React.CSSProperties = {
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

export const sectionBase: React.CSSProperties = {
  padding: "64px 24px",
  maxWidth: 1100,
  margin: "0 auto",
};

export const headerStyle: React.CSSProperties = {
  background: headerGradient,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "16px 40px",
  boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
};

export const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 16,
  padding: 24,
  boxShadow: "0 18px 36px rgba(0,0,0,0.3)",
};

export const footerStyle: React.CSSProperties = {
  marginTop: 80,
  padding: "48px 24px",
  background: headerGradient,
  borderTop: "1px solid rgba(255,255,255,0.12)",
};

export const footerCard: React.CSSProperties = {
  maxWidth: 900,
  margin: "0 auto",
  textAlign: "center",
};
