import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage, withLanguagePrefix } from "../utils/language";

export default function NotFound() {
  const { t } = useTranslation();
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
      <h2 style={{ marginBottom: 12 }}>{t("notFound.title")}</h2>

      <p style={{ opacity: 0.7, maxWidth: 420, marginBottom: 24 }}>
        {t("notFound.body")}
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
        {t("notFound.backHome")}
      </Link>
    </div>
  );
}
