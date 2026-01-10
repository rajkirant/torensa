import { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Alert,
  Typography,
  TextField,
} from "@mui/material";
import { apiFetch } from "../../utils/api";

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
      const res = await apiFetch("/api/smtp/save/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        Use a Gmail <strong>App Password</strong> (not your real password).{" "}
        <a
          href="https://myaccount.google.com/apppasswords"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "inherit", textDecoration: "underline" }}
        >
          Create App Password
        </a>
      </Typography>

      <TextField
        label="Gmail address"
        type="email"
        value={smtpEmail}
        onChange={(e) => setSmtpEmail(e.target.value)}
        autoComplete="email"
        fullWidth
        margin="normal"
      />

      <TextField
        label="Gmail App Password"
        type="password"
        value={appPassword}
        onChange={(e) => setAppPassword(e.target.value)}
        autoComplete="current-password"
        fullWidth
        margin="normal"
      />

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mt: 2 }}>
          {success}
        </Alert>
      )}

      <Button
        type="submit"
        variant="contained"
        fullWidth
        disabled={saving}
        sx={{
          mt: 3,
          py: 1.4,
          fontWeight: 700,
          textTransform: "none",
          borderRadius: 2,
        }}
      >
        {saving ? (
          <>
            <CircularProgress size={20} sx={{ color: "inherit", mr: 1 }} />
            Saving…
          </>
        ) : (
          "Save SMTP Settings"
        )}
      </Button>
    </Box>
  );
}
