import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useLanguage, withLanguagePrefix } from "../utils/language";

export default function NotFound() {
  const { language } = useLanguage();
  const location = useLocation();
  const shouldForceEnglishPrefix =
    location.pathname === "/en" || location.pathname.startsWith("/en/");
  return (
    <div
      style={{
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: 24,
      }}
    >
      <h1 style={{ fontSize: 56, marginBottom: 8 }}>404</h1>
      <h2 style={{ marginBottom: 12 }}>Page not found</h2>

      <p style={{ opacity: 0.7, maxWidth: 420, marginBottom: 24 }}>
        The page you’re looking for doesn’t exist or may have been moved.
      </p>

      <Link
        to={withLanguagePrefix("/", language, {
          forcePrefix: language === "en" && shouldForceEnglishPrefix,
        })}
        style={{
          padding: "10px 18px",
          borderRadius: 6,
          background: "#1976d2",
          color: "#fff",
          textDecoration: "none",
          fontWeight: 500,
        }}
      >
        Go back home
      </Link>
    </div>
  );
}
