import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
  TextField,
} from "@mui/material";
import { apiFetch } from "../../utils/api";
import { formatApiError } from "../../utils/apiError";
import ToolStatusAlerts from "../../components/alerts/ToolStatusAlerts";

type SMTPConfig = {
  id: number;
  smtp_email: string;
  provider: string;
};

type Props = {
  onConnected?: () => void;
  onDisconnected?: (smtpEmail: string) => void;
  defaultSmtpEmail?: string;
  onSmtpEmailRemember?: (email: string) => void;
  smtpConfigs?: SMTPConfig[];
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SmtpSettingsAccordion({
  onConnected,
  onDisconnected,
  defaultSmtpEmail = "",
  onSmtpEmailRemember,
  smtpConfigs = [],
}: Props) {
  const [smtpEmail, setSmtpEmail] = useState("");
  const [oauthLoading, setOauthLoading] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const normalizedInputEmail = smtpEmail.trim().toLowerCase();
  const isAlreadyConnected =
    !!normalizedInputEmail &&
    smtpConfigs.some(
      (cfg) => cfg.smtp_email.trim().toLowerCase() === normalizedInputEmail,
    );

  useEffect(() => {
    if (smtpEmail.trim()) return;
    if (!defaultSmtpEmail.trim()) return;
    setSmtpEmail(defaultSmtpEmail);
  }, [defaultSmtpEmail, smtpEmail]);

  async function handleConnectGmail(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const normalizedEmail = normalizedInputEmail;

    if (!emailRegex.test(normalizedEmail)) {
      setError("Please enter a valid Gmail address");
      return;
    }

    if (isAlreadyConnected) {
      setError(
        "This Gmail is already connected. Remove the existing connection first.",
      );
      return;
    }

    setOauthLoading(true);

    try {
      onSmtpEmailRemember?.(normalizedEmail);

      const query = new URLSearchParams({ smtp_email: normalizedEmail });
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

  async function handleDisconnect(config: SMTPConfig) {
    if (
      !window.confirm(
        `Remove Gmail connection for ${config.smtp_email}?`,
      )
    ) {
      return;
    }

    setError("");
    setDisconnectingId(config.id);

    try {
      const res = await apiFetch("/api/smtp/disconnect/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ smtp_config_id: config.id }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(formatApiError(data, "Failed to remove Gmail connection"));
        return;
      }

      const disconnectedEmail =
        typeof data?.smtp_email === "string" && data.smtp_email.trim()
          ? data.smtp_email.trim()
          : config.smtp_email;
      onDisconnected?.(disconnectedEmail);
    } catch {
      setError("Unable to remove Gmail connection right now");
    } finally {
      setDisconnectingId(null);
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
        disabled={oauthLoading || isAlreadyConnected}
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
        ) : isAlreadyConnected ? (
          "Already connected (remove first)"
        ) : (
          "Connect Gmail"
        )}
      </Button>

      {smtpConfigs.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Connected accounts
          </Typography>

          <Stack spacing={1.2}>
            {smtpConfigs.map((config) => (
              <Alert
                key={config.id}
                severity="success"
                action={
                  <Button
                    color="inherit"
                    size="small"
                    type="button"
                    disabled={disconnectingId === config.id}
                    onClick={() => handleDisconnect(config)}
                    sx={{ textTransform: "none", fontWeight: 700 }}
                  >
                    {disconnectingId === config.id ? "Removing..." : "Remove connection"}
                  </Button>
                }
                sx={{ alignItems: "center" }}
              >
                {config.smtp_email}
              </Alert>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
