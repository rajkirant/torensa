import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTheme, alpha } from "@mui/material/styles";
import SendIcon from "@mui/icons-material/Send";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { apiFetch } from "../../utils/api";

const CHAT_FONT = `"Space Grotesk", "Avenir Next", "Segoe UI", sans-serif`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface BotInfo {
  id: number;
  name: string;
  visitor_messages_used: number;
  visitor_messages_limit: number;
}

export default function ChatbotWindow() {
  const { id: publicId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [botInfo, setBotInfo] = useState<BotInfo | null>(null);
  const [infoError, setInfoError] = useState("");
  const [infoLoading, setInfoLoading] = useState(true);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [limitReached, setLimitReached] = useState(false);
  const [messagesUsed, setMessagesUsed] = useState(0);
  const [messagesLimit, setMessagesLimit] = useState(20);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  }, [messages, chatSending]);

  const loadBotInfo = useCallback(async () => {
    if (!publicId) return;
    setInfoLoading(true);
    setInfoError("");
    try {
      const res = await apiFetch(`/api/chatbots/${publicId}/public/`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setInfoError(data?.error || "Chatbot not found.");
        return;
      }
      const data: BotInfo = await res.json();
      setBotInfo(data);
      setMessagesUsed(data.visitor_messages_used);
      setMessagesLimit(data.visitor_messages_limit);
      if (data.visitor_messages_used >= data.visitor_messages_limit) {
        setLimitReached(true);
      }
    } catch {
      setInfoError("Network error. Please try again.");
    } finally {
      setInfoLoading(false);
    }
  }, [publicId]);

  useEffect(() => {
    void loadBotInfo();
  }, [loadBotInfo]);

  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatSending || !publicId || limitReached) return;

    setChatError("");
    setChatInput("");
    setChatSending(true);
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    try {
      const res = await apiFetch(`/api/chatbots/${publicId}/public/chat/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 429 && data?.limit_reached) {
          setLimitReached(true);
          setChatError(data.error || "Message limit reached.");
        } else {
          setChatError(data?.error || "Request failed. Please try again.");
        }
        return;
      }

      const answer = (data?.answer || "").trim() || "No response.";
      setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
      if (data?.usage) {
        setMessagesUsed(data.usage.messages_used);
        setMessagesLimit(data.usage.messages_limit);
        if (data.usage.messages_used >= data.usage.messages_limit) {
          setLimitReached(true);
        }
      }
    } catch {
      setChatError("Network error. Please try again.");
    } finally {
      setChatSending(false);
    }
  };

  const headerGradient = isDark
    ? "linear-gradient(110deg, #0f766e 0%, #0369a1 58%, #1d4ed8 100%)"
    : "linear-gradient(110deg, #0ea5e9 0%, #6366f1 58%, #8b5cf6 100%)";

  const panelBg = isDark ? "#0f172a" : "#f8fafc";

  if (infoLoading) {
    return (
      <Stack
        alignItems="center"
        justifyContent="center"
        sx={{ height: "100dvh", background: panelBg }}
      >
        <CircularProgress />
      </Stack>
    );
  }

  if (infoError) {
    return (
      <Stack
        alignItems="center"
        justifyContent="center"
        spacing={2}
        sx={{ height: "100dvh", background: panelBg, p: 4 }}
      >
        <SmartToyOutlinedIcon sx={{ fontSize: 56, color: "text.secondary" }} />
        <Typography variant="h6" color="text.secondary" textAlign="center">
          {infoError}
        </Typography>
      </Stack>
    );
  }

  const botTitle = botInfo?.name ? `${botInfo.name} | Torensa AI` : "Chatbot | Torensa AI";
  const botDescription = botInfo?.name
    ? `Chat with ${botInfo.name} — an AI assistant powered by Torensa.`
    : "Chat with an AI assistant powered by Torensa.";

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        background: panelBg,
        fontFamily: CHAT_FONT,
      }}
    >
      <Helmet>
        <title>{botTitle}</title>
        <meta name="description" content={botDescription} />
        <meta name="robots" content="noindex, nofollow" />
        <style>{`body { background: ${panelBg}; margin: 0; }`}</style>
      </Helmet>
      {/* header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          background: headerGradient,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <Stack direction="row" spacing={1.2} alignItems="center">
          <SmartToyOutlinedIcon sx={{ color: "rgba(255,255,255,0.9)", fontSize: 20 }} />
          <Box>
            <Typography
              variant="subtitle1"
              fontWeight={800}
              color="#fff"
              sx={{ fontFamily: CHAT_FONT, lineHeight: 1.2 }}
            >
              {botInfo?.name}
            </Typography>
            <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.72)" }}>
              Powered by AI · {messagesLimit - messagesUsed} messages left
            </Typography>
          </Box>
        </Stack>
        <Tooltip title="Build your own chatbot">
          <IconButton
            size="small"
            onClick={() => navigate("/custom-chatbot-builder")}
            sx={{ color: "rgba(255,255,255,0.85)", "&:hover": { color: "#fff" } }}
          >
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* usage bar */}
      <Tooltip title={`${messagesUsed} of ${messagesLimit} messages used`}>
        <LinearProgress
          variant="determinate"
          value={Math.min(100, (messagesUsed / messagesLimit) * 100)}
          sx={{
            height: 3,
            borderRadius: 0,
            flexShrink: 0,
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            "& .MuiLinearProgress-bar": {
              background: headerGradient,
            },
          }}
        />
      </Tooltip>

      {/* messages */}
      <Box
        ref={messagesEndRef}
        sx={{
          flex: 1,
          overflowY: "auto",
          p: 2,
          display: "flex",
          flexDirection: "column",
          gap: 1.2,
          "&::-webkit-scrollbar": { width: 6 },
          "&::-webkit-scrollbar-thumb": {
            borderRadius: "6px",
            background: alpha(theme.palette.primary.main, isDark ? 0.5 : 0.3),
          },
        }}
      >
        {messages.length === 0 && !chatSending && (
          <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Ask me anything about "{botInfo?.name}"
            </Typography>
          </Box>
        )}

        {messages.map((msg, i) => (
          <Box
            key={i}
            sx={{
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              maxWidth: { xs: "90%", sm: "78%" },
              px: 1.5,
              py: 1,
              borderRadius:
                msg.role === "user"
                  ? "18px 18px 6px 18px"
                  : "18px 18px 18px 6px",
              background:
                msg.role === "user"
                  ? isDark
                    ? "linear-gradient(130deg, #2563eb, #0891b2)"
                    : "linear-gradient(130deg, #2563eb, #0ea5e9)"
                  : isDark
                    ? "linear-gradient(130deg, rgba(51,65,85,0.92), rgba(30,41,59,0.92))"
                    : "linear-gradient(130deg, rgba(255,255,255,0.97), rgba(241,245,249,0.96))",
              color: msg.role === "user" ? "#f8fafc" : theme.palette.text.primary,
              border:
                msg.role === "assistant"
                  ? `1px solid ${alpha(theme.palette.common.white, isDark ? 0.14 : 0.7)}`
                  : "none",
              boxShadow:
                msg.role === "user"
                  ? "0 8px 18px rgba(2,132,199,0.25)"
                  : isDark
                    ? "0 6px 14px rgba(2,6,23,0.3)"
                    : "0 6px 14px rgba(15,23,42,0.07)",
              whiteSpace: "pre-wrap",
              fontSize: 14,
              lineHeight: 1.55,
              fontWeight: 500,
              fontFamily: CHAT_FONT,
            }}
          >
            {msg.content}
          </Box>
        ))}

        {chatSending && (
          <Box
            sx={{
              alignSelf: "flex-start",
              px: 1.5,
              py: 1,
              borderRadius: "18px 18px 18px 6px",
              background: isDark
                ? "linear-gradient(130deg, rgba(51,65,85,0.92), rgba(30,41,59,0.92))"
                : "linear-gradient(130deg, rgba(255,255,255,0.97), rgba(241,245,249,0.96))",
              border: `1px solid ${alpha(theme.palette.common.white, isDark ? 0.14 : 0.7)}`,
              boxShadow: isDark
                ? "0 6px 14px rgba(2,6,23,0.3)"
                : "0 6px 14px rgba(15,23,42,0.07)",
            }}
          >
            <Stack direction="row" spacing={0.5} alignItems="center">
              {[0, 1, 2].map((dot) => (
                <Box
                  key={dot}
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    bgcolor: alpha(theme.palette.primary.main, isDark ? 0.85 : 0.7),
                    animation: "dotBounce 1s ease-in-out infinite",
                    animationDelay: `${dot * 0.15}s`,
                    "@keyframes dotBounce": {
                      "0%, 60%, 100%": { transform: "translateY(0)", opacity: 0.45 },
                      "30%": { transform: "translateY(-4px)", opacity: 1 },
                    },
                  }}
                />
              ))}
            </Stack>
          </Box>
        )}
      </Box>

      <Divider />

      {/* input area */}
      <Box sx={{ p: 1.5, flexShrink: 0 }}>
        {chatError && (
          <Typography
            variant="caption"
            color={limitReached ? "text.secondary" : "error"}
            sx={{ display: "block", mb: 1, textAlign: "center" }}
          >
            {chatError}
            {limitReached && (
              <>
                {" "}
                <Box
                  component="span"
                  onClick={() => navigate("/custom-chatbot-builder")}
                  sx={{ cursor: "pointer", textDecoration: "underline", color: "primary.main" }}
                >
                  Create your own chatbot
                </Box>
              </>
            )}
          </Typography>
        )}
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            fullWidth
            size="small"
            placeholder={
              limitReached
                ? "Message limit reached"
                : `Ask ${botInfo?.name ?? "the bot"}…`
            }
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
            disabled={chatSending || limitReached}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "12px",
                fontFamily: CHAT_FONT,
                fontWeight: 600,
                backgroundColor: isDark
                  ? "rgba(15,23,42,0.6)"
                  : "rgba(255,255,255,0.9)",
                "& fieldset": {
                  borderColor: alpha(
                    theme.palette.primary.main,
                    isDark ? 0.4 : 0.22,
                  ),
                },
                "&:hover fieldset": {
                  borderColor: alpha(theme.palette.primary.main, 0.7),
                },
                "&.Mui-focused fieldset": {
                  borderColor: theme.palette.primary.main,
                  borderWidth: 2,
                },
              },
            }}
          />
          <IconButton
            onClick={() => void sendMessage()}
            disabled={chatSending || !chatInput.trim() || limitReached}
            sx={{
              width: 38,
              height: 38,
              color: "#f8fafc",
              background: isDark
                ? "linear-gradient(135deg, #0891b2, #2563eb)"
                : "linear-gradient(135deg, #0ea5e9, #2563eb)",
              border: `1px solid ${alpha(theme.palette.common.white, 0.35)}`,
              boxShadow: "0 6px 14px rgba(2,132,199,0.28)",
              "&:hover": {
                filter: "brightness(1.1)",
                transform: "translateY(-1px)",
              },
              "&.Mui-disabled": {
                color: alpha("#fff", 0.5),
                background: alpha(theme.palette.text.secondary, isDark ? 0.25 : 0.15),
                boxShadow: "none",
              },
            }}
          >
            <SendIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Stack>

        {/* powered-by footer */}
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ display: "block", textAlign: "center", mt: 0.75, fontSize: 10 }}
        >
          Powered by{" "}
          <Box
            component="span"
            onClick={() => navigate("/custom-chatbot-builder")}
            sx={{ cursor: "pointer", "&:hover": { color: "text.secondary" } }}
          >
            Torensa AI
          </Box>
        </Typography>
      </Box>
    </Box>
  );
}
