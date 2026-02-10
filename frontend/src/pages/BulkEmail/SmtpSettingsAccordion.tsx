import { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Typography,
  TextField,
  Divider,
} from "@mui/material";
import { apiFetch } from "../../utils/api";
import ToolStatusAlerts from "../../components/alerts/ToolStatusAlerts";

type Props = {
  onSaved: () => void;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SmtpSettingsAccordion({ onSaved }: Props) {
  const [smtpEmail, setSmtpEmail] = useState("");
  const [oauthLoading, setOauthLoading] = useState(false);

  const [appPassword, setAppPassword] = useState("");
  const [savingLegacy, setSavingLegacy] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleConnectGmail(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!emailRegex.test(smtpEmail)) {
      setError("Please enter a valid Gmail address");
      return;
    }

    setOauthLoading(true);

    try {
      const query = new URLSearchParams({ smtp_email: smtpEmail.trim() });
      const res = await apiFetch(`/api/auth/google/start/?${query.toString()}`, {
        method: "GET",
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok || !data?.auth_url) {
        setError(data?.error || "Failed to start Gmail connection");
        return;
      }

      window.location.assign(data.auth_url);
    } catch {
      setError("Unable to connect Gmail right now");
    } finally {
      setOauthLoading(false);
    }
  }

  async function handleSaveLegacy() {
    setError("");
    setSuccess("");

    if (!emailRegex.test(smtpEmail)) {
      setError("Please enter a valid Gmail address");
      return;
    }

    if (appPassword.replace(/\s/g, "").length !== 16) {
      setError("Gmail App Password must be exactly 16 characters");
      return;
    }

    setSavingLegacy(true);

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
      setSavingLegacy(false);
    }
  }

  return (
    <Box component="form" onSubmit={handleConnectGmail}>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        Connect Gmail with OAuth to send safely without storing app passwords.
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

      <ToolStatusAlerts error={error} success={success} sx={{ mt: 2 }} />

      <Button
        type="submit"
        variant="contained"
        fullWidth
        disabled={oauthLoading}
        sx={{
          mt: 2,
          py: 1.4,
          fontWeight: 700,
          textTransform: "none",
          borderRadius: 2,
        }}
      >
        {oauthLoading ? (
          <>
            <CircularProgress size={20} sx={{ color: "inherit", mr: 1 }} />
            Redirecting...
          </>
        ) : (
          "Connect Gmail"
        )}
      </Button>

      <Divider sx={{ my: 3 }} />

      <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
        Legacy fallback: use Gmail app password if OAuth is unavailable.
      </Typography>

      <TextField
        label="Gmail App Password"
        type="password"
        value={appPassword}
        onChange={(e) => setAppPassword(e.target.value)}
        autoComplete="current-password"
        fullWidth
        margin="normal"
      />

      <Button
        type="button"
        variant="outlined"
        fullWidth
        disabled={savingLegacy}
        onClick={() => void handleSaveLegacy()}
        sx={{
          mt: 2,
          py: 1.2,
          fontWeight: 700,
          textTransform: "none",
          borderRadius: 2,
        }}
      >
        {savingLegacy ? (
          <>
            <CircularProgress size={20} sx={{ color: "inherit", mr: 1 }} />
            Saving...
          </>
        ) : (
          "Save App Password (Legacy)"
        )}
      </Button>
    </Box>
  );
}
