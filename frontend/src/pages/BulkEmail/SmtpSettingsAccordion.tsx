import { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Typography,
  TextField,
} from "@mui/material";
import { apiFetch } from "../../utils/api";
import ToolStatusAlerts from "../../components/alerts/ToolStatusAlerts";

type Props = {
  onConnected?: () => void;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SmtpSettingsAccordion({ onConnected }: Props) {
  const [smtpEmail, setSmtpEmail] = useState("");
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConnectGmail(e: React.FormEvent) {
    e.preventDefault();
    setError("");

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

      onConnected?.();
      window.location.assign(data.auth_url);
    } catch {
      setError("Unable to connect Gmail right now");
    } finally {
      setOauthLoading(false);
    }
  }

  return (
    <Box component="form" onSubmit={handleConnectGmail}>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        Connect your Gmail account with OAuth. App passwords are no longer supported.
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

      <ToolStatusAlerts error={error} sx={{ mt: 2 }} />

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
    </Box>
  );
}
