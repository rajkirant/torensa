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
} from "@mui/material";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
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

export default function ToolChatWidget() {
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
      content: "Hi, I can explain Torensa tools in simple terms. Ask me anything.",
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
            bottom: 92,
            width: { xs: "calc(100vw - 24px)", sm: 360 },
            maxHeight: "70vh",
            zIndex: 1300,
            borderRadius: 2,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box
            sx={{
              px: 1.5,
              py: 1,
              borderBottom: "1px solid",
              borderColor: "divider",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              bgcolor: "background.paper",
            }}
          >
            <Typography variant="subtitle2" fontWeight={700}>
              Tool Assistant
            </Typography>
            <IconButton size="small" onClick={() => setIsOpen(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <Box sx={{ p: 1.25, overflow: "auto", display: "grid", gap: 1 }}>
            {messages.map((message, index) => (
              <Box
                key={`${message.role}-${index}`}
                sx={{
                  alignSelf: message.role === "user" ? "end" : "start",
                  maxWidth: "88%",
                  px: 1.2,
                  py: 0.9,
                  borderRadius: 1.5,
                  bgcolor:
                    message.role === "user"
                      ? "primary.main"
                      : "action.hover",
                  color:
                    message.role === "user"
                      ? "primary.contrastText"
                      : "text.primary",
                  whiteSpace: "pre-wrap",
                  fontSize: 14,
                  lineHeight: 1.45,
                }}
              >
                {message.content}
              </Box>
            ))}

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
                      border: "1px solid",
                      borderColor: "divider",
                      px: 1,
                      py: 0.6,
                      borderRadius: 1,
                      fontSize: 12,
                      cursor: "pointer",
                      color: "text.secondary",
                    }}
                  >
                    {item}
                  </Box>
                ))}
              </Stack>
            )}
          </Box>

          <Box sx={{ p: 1.2, borderTop: "1px solid", borderColor: "divider" }}>
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
              />
              <IconButton
                color="primary"
                onClick={() => void sendMessage(input)}
                disabled={sending || !input.trim()}
              >
                {sending ? (
                  <CircularProgress size={18} />
                ) : (
                  <SendIcon fontSize="small" />
                )}
              </IconButton>
            </Stack>
          </Box>
        </Paper>
      )}

      <IconButton
        color="primary"
        onClick={() => setIsOpen((value) => !value)}
        sx={{
          position: "fixed",
          right: 20,
          bottom: 24,
          zIndex: 1300,
          bgcolor: "primary.main",
          color: "primary.contrastText",
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          "&:hover": { bgcolor: "primary.dark" },
          width: 52,
          height: 52,
        }}
        aria-label="Open tool assistant"
      >
        {isOpen ? <CloseIcon /> : <ChatBubbleOutlineIcon />}
      </IconButton>
    </>
  );
}
