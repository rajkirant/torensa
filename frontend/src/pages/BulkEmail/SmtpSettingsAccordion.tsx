import { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Alert,
  Typography,
} from "@mui/material";

type Props = {
  onSaved: () => void;
};

export default function SmtpSettingsAccordion({ onSaved }: Props) {
  const [smtpEmail, setSmtpEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(smtpEmail)) {
      setError("Please enter a valid Gmail address");
      return;
    }

    if (appPassword.replace(/\s/g, "").length !== 16) {
      setError("Gmail App Password must be exactly 16 characters");
      return;
    }

    setSaving(true);

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

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Failed to save SMTP credentials");
        return;
      }

      setAppPassword("");
      setSuccess("SMTP credentials saved securely");
      onSaved();
    } catch {
      setError("Unable to save SMTP credentials");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box component="form" onSubmit={handleSave}>
      <Typography variant="body2" sx={{ color: "#9ca3af", mb: 2 }}>
        Use a Gmail <strong>App Password</strong> (not your real password).{" "}
        <a
          href="https://myaccount.google.com/apppasswords"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#60a5fa" }}
        >
          Create App Password
        </a>
      </Typography>

      <input
        type="email"
        placeholder="yourname@gmail.com"
        value={smtpEmail}
        onChange={(e) => setSmtpEmail(e.target.value)}
        required
        style={{
          width: "100%",
          padding: 10,
          marginBottom: 12,
          borderRadius: 8,
        }}
      />

      <input
        type="password"
        placeholder="16-character Gmail app password"
        value={appPassword}
        onChange={(e) => setAppPassword(e.target.value)}
        required
        style={{
          width: "100%",
          padding: 10,
          marginBottom: 12,
          borderRadius: 8,
        }}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Button type="submit" fullWidth disabled={saving}>
        {saving ? <CircularProgress size={22} /> : "Save SMTP Settings"}
      </Button>
    </Box>
  );
}
