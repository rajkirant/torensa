import { useState, type FormEvent } from "react";
import { useTheme } from "@mui/material/styles";
import missionData from "../metadata/mission.json";
import contactData from "../metadata/contact.json";

type MissionData = {
  subtitle: string;
  mission: string;
};

type ContactData = {
  email: {
    address: string;
    intro: string;
  };
  openSource: string;
  responseTime: string;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export default function Contact() {
  const theme = useTheme();
  const cf = theme.contactForm;
  const mission = missionData as MissionData;
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
      setError("Network error. Please check your connection and try again.");
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

        <h1>About Us</h1>

        <p className="subtitle">{mission.subtitle}</p>

        <p style={{ maxWidth: 700, margin: "0 auto", marginTop: 15 }}>
          <strong>Mission:</strong> {mission.mission}
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
          Send a Message
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
            <p>Message received! We'll get back to you soon.</p>
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
              Send another
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
                Name
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
                Email
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
                Message
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
              {submitting ? "Sending…" : "Send Message"}
            </button>
          </form>
        )}
      </section>

      <div className="cards">
        {/* EMAIL CARD */}
        <div className="card">
          <h3>Contact Us</h3>
          <p>{contact.email.intro}</p>

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
          <h3>Open Source</h3>
          <p>{contact.openSource}</p>
        </div>
        <div className="card">
          <h3>Response Time</h3>
          <p>{contact.responseTime}</p>
        </div>
      </div>
    </>
  );
}
