import React, { useState, useEffect, useRef, useCallback } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTheme, alpha } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import SendIcon from "@mui/icons-material/Send";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { apiFetch } from "../utils/api";
import { useScrollBottom } from "../hooks/useScrollTop";

/* ── types ──────────────────────────────────────────────────────────────── */

interface Chatbot {
  id: number;
  name: string;
  metadata_text: string;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id?: number;
  role: "user" | "assistant";
  content: string;
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

const CHAT_FONT = `"Space Grotesk", "Avenir Next", "Segoe UI", sans-serif`;

/* ── component ───────────────────────────────────────────────────────────── */

export default function CustomChatbotBuilder() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  // ── chatbot list ──────────────────────────────────────────────────────────
  const [bots, setBots] = useState<Chatbot[]>([]);
  const [botsLoading, setBotsLoading] = useState(true);
  const [botsError, setBotsError] = useState("");

  // ── create / edit form ────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [editingBot, setEditingBot] = useState<Chatbot | null>(null);
  const [formName, setFormName] = useState("");
  const [formMeta, setFormMeta] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // ── active chat ───────────────────────────────────────────────────────────
  const [activeBot, setActiveBot] = useState<Chatbot | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState("");

  const messagesEndRef = useScrollBottom<HTMLDivElement>([messages, chatSending]);

  /* ── load bots ─────────────────────────────────────────────────────────── */

  const loadBots = useCallback(async () => {
    setBotsLoading(true);
    setBotsError("");
    try {
      const res = await apiFetch("/api/chatbots/");
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setBotsError(data?.error || "Failed to load chatbots.");
        return;
      }
      const data: Chatbot[] = await res.json();
      setBots(data);
    } catch {
      setBotsError("Network error. Please try again.");
    } finally {
      setBotsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBots();
  }, [loadBots]);

  /* ── create / edit ─────────────────────────────────────────────────────── */

  const openCreate = () => {
    setEditingBot(null);
    setFormName("");
    setFormMeta("");
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (bot: Chatbot) => {
    setEditingBot(bot);
    setFormName(bot.name);
    setFormMeta(bot.metadata_text);
    setFormError("");
    setFormOpen(true);
  };

  const handleSaveBot = async () => {
    const name = formName.trim();
    const metadata_text = formMeta.trim();
    if (!name) { setFormError("Bot name is required."); return; }
    if (!metadata_text) { setFormError("Metadata text is required."); return; }

    setFormSaving(true);
    setFormError("");

    try {
      const url = editingBot ? `/api/chatbots/${editingBot.id}/` : "/api/chatbots/";
      const method = editingBot ? "PUT" : "POST";
      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, metadata_text }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFormError(data?.error || "Failed to save chatbot.");
        return;
      }
      setFormOpen(false);
      // If editing active bot, update its state
      if (editingBot && activeBot?.id === editingBot.id) {
        setActiveBot(data as Chatbot);
      }
      await loadBots();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setFormSaving(false);
    }
  };

  /* ── delete ────────────────────────────────────────────────────────────── */

  const handleDeleteBot = async (bot: Chatbot) => {
    if (!window.confirm(`Delete "${bot.name}"? This will erase all its messages.`)) return;
    try {
      await apiFetch(`/api/chatbots/${bot.id}/`, { method: "DELETE" });
      if (activeBot?.id === bot.id) {
        setActiveBot(null);
        setMessages([]);
      }
      await loadBots();
    } catch {
      // silent
    }
  };

  /* ── open chat ─────────────────────────────────────────────────────────── */

  const openChat = async (bot: Chatbot) => {
    setActiveBot(bot);
    setChatError("");
    setChatInput("");
    setMessagesLoading(true);
    try {
      const res = await apiFetch(`/api/chatbots/${bot.id}/messages/`);
      if (res.ok) {
        const data: ChatMessage[] = await res.json();
        setMessages(data);
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  };

  /* ── clear history ─────────────────────────────────────────────────────── */

  const clearHistory = async () => {
    if (!activeBot) return;
    await apiFetch(`/api/chatbots/${activeBot.id}/messages/`, { method: "DELETE" });
    setMessages([]);
  };

  /* ── send message ──────────────────────────────────────────────────────── */

  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatSending || !activeBot) return;

    setChatError("");
    setChatInput("");
    setChatSending(true);
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    try {
      const res = await apiFetch(`/api/chatbots/${activeBot.id}/chat/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setChatError(data?.error || "Request failed.");
        return;
      }
      const answer = (data?.answer || "").trim() || "No response.";
      setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
    } catch {
      setChatError("Network error. Please try again.");
    } finally {
      setChatSending(false);
    }
  };

  /* ── render ────────────────────────────────────────────────────────────── */

  const panelBg = isDark
    ? "linear-gradient(162deg, rgba(15,23,42,0.96) 0%, rgba(30,41,59,0.92) 100%)"
    : "linear-gradient(162deg, rgba(255,255,255,0.97) 0%, rgba(241,245,249,0.96) 100%)";

  const headerGradient = isDark
    ? "linear-gradient(110deg, #0f766e 0%, #0369a1 58%, #1d4ed8 100%)"
    : "linear-gradient(110deg, #0ea5e9 0%, #6366f1 58%, #8b5cf6 100%)";

  return (
    <PageContainer>
      <Stack spacing={3}>
        {/* ── page header ─────────────────────────────────────────────────── */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Box>
            <Typography variant="h5" fontWeight={800} sx={{ fontFamily: CHAT_FONT }}>
              Custom Chatbot Builder
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              Paste any text metadata below — product FAQs, docs, policies — and get an instant AI chatbot.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreate}
            sx={{
              borderRadius: "12px",
              fontWeight: 700,
              background: headerGradient,
              boxShadow: "0 8px 20px rgba(14,165,233,0.28)",
              "&:hover": { filter: "saturate(1.1)" },
            }}
          >
            New Chatbot
          </Button>
        </Stack>

        {/* ── create / edit form ──────────────────────────────────────────── */}
        {formOpen && (
          <Paper
            elevation={4}
            sx={{
              p: 3,
              borderRadius: "16px",
              background: panelBg,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            }}
          >
            <Typography variant="subtitle1" fontWeight={700} mb={2} sx={{ fontFamily: CHAT_FONT }}>
              {editingBot ? `Edit "${editingBot.name}"` : "Create a new chatbot"}
            </Typography>

            <Stack spacing={2}>
              <TextField
                label="Bot name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                fullWidth
                size="small"
                placeholder="e.g. Product Support Bot"
                inputProps={{ maxLength: 200 }}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
              />

              <TextField
                label="Metadata (plain text)"
                value={formMeta}
                onChange={(e) => setFormMeta(e.target.value)}
                fullWidth
                multiline
                minRows={6}
                maxRows={16}
                placeholder={`Paste your knowledge base here in plain text.\n\nExamples:\n- Product FAQs\n- Company policies\n- Documentation\n- Instructions\n- Any structured or unstructured text`}
                inputProps={{ maxLength: 8000 }}
                helperText={`${formMeta.length} / 8000 characters`}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px", fontFamily: "monospace", fontSize: 13 } }}
              />

              {formError && (
                <ToolStatusAlerts error={formError} />
              )}

              <Stack direction="row" spacing={1.5} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  onClick={() => setFormOpen(false)}
                  disabled={formSaving}
                  sx={{ borderRadius: "10px" }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSaveBot}
                  disabled={formSaving}
                  sx={{
                    borderRadius: "10px",
                    fontWeight: 700,
                    background: headerGradient,
                    "&:hover": { filter: "saturate(1.1)" },
                  }}
                >
                  {formSaving ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : editingBot ? "Save changes" : "Create chatbot"}
                </Button>
              </Stack>
            </Stack>
          </Paper>
        )}

        {/* ── main area: list + chat side by side ─────────────────────────── */}
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems="stretch"
          sx={{ minHeight: 520 }}
        >
          {/* ── bot list ─────────────────────────────────────────────────── */}
          <Paper
            elevation={3}
            sx={{
              width: { xs: "100%", md: 280 },
              flexShrink: 0,
              borderRadius: "16px",
              background: panelBg,
              border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 1.5,
                background: headerGradient,
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <SmartToyOutlinedIcon sx={{ color: "#fff", fontSize: 18 }} />
              <Typography variant="subtitle2" fontWeight={800} color="#fff" sx={{ fontFamily: CHAT_FONT }}>
                My Chatbots
              </Typography>
            </Box>

            <Box sx={{ flex: 1, overflowY: "auto", p: 1 }}>
              {botsLoading && (
                <Stack alignItems="center" justifyContent="center" py={4}>
                  <CircularProgress size={28} />
                </Stack>
              )}
              {!botsLoading && botsError && (
                <Box p={2}><ToolStatusAlerts error={botsError} /></Box>
              )}
              {!botsLoading && !botsError && bots.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
                  No chatbots yet. Create one to get started.
                </Typography>
              )}
              {bots.map((bot) => {
                const isActive = activeBot?.id === bot.id;
                return (
                  <Box
                    key={bot.id}
                    onClick={() => void openChat(bot)}
                    sx={{
                      p: 1.25,
                      mb: 0.5,
                      borderRadius: "10px",
                      cursor: "pointer",
                      background: isActive
                        ? alpha(theme.palette.primary.main, isDark ? 0.25 : 0.12)
                        : "transparent",
                      border: `1px solid ${isActive ? alpha(theme.palette.primary.main, 0.45) : "transparent"}`,
                      "&:hover": {
                        background: isActive
                          ? alpha(theme.palette.primary.main, isDark ? 0.3 : 0.15)
                          : alpha(theme.palette.action.hover, 1),
                      },
                    }}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Stack direction="row" alignItems="center" spacing={1} minWidth={0}>
                        <ChatBubbleOutlineIcon
                          sx={{ fontSize: 16, color: isActive ? theme.palette.primary.main : "text.secondary", flexShrink: 0 }}
                        />
                        <Typography
                          variant="body2"
                          fontWeight={isActive ? 700 : 500}
                          noWrap
                          sx={{ color: isActive ? theme.palette.primary.main : "text.primary" }}
                        >
                          {bot.name}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0}>
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); openEdit(bot); }}
                          sx={{ opacity: 0.6, "&:hover": { opacity: 1 } }}
                        >
                          <EditIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); void handleDeleteBot(bot); }}
                          sx={{ opacity: 0.6, "&:hover": { opacity: 1, color: "error.main" } }}
                        >
                          <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Stack>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ pl: 3.2, display: "block" }}>
                      {bot.metadata_text.length} chars of context
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Paper>

          {/* ── chat panel ───────────────────────────────────────────────── */}
          <Paper
            elevation={3}
            sx={{
              flex: 1,
              borderRadius: "16px",
              background: panelBg,
              border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              minHeight: { xs: 400, md: "auto" },
            }}
          >
            {!activeBot ? (
              /* empty state */
              <Stack
                flex={1}
                alignItems="center"
                justifyContent="center"
                spacing={2}
                sx={{ p: 4, opacity: 0.6 }}
              >
                <SmartToyOutlinedIcon sx={{ fontSize: 56, color: "text.secondary" }} />
                <Typography variant="body1" color="text.secondary" textAlign="center">
                  Select a chatbot from the list to start chatting,<br />
                  or create a new one with your text metadata.
                </Typography>
              </Stack>
            ) : (
              <>
                {/* chat header */}
                <Box
                  sx={{
                    px: 2,
                    py: 1.25,
                    background: headerGradient,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <SmartToyOutlinedIcon sx={{ color: "rgba(255,255,255,0.9)", fontSize: 18 }} />
                    <Box>
                      <Typography variant="subtitle2" fontWeight={800} color="#fff" sx={{ fontFamily: CHAT_FONT }}>
                        {activeBot.name}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.78)" }}>
                        {activeBot.metadata_text.length} chars · powered by AWS Bedrock
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={0.5}>
                    <IconButton
                      size="small"
                      onClick={() => void clearHistory()}
                      title="Clear conversation"
                      sx={{ color: "rgba(255,255,255,0.85)", "&:hover": { color: "#fff" } }}
                    >
                      <RefreshIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => openEdit(activeBot)}
                      title="Edit metadata"
                      sx={{ color: "rgba(255,255,255,0.85)", "&:hover": { color: "#fff" } }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Box>

                {/* messages */}
                <Box
                  ref={messagesEndRef}
                  sx={{
                    flex: 1,
                    overflowY: "auto",
                    p: 1.5,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    "&::-webkit-scrollbar": { width: 6 },
                    "&::-webkit-scrollbar-thumb": {
                      borderRadius: "6px",
                      background: alpha(theme.palette.primary.main, isDark ? 0.5 : 0.3),
                    },
                  }}
                >
                  {messagesLoading && (
                    <Stack alignItems="center" py={4}>
                      <CircularProgress size={24} />
                    </Stack>
                  )}

                  {!messagesLoading && messages.length === 0 && (
                    <Box
                      sx={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Typography variant="body2" color="text.secondary" textAlign="center">
                        Ask me anything about "{activeBot.name}"
                      </Typography>
                    </Box>
                  )}

                  {messages.map((msg, i) => (
                    <Box
                      key={msg.id ?? i}
                      sx={{
                        alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                        maxWidth: "82%",
                        px: 1.4,
                        py: 1,
                        borderRadius: msg.role === "user"
                          ? "18px 18px 6px 18px"
                          : "18px 18px 18px 6px",
                        background: msg.role === "user"
                          ? isDark
                            ? "linear-gradient(130deg, #2563eb, #0891b2)"
                            : "linear-gradient(130deg, #2563eb, #0ea5e9)"
                          : isDark
                            ? "linear-gradient(130deg, rgba(51,65,85,0.92), rgba(30,41,59,0.92))"
                            : "linear-gradient(130deg, rgba(255,255,255,0.97), rgba(241,245,249,0.96))",
                        color: msg.role === "user" ? "#f8fafc" : theme.palette.text.primary,
                        border: msg.role === "assistant"
                          ? `1px solid ${alpha(theme.palette.common.white, isDark ? 0.14 : 0.7)}`
                          : "none",
                        boxShadow: msg.role === "user"
                          ? "0 8px 18px rgba(2,132,199,0.25)"
                          : isDark
                            ? "0 6px 14px rgba(2,6,23,0.3)"
                            : "0 6px 14px rgba(15,23,42,0.07)",
                        whiteSpace: "pre-wrap",
                        fontSize: 14,
                        lineHeight: 1.5,
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
                        px: 1.4,
                        py: 0.9,
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

                {/* input */}
                <Box sx={{ p: 1.25 }}>
                  {chatError && <ToolStatusAlerts error={chatError} />}
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      fullWidth
                      size="small"
                      placeholder={`Ask ${activeBot.name}…`}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void sendMessage();
                        }
                      }}
                      disabled={chatSending}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: "12px",
                          fontFamily: CHAT_FONT,
                          fontWeight: 600,
                          backgroundColor: isDark ? "rgba(15,23,42,0.6)" : "rgba(255,255,255,0.9)",
                          "& fieldset": { borderColor: alpha(theme.palette.primary.main, isDark ? 0.4 : 0.22) },
                          "&:hover fieldset": { borderColor: alpha(theme.palette.primary.main, 0.7) },
                          "&.Mui-focused fieldset": { borderColor: theme.palette.primary.main, borderWidth: 2 },
                        },
                      }}
                    />
                    <IconButton
                      onClick={() => void sendMessage()}
                      disabled={chatSending || !chatInput.trim()}
                      sx={{
                        width: 38,
                        height: 38,
                        color: "#f8fafc",
                        background: isDark
                          ? "linear-gradient(135deg, #0891b2, #2563eb)"
                          : "linear-gradient(135deg, #0ea5e9, #2563eb)",
                        border: `1px solid ${alpha(theme.palette.common.white, 0.35)}`,
                        boxShadow: "0 6px 14px rgba(2,132,199,0.28)",
                        "&:hover": { filter: "brightness(1.1)", transform: "translateY(-1px)" },
                        "&.Mui-disabled": {
                          color: alpha("#fff", 0.65),
                          background: alpha(theme.palette.text.secondary, isDark ? 0.2 : 0.18),
                          boxShadow: "none",
                        },
                      }}
                    >
                      {chatSending
                        ? <CircularProgress size={16} sx={{ color: "#f8fafc" }} />
                        : <SendIcon fontSize="small" />
                      }
                    </IconButton>
                  </Stack>
                </Box>
              </>
            )}
          </Paper>
        </Stack>
      </Stack>
    </PageContainer>
  );
}
