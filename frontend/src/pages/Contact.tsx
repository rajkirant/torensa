import { useState, type FormEvent } from "react";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import contactData from "../metadata/contact.json";

type ContactData = {
  email: {
    address: string;
  };
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export default function Contact() {
  const theme = useTheme();
  const cf = theme.contactForm;
  const { t } = useTranslation();
  const contact = contactData as ContactData;
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await fetch(`${API_BASE}/api/hello/`, {
        credentials: "include",
      });
      const csrfToken =
        document.cookie
          .split("; ")
          .find((row) => row.startsWith("csrftoken="))
          ?.split("=")[1] ?? "";

      const res = await fetch(`${API_BASE}/api/contact-message/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setSubmitted(true);
      const subject = encodeURIComponent(`Contact from ${formData.name}`);
      const body = encodeURIComponent(
        `Name: ${formData.name}\nEmail: ${formData.email}\n\n${formData.message}`,
      );
      const a = document.createElement("a");
      a.href = `mailto:${contact.email.address}?subject=${subject}&body=${body}`;
      a.click();
      setFormData({ name: "", email: "", message: "" });
    } catch {
      setError(t("about.networkError"));
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 6,
    border: `1px solid ${cf.inputBorder}`,
    background: cf.inputBackground,
    color: cf.inputText,
    fontSize: 14,
    boxSizing: "border-box",
  };

  return (
    <>
      <header style={{ marginBottom: 40 }}>
        {/* PROFILE IMAGE */}
        <div style={{ textAlign: "center", marginTop: -18, marginBottom: 2 }}>
          <img
            src="/me.webp"
            alt="Raj Kiran"
            style={{
              width: 120,
              height: 120,
              borderRadius: "50%",
              objectFit: "cover",
              border: "2px solid #ddd",
            }}
          />
        </div>

        <h1>{t("about.title")}</h1>

        <p className="subtitle">{t("about.subtitle")}</p>

        <p style={{ maxWidth: 700, margin: "0 auto", marginTop: 15 }}>
          <strong>{t("about.missionLabel")}</strong> {t("about.mission")}
        </p>
      </header>

      {/* CONTACT FORM */}
      <section
        style={{
          maxWidth: 600,
          margin: "40px auto 50px",
          padding: "30px",
          background: cf.background,
          borderRadius: 12,
        }}
      >
        <h2 style={{ marginBottom: 20, textAlign: "center" }}>
          {t("about.sendMessage")}
        </h2>

        {submitted ? (
          <div
            style={{
              textAlign: "center",
              padding: "30px 0",
              color: "#4fd1c5",
              fontSize: 16,
            }}
          >
            <p style={{ fontSize: 32, marginBottom: 12 }}>✓</p>
            <p>{t("about.messageReceived")}</p>
            <button
              onClick={() => setSubmitted(false)}
              style={{
                marginTop: 20,
                padding: "8px 20px",
                borderRadius: 6,
                border: "1px solid #4fd1c5",
                background: "transparent",
                color: "#4fd1c5",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              {t("about.sendAnother")}
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            {error && (
              <p style={{ color: "#fc8181", fontSize: 14, margin: 0 }}>
                {error}
              </p>
            )}
            <div>
              <label
                htmlFor="contact-name"
                style={{ display: "block", marginBottom: 4, fontSize: 14 }}
              >
                {t("about.nameLabel")}
              </label>
              <input
                id="contact-name"
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, name: e.target.value }))
                }
                style={inputStyle}
              />
            </div>
            <div>
              <label
                htmlFor="contact-email"
                style={{ display: "block", marginBottom: 4, fontSize: 14 }}
              >
                {t("about.emailLabel")}
              </label>
              <input
                id="contact-email"
                type="email"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, email: e.target.value }))
                }
                style={inputStyle}
              />
            </div>
            <div>
              <label
                htmlFor="contact-message"
                style={{ display: "block", marginBottom: 4, fontSize: 14 }}
              >
                {t("about.messageLabel")}
              </label>
              <textarea
                id="contact-message"
                required
                rows={5}
                value={formData.message}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, message: e.target.value }))
                }
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "12px",
                borderRadius: 6,
                border: "none",
                background: submitting ? cf.buttonBackgroundDisabled : cf.buttonBackground,
                color: cf.buttonText,
                fontWeight: 700,
                fontSize: 15,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? t("about.sending") : t("about.sendButton")}
            </button>
          </form>
        )}
      </section>

      <div className="cards">
        {/* EMAIL CARD */}
        <div className="card">
          <h3>{t("about.contactUs")}</h3>
          <p>{t("about.emailIntro")}</p>

          <p>
            <a
              href={`mailto:${contact.email.address}`}
              style={{
                fontWeight: 600,
                color: "#4fd1c5",
                textDecoration: "underline",
              }}
            >
              {contact.email.address}
            </a>
          </p>
        </div>

        <div className="card">
          <h3>{t("about.openSource")}</h3>
          <p>{t("about.openSourceDesc")}</p>
        </div>
        <div className="card">
          <h3>{t("about.responseTime")}</h3>
          <p>{t("about.responseTimeDesc")}</p>
        </div>
      </div>
    </>
  );
}
