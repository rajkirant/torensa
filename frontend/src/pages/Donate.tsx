import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import FavoriteIcon from "@mui/icons-material/Favorite";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useTheme, alpha } from "@mui/material/styles";

import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { apiFetch } from "../utils/api";

interface DonationConfig {
  donate_url: string;
  currency: string;
  suggested_amounts: number[];
}

export default function Donate() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [config, setConfig] = useState<DonationConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch("/api/donations/config/");
        if (res.ok) setConfig(await res.json());
      } finally {
        setLoadingConfig(false);
      }
    })();
  }, []);

  const handleDonate = async () => {
    setError("");
    setSuccess("");

    if (!config?.donate_url) {
      setError("Donations are temporarily unavailable. Please try again later.");
      return;
    }

    setSubmitting(true);
    try {
      // Log the intent (anonymous or logged-in). Amount is unknown at this point —
      // recorded as 0 so we still have a row for analytics.
      await apiFetch("/api/donations/intent/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: "0",
          currency: config.currency || "GBP",
          message: message.trim(),
        }),
      }).catch(() => {});

      setSuccess("Opening PayPal in a new tab — thank you!");
      window.open(config.donate_url, "_blank", "noopener,noreferrer");
    } finally {
      setSubmitting(false);
    }
  };

  const headerGradient = isDark
    ? "linear-gradient(110deg, #be123c 0%, #9d174d 60%, #6d28d9 100%)"
    : "linear-gradient(110deg, #f43f5e 0%, #ec4899 60%, #8b5cf6 100%)";

  return (
    <PageContainer>
      <Stack spacing={4}>
        <Box textAlign="center">
          <Stack direction="row" justifyContent="center" alignItems="center" spacing={1} mb={1}>
            <FavoriteIcon sx={{ color: theme.palette.error.main }} />
            <Typography variant="overline" color="error" fontWeight={800} letterSpacing={2}>
              Support Torensa
            </Typography>
          </Stack>
          <Typography variant="h4" fontWeight={900} gutterBottom>
            Make a one-time donation
          </Typography>
          <Typography variant="body1" color="text.secondary" maxWidth={560} mx="auto">
            Torensa is built and maintained by a small team. Every donation helps cover
            hosting, AI inference costs, and keeps the tools free for everyone.
          </Typography>
        </Box>

        <Paper
          elevation={3}
          sx={{
            borderRadius: "18px",
            overflow: "hidden",
            border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
          }}
        >
          <Box sx={{ p: 3, background: headerGradient, color: "#fff" }}>
            <Typography variant="h6" fontWeight={900}>
              Donate via PayPal
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.85 }}>
              You'll choose the amount securely on PayPal's donation page.
            </Typography>
          </Box>

          <Box sx={{ p: 3 }}>
            {loadingConfig ? (
              <Stack alignItems="center" py={4}>
                <CircularProgress />
              </Stack>
            ) : (
              <Stack spacing={3}>
                <TextField
                  label="Leave a message (optional)"
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                  placeholder="Tell us what you love about Torensa"
                  multiline
                  minRows={2}
                  fullWidth
                />

                {(error || success) && (
                  <ToolStatusAlerts error={error} success={success} />
                )}

                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={() => void handleDonate()}
                  disabled={submitting}
                  endIcon={
                    submitting ? (
                      <CircularProgress size={18} sx={{ color: "#fff" }} />
                    ) : (
                      <OpenInNewIcon />
                    )
                  }
                  sx={{
                    borderRadius: "12px",
                    fontWeight: 900,
                    py: 1.5,
                    background: headerGradient,
                    color: "#fff",
                    "&:hover": { filter: "saturate(1.1)" },
                  }}
                >
                  Donate with PayPal
                </Button>

                <Typography variant="caption" color="text.secondary" textAlign="center">
                  You'll be redirected to PayPal to choose an amount and complete the
                  donation. Torensa never sees your card details.
                </Typography>
              </Stack>
            )}
          </Box>
        </Paper>
      </Stack>
    </PageContainer>
  );
}
