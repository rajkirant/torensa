import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTheme, alpha } from "@mui/material/styles";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PageContainer from "../../components/PageContainer";
import ToolStatusAlerts from "../../components/alerts/ToolStatusAlerts";
import { apiFetch } from "../../utils/api";
import { useNavigate } from "react-router-dom";

/* ── types ──────────────────────────────────────────────────────────────── */

interface Plan {
  id: string;
  name: string;
  price_gbp: number;
  price_display: string;
  messages_per_month: number;
  bots: number;
  metadata_chars: number;
  features: string[];
  cta: string;
  highlight: boolean;
  stripe_price_id: string | null;
}

interface BillingStatus {
  plan: string;
  stripe_status: string;
  current_period_end: string | null;
  usage: { month: string; messages_used: number; messages_limit: number };
  limits: { bots: number; metadata_chars: number; messages_per_month: number };
}

const CHAT_FONT = `"Space Grotesk", "Avenir Next", "Segoe UI", sans-serif`;

export default function ChatbotPlans() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const navigate = useNavigate();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const [plansRes, statusRes] = await Promise.all([
          apiFetch("/api/chatbots/billing/plans/"),
          apiFetch("/api/chatbots/billing/status/"),
        ]);
        if (plansRes.ok) setPlans(await plansRes.json());
        if (statusRes.ok) setBilling(await statusRes.json());
      } finally {
        setLoadingPlans(false);
      }
    })();
  }, []);

  const handleSubscribe = async (planId: string) => {
    setError("");
    setCheckingOut(planId);
    try {
      const res = await apiFetch("/api/chatbots/billing/checkout/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Could not start checkout.");
        return;
      }
      window.location.href = data.checkout_url;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCheckingOut(null);
    }
  };

  const handlePortal = async () => {
    setError("");
    setOpeningPortal(true);
    try {
      const res = await apiFetch("/api/chatbots/billing/portal/", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Could not open billing portal.");
        return;
      }
      window.open(data.portal_url, "_blank", "noopener");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setOpeningPortal(false);
    }
  };

  const headerGradient = isDark
    ? "linear-gradient(110deg, #0f766e 0%, #0369a1 58%, #1d4ed8 100%)"
    : "linear-gradient(110deg, #0ea5e9 0%, #6366f1 58%, #8b5cf6 100%)";

  const activePlan = billing?.plan ?? "free";

  return (
    <PageContainer>
      <Stack spacing={4}>

        {/* ── hero ─────────────────────────────────────────────────────────── */}
        <Box textAlign="center">
          <Stack direction="row" justifyContent="center" alignItems="center" spacing={1} mb={1}>
            <AutoAwesomeIcon sx={{ color: theme.palette.primary.main }} />
            <Typography variant="overline" color="primary" fontWeight={800} letterSpacing={2}>
              Chatbot Plans
            </Typography>
          </Stack>
          <Typography variant="h4" fontWeight={900} sx={{ fontFamily: CHAT_FONT }} gutterBottom>
            Build smarter chatbots
          </Typography>
          <Typography variant="body1" color="text.secondary" maxWidth={560} mx="auto">
            Turn any text into an AI chatbot powered by AWS Bedrock (Claude). Start free,
            upgrade as you grow. All plans use on-demand Bedrock pricing — no GPU waste.
          </Typography>
        </Box>

        {/* ── current plan banner ───────────────────────────────────────────── */}
        {billing && (
          <Paper
            elevation={2}
            sx={{
              p: 2,
              borderRadius: "14px",
              background: isDark
                ? alpha(theme.palette.primary.dark, 0.18)
                : alpha(theme.palette.primary.light, 0.18),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
            }}
          >
            <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" gap={2}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Box>
                  <Typography variant="body2" color="text.secondary">Current plan</Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="h6" fontWeight={800} sx={{ fontFamily: CHAT_FONT, textTransform: "capitalize" }}>
                      {activePlan}
                    </Typography>
                    {billing.stripe_status && billing.stripe_status !== "" && (
                      <Chip
                        label={billing.stripe_status}
                        size="small"
                        color={billing.stripe_status === "active" ? "success" : "warning"}
                        sx={{ fontWeight: 700, height: 20, fontSize: 11 }}
                      />
                    )}
                  </Stack>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box>
                  <Typography variant="body2" color="text.secondary">This month</Typography>
                  <Typography variant="h6" fontWeight={800} sx={{ fontFamily: CHAT_FONT }}>
                    {billing.usage.messages_used} / {billing.usage.messages_limit} messages
                  </Typography>
                </Box>
              </Stack>
              {activePlan !== "free" && (
                <Button
                  variant="outlined"
                  size="small"
                  endIcon={openingPortal ? <CircularProgress size={14} /> : <OpenInNewIcon fontSize="small" />}
                  onClick={() => void handlePortal()}
                  disabled={openingPortal}
                  sx={{ borderRadius: "10px", fontWeight: 700 }}
                >
                  Manage billing
                </Button>
              )}
            </Stack>

            {/* usage bar */}
            <Box mt={1.5}>
              <Box
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: alpha(theme.palette.primary.main, isDark ? 0.15 : 0.12),
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    height: "100%",
                    width: `${Math.min(100, (billing.usage.messages_used / billing.usage.messages_limit) * 100)}%`,
                    background: headerGradient,
                    borderRadius: 3,
                    transition: "width 0.5s ease",
                  }}
                />
              </Box>
            </Box>
          </Paper>
        )}

        {error && <ToolStatusAlerts error={error} />}

        {/* ── plan cards ────────────────────────────────────────────────────── */}
        {loadingPlans ? (
          <Stack alignItems="center" py={6}>
            <CircularProgress />
          </Stack>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(4, 1fr)" },
              gap: 2,
            }}
          >
            {plans.map((plan) => {
              const isCurrent = plan.id === activePlan;
              const isHighlight = plan.highlight;
              const isLoading = checkingOut === plan.id;

              return (
                <Paper
                  key={plan.id}
                  elevation={isHighlight ? 8 : 3}
                  sx={{
                    borderRadius: "18px",
                    overflow: "hidden",
                    border: isCurrent
                      ? `2px solid ${theme.palette.success.main}`
                      : isHighlight
                        ? `2px solid ${theme.palette.primary.main}`
                        : `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                    display: "flex",
                    flexDirection: "column",
                    position: "relative",
                    transform: isHighlight ? "scale(1.02)" : "none",
                    transition: "transform 200ms ease, box-shadow 200ms ease",
                    "&:hover": {
                      transform: isHighlight ? "scale(1.03)" : "scale(1.01)",
                      boxShadow: isDark
                        ? "0 20px 40px rgba(2,6,23,0.5)"
                        : "0 20px 40px rgba(30,64,175,0.15)",
                    },
                  }}
                >
                  {/* badge */}
                  {isHighlight && !isCurrent && (
                    <Box
                      sx={{
                        position: "absolute",
                        top: 14,
                        right: 14,
                        background: headerGradient,
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 800,
                        px: 1,
                        py: 0.3,
                        borderRadius: "8px",
                        letterSpacing: 0.5,
                      }}
                    >
                      MOST POPULAR
                    </Box>
                  )}
                  {isCurrent && (
                    <Box
                      sx={{
                        position: "absolute",
                        top: 14,
                        right: 14,
                        bgcolor: "success.main",
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 800,
                        px: 1,
                        py: 0.3,
                        borderRadius: "8px",
                        letterSpacing: 0.5,
                      }}
                    >
                      CURRENT
                    </Box>
                  )}

                  {/* header */}
                  <Box
                    sx={{
                      p: 2.5,
                      pb: 2,
                      background: isHighlight
                        ? headerGradient
                        : isDark
                          ? alpha(theme.palette.background.paper, 0.5)
                          : alpha(theme.palette.grey[50], 0.9),
                    }}
                  >
                    <Typography
                      variant="h6"
                      fontWeight={900}
                      sx={{
                        fontFamily: CHAT_FONT,
                        color: isHighlight ? "#fff" : "text.primary",
                      }}
                    >
                      {plan.name}
                    </Typography>
                    <Typography
                      variant="h4"
                      fontWeight={900}
                      mt={0.5}
                      sx={{
                        fontFamily: CHAT_FONT,
                        color: isHighlight ? "#fff" : "text.primary",
                      }}
                    >
                      {plan.price_display}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: isHighlight ? "rgba(255,255,255,0.8)" : "text.secondary" }}
                    >
                      Powered by AWS Bedrock · billed monthly in GBP
                    </Typography>
                  </Box>

                  {/* features */}
                  <Box sx={{ p: 2.5, pt: 2, flex: 1 }}>
                    <Stack spacing={1}>
                      {plan.features.map((f) => (
                        <Stack key={f} direction="row" spacing={1} alignItems="flex-start">
                          <CheckCircleOutlineIcon
                            sx={{ fontSize: 17, mt: 0.15, color: isHighlight ? "primary.main" : "success.main", flexShrink: 0 }}
                          />
                          <Typography variant="body2" sx={{ lineHeight: 1.4 }}>{f}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>

                  {/* CTA */}
                  <Box sx={{ p: 2.5, pt: 0 }}>
                    <Button
                      fullWidth
                      variant={isHighlight || isCurrent ? "contained" : "outlined"}
                      disabled={isCurrent || isLoading}
                      onClick={() => {
                        if (plan.id === "free") {
                          navigate("/custom-chatbot-builder");
                        } else {
                          void handleSubscribe(plan.id);
                        }
                      }}
                      sx={{
                        borderRadius: "12px",
                        fontWeight: 800,
                        py: 1.2,
                        fontFamily: CHAT_FONT,
                        ...(isHighlight && !isCurrent
                          ? { background: headerGradient, color: "#fff", "&:hover": { filter: "saturate(1.1)" } }
                          : {}),
                      }}
                    >
                      {isLoading ? (
                        <CircularProgress size={20} sx={{ color: "inherit" }} />
                      ) : isCurrent ? (
                        "Your current plan"
                      ) : (
                        plan.cta
                      )}
                    </Button>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        )}

        {/* ── Bedrock pricing note ──────────────────────────────────────────── */}
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: "14px",
            background: isDark
              ? alpha(theme.palette.background.paper, 0.5)
              : alpha(theme.palette.grey[50], 0.9),
            border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
          }}
        >
          <Typography variant="subtitle2" fontWeight={800} gutterBottom sx={{ fontFamily: CHAT_FONT }}>
            Why is it so affordable?
          </Typography>
          <Typography variant="body2" color="text.secondary" lineHeight={1.7}>
            This chatbot runs on <strong>AWS Bedrock (Claude 3 Haiku)</strong> — one of the most
            cost-efficient enterprise AI models available. Input costs ~£0.00020 / 1K tokens and
            output ~£0.00098 / 1K tokens. A typical message exchange costs less than <strong>£0.002</strong>.
            We pass those savings directly to you while covering infrastructure, storage, and support.
            On-demand pricing means you're never paying for idle GPU time.
          </Typography>
        </Paper>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <Stack spacing={1.5}>
          <Typography variant="subtitle1" fontWeight={800} sx={{ fontFamily: CHAT_FONT }}>
            Frequently asked questions
          </Typography>
          {[
            {
              q: "Can I cancel at any time?",
              a: "Yes. Cancel from the Manage billing portal. Your plan stays active until the end of the billing period.",
            },
            {
              q: "What happens when I hit the monthly message limit?",
              a: "Chatting pauses with a clear message. Your bots and history are safe — upgrade or wait for the next billing cycle.",
            },
            {
              q: "Can I switch plans mid-month?",
              a: "Yes. Stripe prorates the charge automatically.",
            },
            {
              q: "Is there a free trial?",
              a: "The Free plan is permanent with 50 messages/month and 1 chatbot — no credit card needed.",
            },
          ].map(({ q, a }) => (
            <Box key={q}>
              <Typography variant="body2" fontWeight={700}>{q}</Typography>
              <Typography variant="body2" color="text.secondary">{a}</Typography>
            </Box>
          ))}
        </Stack>

      </Stack>
    </PageContainer>
  );
}
