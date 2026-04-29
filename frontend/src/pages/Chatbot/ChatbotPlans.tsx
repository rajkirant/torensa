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
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import FacebookIcon from "@mui/icons-material/Facebook";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import PageContainer from "../../components/PageContainer";
import ToolStatusAlerts from "../../components/alerts/ToolStatusAlerts";
import { apiFetch } from "../../utils/api";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../utils/auth";

/* ── types ──────────────────────────────────────────────────────────────── */

interface Plan {
  id: string;
  name: string;
  price_usd: number;
  price_display: string;
  messages_per_month: number;
  bots: number;
  metadata_chars: number;
  features: string[];
  cta: string;
  highlight: boolean;
  paypal_plan_id: string | null;
}

interface BillingStatus {
  plan: string;
  provider: string;
  billing_status: string;
  current_period_end: string | null;
  usage: { month: string; messages_used: number; messages_limit: number };
  limits: { bots: number; metadata_chars: number; messages_per_month: number };
}

declare global {
  interface Window {
    paypal?: {
      Buttons: (options: {
        style?: object;
        createSubscription: (data: unknown, actions: { subscription: { create: (o: { plan_id: string }) => Promise<string> } }) => Promise<string>;
        onApprove: (data: { subscriptionID: string }) => void;
        onError?: (err: unknown) => void;
        onCancel?: () => void;
      }) => { render: (selector: string) => Promise<void> };
    };
  }
}

const CHAT_FONT = `"Space Grotesk", "Avenir Next", "Segoe UI", sans-serif`;

interface PayPalConfig {
  client_id: string;
  mode: "sandbox" | "live";
  currency: string;
}

function buildPayPalScriptUrl(config: PayPalConfig): string {
  return `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(config.client_id)}&vault=true&intent=subscription&currency=${encodeURIComponent(config.currency)}`;
}

function loadPayPalScript(scriptUrl: string): Promise<boolean> {
  if (window.paypal) return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${scriptUrl}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function ChatbotPlans() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  // Auto-trigger checkout if user just logged in and was redirected back with ?plan=
  useEffect(() => {
    const planParam = searchParams.get("plan");
    if (user && planParam && ["starter", "pro", "business"].includes(planParam)) {
      const matchedPlan = plans.find((p) => p.id === planParam);
      if (matchedPlan?.paypal_plan_id) void handleSubscribe(planParam, matchedPlan.paypal_plan_id);
      // Remove param from URL cleanly
      navigate("/chatbot-plans", { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [paypalConfig, setPaypalConfig] = useState<PayPalConfig | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [paypalActive, setPaypalActive] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const [plansRes, statusRes, configRes] = await Promise.all([
          apiFetch("/api/chatbots/billing/plans/"),
          apiFetch("/api/chatbots/billing/status/"),
          apiFetch("/api/chatbots/billing/paypal/config/"),
        ]);
        if (plansRes.ok) setPlans(await plansRes.json());
        if (statusRes.ok) setBilling(await statusRes.json());
        if (configRes.ok) setPaypalConfig(await configRes.json());
      } finally {
        setLoadingPlans(false);
      }
    })();
  }, []);

  const handleSubscribe = async (planId: string, paypalPlanId: string) => {
    if (!user) {
      const returnTo = encodeURIComponent(`/chatbot-plans?plan=${planId}`);
      navigate(`/login?redirect=${returnTo}`);
      return;
    }
    setError("");
    setSuccess("");
    setCheckingOut(planId);
    setPaypalActive(planId);

    if (!paypalConfig?.client_id || paypalConfig.client_id.startsWith("REPLACE_WITH_")) {
      setError("PayPal is not configured. Please contact support.");
      setCheckingOut(null);
      setPaypalActive(null);
      return;
    }

    const loaded = await loadPayPalScript(buildPayPalScriptUrl(paypalConfig));
    if (!loaded || !window.paypal) {
      setError("Could not load PayPal. Please try again.");
      setCheckingOut(null);
      setPaypalActive(null);
      return;
    }

    const containerId = `paypal-btn-${planId}`;
    // Wait a tick so React has rendered the container for this plan.
    await new Promise((r) => setTimeout(r, 0));
    const container = document.getElementById(containerId);
    if (!container) {
      setError("PayPal button container not found.");
      setCheckingOut(null);
      setPaypalActive(null);
      return;
    }
    container.innerHTML = "";

    window.paypal.Buttons({
      style: { shape: "rect", color: "gold", layout: "vertical", label: "subscribe" },
      createSubscription: (_data, actions) => {
        return actions.subscription.create({ plan_id: paypalPlanId });
      },
      onApprove: async (data) => {
        setCheckingOut(planId);
        try {
          const res = await apiFetch("/api/chatbots/billing/paypal/capture/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscriptionID: data.subscriptionID, plan: planId }),
          });
          const result = await res.json().catch(() => null);
          if (!res.ok) {
            setError(result?.error || "Could not activate subscription.");
            return;
          }
          window.location.href = result?.redirect_url || "/custom-chatbot-builder?checkout=success";
        } catch {
          setError("Payment completed but activation failed. Please refresh.");
        } finally {
          setCheckingOut(null);
        }
      },
      onError: () => {
        setError("PayPal encountered an error. Please try again.");
        setCheckingOut(null);
        setPaypalActive(null);
      },
      onCancel: () => {
        setCheckingOut(null);
      },
    }).render(`#${containerId}`).then(() => {
      setCheckingOut(null);
    }).catch(() => {
      setError("Could not render PayPal buttons.");
      setCheckingOut(null);
      setPaypalActive(null);
    });
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm("Cancel your current chatbot subscription at the end of this billing cycle?")) {
      return;
    }
    setError("");
    setSuccess("");
    setOpeningPortal(true);
    try {
      const res = await apiFetch("/api/chatbots/billing/cancel/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancel_at_cycle_end: true }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Could not cancel subscription.");
        return;
      }
      setSuccess("Cancellation scheduled. Your plan remains active until the current cycle ends.");
      const statusRes = await apiFetch("/api/chatbots/billing/status/");
      if (statusRes.ok) setBilling(await statusRes.json());
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
  const billingStatus = billing?.billing_status || "";

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
                    {billingStatus && (
                      <Chip
                        label={billingStatus}
                        size="small"
                        color={["active", "authenticated"].includes(billingStatus) ? "success" : "warning"}
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
                  endIcon={openingPortal ? <CircularProgress size={14} /> : <CancelOutlinedIcon fontSize="small" />}
                  onClick={() => void handleCancelSubscription()}
                  disabled={openingPortal}
                  sx={{ borderRadius: "10px", fontWeight: 700 }}
                >
                  Cancel plan
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

        {(error || success) && <ToolStatusAlerts error={error} success={success} />}

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
                      Powered by AWS Bedrock · billed monthly in USD
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
                    {plan.id === "free" ? (
                      <Button
                        fullWidth
                        variant={isCurrent ? "contained" : "outlined"}
                        disabled={isCurrent}
                        onClick={() => navigate("/custom-chatbot-builder")}
                        sx={{ borderRadius: "12px", fontWeight: 800, py: 1.2, fontFamily: CHAT_FONT }}
                      >
                        {isCurrent ? "Your current plan" : plan.cta}
                      </Button>
                    ) : !user ? (
                      <Button
                        fullWidth
                        variant="outlined"
                        onClick={() => navigate(`/login?redirect=${encodeURIComponent(`/chatbot-plans?plan=${plan.id}`)}`)}
                        sx={{ borderRadius: "12px", fontWeight: 800, py: 1.2, fontFamily: CHAT_FONT }}
                      >
                        Log in to subscribe
                      </Button>
                    ) : isCurrent ? (
                      <Button fullWidth variant="contained" disabled sx={{ borderRadius: "12px", fontWeight: 800, py: 1.2, fontFamily: CHAT_FONT }}>
                        Your current plan
                      </Button>
                    ) : paypalActive === plan.id ? (
                      <Box>
                        {isLoading && (
                          <Stack alignItems="center" py={1}><CircularProgress size={24} /></Stack>
                        )}
                        <Box id={`paypal-btn-${plan.id}`} sx={{ minHeight: 45 }} />
                      </Box>
                    ) : (
                      <Button
                        fullWidth
                        variant={isHighlight ? "contained" : "outlined"}
                        disabled={isLoading}
                        onClick={() => plan.paypal_plan_id && void handleSubscribe(plan.id, plan.paypal_plan_id)}
                        sx={{
                          borderRadius: "12px",
                          fontWeight: 800,
                          py: 1.2,
                          fontFamily: CHAT_FONT,
                          ...(isHighlight ? { background: headerGradient, color: "#fff", "&:hover": { filter: "saturate(1.1)" } } : {}),
                        }}
                      >
                        {isLoading ? <CircularProgress size={20} /> : plan.cta}
                      </Button>
                    )}
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
              a: "Yes. Use Cancel plan to schedule cancellation at the end of the billing period.",
            },
            {
              q: "What happens when I hit the monthly message limit?",
              a: "Chatting pauses with a clear message. Your bots and history are safe — upgrade or wait for the next billing cycle.",
            },
            {
              q: "Can I switch plans mid-month?",
              a: "Yes. Choose another plan and complete Razorpay checkout. Your new limits apply after verification.",
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

        {/* ── Support ─────────────────────────────────────────────────────── */}
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
            Need help?
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Got a question about billing, your plan, or anything else? Reach out — we usually reply within a few hours.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} flexWrap="wrap">
            <Button
              variant="outlined"
              startIcon={<WhatsAppIcon />}
              href="https://wa.me/447796908235"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ borderRadius: "10px", fontWeight: 700, justifyContent: "flex-start" }}
            >
              WhatsApp: +44 7796 908235
            </Button>
            <Button
              variant="outlined"
              startIcon={<FacebookIcon />}
              href="https://www.facebook.com/tryTorensa/"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ borderRadius: "10px", fontWeight: 700, justifyContent: "flex-start" }}
            >
              Facebook Messenger
            </Button>
            <Button
              variant="outlined"
              startIcon={<EmailOutlinedIcon />}
              href="mailto:admin@torensa.com"
              sx={{ borderRadius: "10px", fontWeight: 700, justifyContent: "flex-start" }}
            >
              admin@torensa.com
            </Button>
          </Stack>
        </Paper>

      </Stack>
    </PageContainer>
  );
}
