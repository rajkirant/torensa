import { useState } from "react";

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";

export default function BulkEmail() {
  // ---------------- SMTP Settings ----------------
  const [smtpEmail, setSmtpEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpSavedMsg, setSmtpSavedMsg] = useState("");

  // ---------------- Bulk Email ----------------
  const [emails, setEmails] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSaveSmtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSmtpSavedMsg("");

    if (!smtpEmail || !appPassword) {
      setError("SMTP email and app password are required");
      return;
    }

    setSmtpSaving(true);

    try {
      const res = await fetch("/api/smtp/save/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          smtp_email: smtpEmail,
          app_password: appPassword,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error || "Failed to save SMTP settings");
        return;
      }

      // optional: clear app password field after save
      setAppPassword("");
      setSmtpSavedMsg("SMTP settings saved successfully");
    } catch {
      setError("Something went wrong while saving SMTP settings.");
    } finally {
      setSmtpSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const emailList = emails
      .split(/[\n,]+/)
      .map((e) => e.trim())
      .filter(Boolean);

    if (emailList.length === 0 || !subject || !body) {
      setError("Emails, subject, and message are required");
      return;
    }

    const formData = new FormData();
    formData.append("to", JSON.stringify(emailList));
    formData.append("subject", subject);
    formData.append("body", body);

    if (files) {
      Array.from(files).forEach((file) => {
        formData.append("attachments", file);
      });
    }

    setLoading(true);

    try {
      const res = await fetch("/api/send-email/", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error || "Failed to send emails");
        return;
      }

      setSuccess(
        `Email sent to ${emailList.length} recipients${
          files?.length ? ` with ${files.length} attachment(s)` : ""
        }`
      );

      setEmails("");
      setSubject("");
      setBody("");
      setFiles(null);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: "80px auto" }}>
      <h2>Bulk Email</h2>

      {/* ================= SMTP SETTINGS ================= */}
      <div
        style={{
          padding: 16,
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 12,
          marginBottom: 24,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Your Gmail SMTP Settings</h3>

        <form onSubmit={handleSaveSmtp}>
          <div style={{ marginBottom: 12 }}>
            <label>Gmail address</label>
            <input
              type="email"
              value={smtpEmail}
              onChange={(e) => setSmtpEmail(e.target.value)}
              placeholder="yourname@gmail.com"
              required
              style={{ width: "100%", padding: 8 }}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label>Gmail App Password</label>
            <input
              type="password"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              placeholder="16-character app password"
              required
              style={{ width: "100%", padding: 8 }}
            />
            <small style={{ color: "#6b7280", display: "block", marginTop: 6 }}>
              Create one here:{" "}
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google App Passwords
              </a>
            </small>
          </div>

          {smtpSavedMsg && (
            <p style={{ color: "#059669", marginTop: 10 }}>{smtpSavedMsg}</p>
          )}

          <Button
            type="submit"
            fullWidth
            size="large"
            disabled={smtpSaving}
            sx={{
              mt: 1,
              py: 1.2,
              fontSize: "1.02rem",
              fontWeight: 700,
              borderRadius: 3,
              textTransform: "none",
              color: "#ffffff",
              background: "linear-gradient(135deg, #059669, #2563eb)",
              "&:hover": {
                background: "linear-gradient(135deg, #047857, #1e40af)",
              },
              "&.Mui-disabled": {
                color: "#ffffff",
                opacity: 0.8,
              },
            }}
          >
            {smtpSaving ? (
              <>
                <CircularProgress size={22} sx={{ color: "#ffffff", mr: 1 }} />
                Saving…
              </>
            ) : (
              "Save SMTP Settings"
            )}
          </Button>
        </form>
      </div>

      {/* ================= BULK SEND ================= */}
      <h3 style={{ marginTop: 0 }}>Send Email</h3>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label>Recipients</label>
          <textarea
            placeholder="email1@example.com, email2@example.com"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            rows={4}
            required
            style={{ width: "100%", padding: 8 }}
          />
          <small style={{ color: "#6b7280" }}>
            Separate emails using commas or new lines
          </small>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            style={{ width: "100%", padding: 8 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            required
            style={{ width: "100%", padding: 8 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>Attachments</label>
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(e.target.files)}
          />
          <small style={{ color: "#6b7280", display: "block", marginTop: 4 }}>
            You can attach multiple files
          </small>
        </div>

        {error && <p style={{ color: "#dc2626", marginBottom: 16 }}>{error}</p>}
        {success && (
          <p style={{ color: "#059669", marginBottom: 16 }}>{success}</p>
        )}

        <Button
          type="submit"
          fullWidth
          size="large"
          disabled={loading}
          sx={{
            mt: 1,
            py: 1.5,
            fontSize: "1.05rem",
            fontWeight: 700,
            letterSpacing: "0.03em",
            borderRadius: 3,
            textTransform: "none",
            color: "#ffffff",
            background: "linear-gradient(135deg, #059669, #2563eb)",
            boxShadow: "0 10px 25px rgba(37, 99, 235, 0.35)",
            "&:hover": {
              background: "linear-gradient(135deg, #047857, #1e40af)",
            },
            "&.Mui-disabled": {
              color: "#ffffff",
              opacity: 0.8,
            },
          }}
        >
          {loading ? (
            <>
              <CircularProgress size={22} sx={{ color: "#ffffff", mr: 1 }} />
              Sending…
            </>
          ) : (
            "Send Email"
          )}
        </Button>
      </form>
    </div>
  );
}
