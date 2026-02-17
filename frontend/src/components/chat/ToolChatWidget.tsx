import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Box,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import ToolStatusAlerts from "../alerts/ToolStatusAlerts";
import { apiFetch } from "../../utils/api";
import serviceCards from "../../metadata/serviceCards.json";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type ServiceCardMeta = {
  id: string;
  path: string;
};

const SUGGESTIONS = [
  "What does this tool do?",
  "Which tool should I use for invoices?",
  "Which tools work offline?",
];

const CHAT_FONT = `"Space Grotesk", "Avenir Next", "Segoe UI", sans-serif`;

export default function ToolChatWidget() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const location = useLocation();
  const cards = serviceCards as ServiceCardMeta[];

  const currentToolId = useMemo(() => {
    const match = cards.find((card) => card.path === location.pathname);
    return match?.id ?? null;
  }, [cards, location.pathname]);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi, I can explain Torensa tools in simple terms. Ask me anything.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const sendMessage = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || sending) return;

    setError("");
    const nextUser: ChatMessage = { role: "user", content: text };
    const nextMessages = [...messages, nextUser];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const response = await apiFetch("/api/tool-chat/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          currentToolId: currentToolId ?? undefined,
          history: nextMessages.slice(-6),
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || "Assistant is unavailable right now.");
        return;
      }

      const answer =
        typeof data?.answer === "string" && data.answer.trim()
          ? data.answer.trim()
          : "I couldn't generate an answer right now.";

      setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {isOpen && (
        <Paper
          elevation={10}
          sx={{
            position: "fixed",
            right: 20,
            bottom: 24,
            width: { xs: "calc(100vw - 24px)", sm: 360 },
            maxHeight: { xs: "74vh", sm: "70vh" },
            zIndex: 1300,
            borderRadius: "16px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            border: `1px solid ${alpha(theme.palette.common.white, isDark ? 0.18 : 0.45)}`,
            backdropFilter: "blur(10px)",
            background: isDark
              ? "linear-gradient(162deg, rgba(15,23,42,0.94) 0%, rgba(30,41,59,0.9) 60%, rgba(2,6,23,0.94) 100%)"
              : "linear-gradient(162deg, rgba(255,255,255,0.92) 0%, rgba(241,245,249,0.94) 65%, rgba(232,244,255,0.95) 100%)",
            boxShadow: isDark
              ? "0 24px 60px rgba(2,6,23,0.55)"
              : "0 24px 60px rgba(30,64,175,0.2)",
            fontFamily: CHAT_FONT,
            animation: "chatPanelIn 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
            "@keyframes chatPanelIn": {
              from: { opacity: 0, transform: "translateY(14px) scale(0.98)" },
              to: { opacity: 1, transform: "translateY(0) scale(1)" },
            },
            "@keyframes bubbleIn": {
              from: { opacity: 0, transform: "translateY(8px)" },
              to: { opacity: 1, transform: "translateY(0)" },
            },
            "@keyframes robotFloat": {
              "0%": { transform: "translateY(0px)" },
              "50%": { transform: "translateY(-2px)" },
              "100%": { transform: "translateY(0px)" },
            },
            "@keyframes robotGlow": {
              "0%": { boxShadow: "0 0 0 0 rgba(14,165,233,0.25)" },
              "70%": { boxShadow: "0 0 0 8px rgba(14,165,233,0)" },
              "100%": { boxShadow: "0 0 0 0 rgba(14,165,233,0)" },
            },
            "@keyframes dotBounce": {
              "0%, 60%, 100%": { transform: "translateY(0)", opacity: 0.45 },
              "30%": { transform: "translateY(-4px)", opacity: 1 },
            },
            "&::before": {
              content: '""',
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: isDark
                ? "radial-gradient(120px 70px at 15% 0%, rgba(14,165,233,0.22), transparent 75%), radial-gradient(160px 90px at 100% 8%, rgba(34,197,94,0.18), transparent 78%)"
                : "radial-gradient(120px 70px at 15% 0%, rgba(14,165,233,0.18), transparent 75%), radial-gradient(160px 90px at 100% 8%, rgba(245,158,11,0.16), transparent 78%)",
            },
          }}
        >
          <Box
            sx={{
              px: 1.8,
              py: 1.2,
              borderBottom: `1px solid ${alpha(theme.palette.common.white, isDark ? 0.14 : 0.5)}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: isDark
                ? "linear-gradient(110deg, #0f766e 0%, #0369a1 58%, #1d4ed8 100%)"
                : "linear-gradient(110deg, #0ea5e9 0%, #22c55e 58%, #f59e0b 100%)",
              position: "relative",
              zIndex: 1,
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <AutoAwesomeIcon
                sx={{ color: "rgba(255,255,255,0.95)", fontSize: 18 }}
              />
              <Box>
                <Typography
                  variant="subtitle2"
                  fontWeight={800}
                  sx={{
                    color: "rgba(255,255,255,0.98)",
                    lineHeight: 1.1,
                    letterSpacing: 0.3,
                  }}
                >
                  Tool Assistant
                </Typography>
                <Typography
                  sx={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.84)",
                    letterSpacing: 0.25,
                    fontWeight: 600,
                  }}
                >
                  Ask by category, feature, or tool name
                </Typography>
              </Box>
            </Stack>
            <IconButton
              size="small"
              onClick={() => setIsOpen(false)}
              sx={{
                color: "rgba(255,255,255,0.94)",
                bgcolor: "rgba(255,255,255,0.14)",
                "&:hover": { bgcolor: "rgba(255,255,255,0.24)" },
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <Box
            sx={{
              p: 1.4,
              overflow: "auto",
              display: "grid",
              gap: 1,
              position: "relative",
              zIndex: 1,
              "&::-webkit-scrollbar": { width: 8 },
              "&::-webkit-scrollbar-thumb": {
                borderRadius: "8px",
                background: alpha(
                  theme.palette.primary.main,
                  isDark ? 0.55 : 0.32,
                ),
              },
            }}
          >
            {messages.map((message, index) => (
              <Box
                key={`${message.role}-${index}`}
                sx={{
                  alignSelf: message.role === "user" ? "end" : "start",
                  maxWidth: "88%",
                  px: 1.35,
                  py: 1,
                  borderRadius:
                    message.role === "user"
                      ? "18px 18px 6px 18px"
                      : "18px 18px 18px 6px",
                  background:
                    message.role === "user"
                      ? isDark
                        ? "linear-gradient(130deg, #2563eb 0%, #0891b2 100%)"
                        : "linear-gradient(130deg, #2563eb 0%, #0ea5e9 100%)"
                      : isDark
                        ? "linear-gradient(130deg, rgba(51,65,85,0.92) 0%, rgba(30,41,59,0.92) 100%)"
                        : "linear-gradient(130deg, rgba(255,255,255,0.96) 0%, rgba(241,245,249,0.95) 100%)",
                  color:
                    message.role === "user"
                      ? "#f8fafc"
                      : theme.palette.text.primary,
                  border:
                    message.role === "assistant"
                      ? `1px solid ${alpha(theme.palette.common.white, isDark ? 0.14 : 0.75)}`
                      : "none",
                  boxShadow:
                    message.role === "user"
                      ? "0 10px 20px rgba(2,132,199,0.28)"
                      : isDark
                        ? "0 8px 18px rgba(2,6,23,0.35)"
                        : "0 8px 16px rgba(15,23,42,0.08)",
                  whiteSpace: "pre-wrap",
                  fontSize: 14,
                  lineHeight: 1.45,
                  fontWeight: 500,
                  position: "relative",
                  animation: "bubbleIn 180ms ease-out both",
                  animationDelay: `${index * 24}ms`,
                  "&::after": {
                    content: '""',
                    position: "absolute",
                    bottom: 0,
                    width: 10,
                    height: 10,
                    background: "inherit",
                    transform: "rotate(45deg)",
                    ...(message.role === "user" ? { right: -4 } : { left: -4 }),
                  },
                }}
              >
                {message.content}
              </Box>
            ))}

            {sending && (
              <Box
                sx={{
                  alignSelf: "start",
                  maxWidth: "82%",
                  px: 1.25,
                  py: 0.95,
                  borderRadius: "18px 18px 18px 6px",
                  background: isDark
                    ? "linear-gradient(130deg, rgba(51,65,85,0.94) 0%, rgba(30,41,59,0.94) 100%)"
                    : "linear-gradient(130deg, rgba(255,255,255,0.97) 0%, rgba(241,245,249,0.96) 100%)",
                  color: theme.palette.text.primary,
                  border: `1px solid ${alpha(theme.palette.common.white, isDark ? 0.14 : 0.75)}`,
                  boxShadow: isDark
                    ? "0 8px 18px rgba(2,6,23,0.35)"
                    : "0 8px 16px rgba(15,23,42,0.08)",
                  position: "relative",
                  animation: "bubbleIn 180ms ease-out both",
                  "&::after": {
                    content: '""',
                    position: "absolute",
                    bottom: 0,
                    left: -4,
                    width: 10,
                    height: 10,
                    background: "inherit",
                    transform: "rotate(45deg)",
                  },
                }}
              >
                <Stack direction="row" spacing={1.1} alignItems="center">
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: "10px",
                      background: isDark
                        ? "linear-gradient(135deg, rgba(14,165,233,0.3), rgba(37,99,235,0.42))"
                        : "linear-gradient(135deg, rgba(14,165,233,0.2), rgba(37,99,235,0.32))",
                      border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.35 : 0.25)}`,
                      display: "grid",
                      placeItems: "center",
                      animation:
                        "robotFloat 1.8s ease-in-out infinite, robotGlow 2s ease-in-out infinite",
                    }}
                  >
                    <SmartToyOutlinedIcon
                      sx={{ fontSize: 18, color: theme.palette.primary.light }}
                    />
                  </Box>
                  <Stack direction="row" alignItems="center" spacing={0.8}>
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 0.45 }}
                    >
                      {[0, 1, 2].map((dot) => (
                        <Box
                          key={dot}
                          sx={{
                            width: 6.5,
                            height: 6.5,
                            borderRadius: "50%",
                            bgcolor: alpha(
                              theme.palette.primary.main,
                              isDark ? 0.9 : 0.75,
                            ),
                            animation: "dotBounce 1s ease-in-out infinite",
                            animationDelay: `${dot * 0.14}s`,
                          }}
                        />
                      ))}
                    </Box>
                  </Stack>
                </Stack>
              </Box>
            )}

            {messages.length <= 1 && (
              <Stack direction="row" flexWrap="wrap" gap={0.8}>
                {SUGGESTIONS.map((item) => (
                  <Box
                    key={item}
                    role="button"
                    tabIndex={0}
                    onClick={() => void sendMessage(item)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        void sendMessage(item);
                      }
                    }}
                    sx={{
                      border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.5 : 0.25)}`,
                      background: isDark
                        ? "linear-gradient(120deg, rgba(30,41,59,0.75) 0%, rgba(15,23,42,0.72) 100%)"
                        : "linear-gradient(120deg, rgba(255,255,255,0.92) 0%, rgba(224,242,254,0.86) 100%)",
                      px: 1.1,
                      py: 0.65,
                      borderRadius: "10px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      color: theme.palette.text.secondary,
                      transition: "all 160ms ease",
                      "&:hover": {
                        transform: "translateY(-2px)",
                        color: theme.palette.text.primary,
                        borderColor: alpha(theme.palette.primary.main, 0.9),
                        boxShadow: isDark
                          ? "0 8px 14px rgba(2,6,23,0.35)"
                          : "0 8px 14px rgba(30,64,175,0.15)",
                      },
                    }}
                  >
                    {item}
                  </Box>
                ))}
              </Stack>
            )}
          </Box>

          <Box
            sx={{
              p: 1.25,
              borderTop: `1px solid ${alpha(theme.palette.common.white, isDark ? 0.14 : 0.6)}`,
              background: isDark
                ? "linear-gradient(180deg, rgba(15,23,42,0.25), rgba(15,23,42,0.6))"
                : "linear-gradient(180deg, rgba(255,255,255,0.45), rgba(248,250,252,0.82))",
              position: "relative",
              zIndex: 1,
            }}
          >
            <ToolStatusAlerts error={error} />
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                fullWidth
                size="small"
                placeholder="Ask about a tool..."
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage(input);
                  }
                }}
                disabled={sending}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "12px",
                    fontFamily: CHAT_FONT,
                    fontWeight: 600,
                    backgroundColor: isDark
                      ? "rgba(15,23,42,0.65)"
                      : "rgba(255,255,255,0.9)",
                    "& fieldset": {
                      borderColor: alpha(
                        theme.palette.primary.main,
                        isDark ? 0.45 : 0.26,
                      ),
                    },
                    "&:hover fieldset": {
                      borderColor: alpha(theme.palette.primary.main, 0.75),
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: theme.palette.primary.main,
                      borderWidth: 2,
                    },
                  },
                  "& .MuiInputBase-input::placeholder": {
                    opacity: 0.95,
                    color: theme.palette.text.secondary,
                  },
                }}
              />
              <IconButton
                onClick={() => void sendMessage(input)}
                disabled={sending || !input.trim()}
                sx={{
                  width: 36,
                  height: 36,
                  color: "#f8fafc",
                  background: isDark
                    ? "linear-gradient(135deg, #0891b2 0%, #2563eb 100%)"
                    : "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
                  border: `1px solid ${alpha(theme.palette.common.white, 0.38)}`,
                  boxShadow: "0 8px 16px rgba(2,132,199,0.3)",
                  "&:hover": {
                    background: isDark
                      ? "linear-gradient(135deg, #0284c7 0%, #1d4ed8 100%)"
                      : "linear-gradient(135deg, #0284c7 0%, #1d4ed8 100%)",
                    transform: "translateY(-1px)",
                  },
                  "&.Mui-disabled": {
                    color: alpha(theme.palette.common.white, 0.7),
                    background: alpha(
                      theme.palette.text.secondary,
                      isDark ? 0.22 : 0.2,
                    ),
                    boxShadow: "none",
                  },
                }}
              >
                {sending ? (
                  <CircularProgress size={18} sx={{ color: "#f8fafc" }} />
                ) : (
                  <SendIcon fontSize="small" />
                )}
              </IconButton>
            </Stack>
          </Box>
        </Paper>
      )}

      {!isOpen && (
        <IconButton
          onClick={() => setIsOpen(true)}
          sx={{
            position: "fixed",
            right: 20,
            bottom: 24,
            zIndex: 1300,
            bgcolor: "transparent",
            color: "#f8fafc",
            background: isDark
              ? "linear-gradient(135deg, #0f766e 0%, #0369a1 65%, #1d4ed8 100%)"
              : "linear-gradient(135deg, #0ea5e9 0%, #22c55e 65%, #f59e0b 100%)",
            border: `1px solid ${alpha(theme.palette.common.white, 0.52)}`,
            boxShadow: isDark
              ? "0 14px 30px rgba(2,6,23,0.5)"
              : "0 14px 28px rgba(30,64,175,0.22)",
            "&:hover": {
              transform: "translateY(-2px) scale(1.02)",
              filter: "saturate(1.08)",
            },
            width: 56,
            height: 56,
            borderRadius: "18px",
            transition: "all 180ms ease",
            animation: "launcherPulse 2.5s ease-in-out infinite",
            "@keyframes launcherPulse": {
              "0%": { boxShadow: "0 0 0 0 rgba(14,165,233,0.35)" },
              "70%": { boxShadow: "0 0 0 14px rgba(14,165,233,0)" },
              "100%": { boxShadow: "0 0 0 0 rgba(14,165,233,0)" },
            },
          }}
          aria-label="Open tool assistant"
        >
          <ChatBubbleOutlineIcon />
        </IconButton>
      )}
    </>
  );
}
