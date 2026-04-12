import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTheme, alpha } from "@mui/material/styles";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { apiFetch } from "../utils/api";

type Tone = "casual" | "formal" | "conversational" | "academic" | "friendly" | "professional";

const TONES: { value: Tone; label: string; description: string }[] = [
  { value: "casual",         label: "Casual",         description: "Relaxed, everyday language" },
  { value: "conversational", label: "Conversational",  description: "Warm, direct, like talking to someone" },
  { value: "friendly",       label: "Friendly",        description: "Upbeat and approachable" },
  { value: "professional",   label: "Professional",    description: "Polished and confident" },
  { value: "formal",         label: "Formal",          description: "Business or official writing" },
  { value: "academic",       label: "Academic",        description: "Scholarly and precise" },
];

export default function AiHumaniser() {
  const theme = useTheme();
  const [inputText, setInputText] = useState("");
  const [tone, setTone] = useState<Tone>("conversational");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ success?: string; error?: string }>({});

  const handleHumanise = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setResult("");
    setStatusMessage({});

    try {
      const response = await apiFetch("/ai/humanise/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, tone }),
      });
      const data = await response.json();

      if (!response.ok) {
        setStatusMessage({ error: data.error || "Failed to humanise text. Please try again." });
        return;
      }

      setResult(data.result || "");
      setStatusMessage({ success: "Text humanised successfully." });
    } catch {
      setStatusMessage({ error: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  const handleClear = () => {
    setInputText("");
    setResult("");
    setStatusMessage({});
  };

  const wordCount = (text: string) =>
    text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <PageContainer>
      <Stack spacing={3}>
        <ToolStatusAlerts success={statusMessage.success} error={statusMessage.error} />

        {/* Tone selector */}
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 500 }}>
            Tone
          </Typography>
          <ToggleButtonGroup
            value={tone}
            exclusive
            onChange={(_, val) => { if (val) setTone(val); }}
            sx={{ flexWrap: "wrap", gap: 1, "& .MuiToggleButtonGroup-grouped": { border: "1px solid", borderColor: "divider", borderRadius: "8px !important", px: 2, py: 0.75 } }}
          >
            {TONES.map((t) => (
              <Tooltip key={t.value} title={t.description} arrow placement="top">
                <ToggleButton
                  value={t.value}
                  sx={{
                    typography: "body2",
                    fontWeight: 500,
                    textTransform: "none",
                    "&.Mui-selected": {
                      bgcolor: alpha(theme.palette.primary.main, 0.12),
                      color: "primary.main",
                      borderColor: `${theme.palette.primary.main} !important`,
                    },
                  }}
                >
                  {t.label}
                </ToggleButton>
              </Tooltip>
            ))}
          </ToggleButtonGroup>
        </Box>

        {/* Input / Output panels */}
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="stretch">
          {/* Input */}
          <Paper
            variant="outlined"
            sx={{ flex: 1, display: "flex", flexDirection: "column", borderRadius: 2, overflow: "hidden" }}
          >
            <Box sx={{ px: 2, py: 1.25, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: 1, borderColor: "divider" }}>
              <Typography variant="body2" fontWeight={600} color="text.secondary">
                AI-generated text
              </Typography>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Typography variant="caption" color="text.disabled">
                  {wordCount(inputText)} words
                </Typography>
                {inputText && (
                  <Tooltip title="Clear">
                    <IconButton size="small" onClick={handleClear}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            </Box>
            <TextField
              multiline
              fullWidth
              minRows={12}
              maxRows={24}
              placeholder="Paste your AI-generated text here..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              variant="standard"
              InputProps={{ disableUnderline: true, sx: { p: 2, alignItems: "flex-start", fontSize: "0.9rem" } }}
              sx={{ flex: 1 }}
            />
          </Paper>

          {/* Divider with action button */}
          <Stack alignItems="center" justifyContent="center" spacing={1}>
            <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", md: "block" } }} />
            <Button
              variant="contained"
              onClick={handleHumanise}
              disabled={!inputText.trim() || loading}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <AutoFixHighIcon />}
              sx={{ borderRadius: 2, px: 3, py: 1, fontWeight: 600, textTransform: "none", whiteSpace: "nowrap" }}
            >
              {loading ? "Humanising..." : "Humanise"}
            </Button>
            <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", md: "block" } }} />
          </Stack>

          {/* Output */}
          <Paper
            variant="outlined"
            sx={{ flex: 1, display: "flex", flexDirection: "column", borderRadius: 2, overflow: "hidden" }}
          >
            <Box sx={{ px: 2, py: 1.25, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: 1, borderColor: "divider" }}>
              <Typography variant="body2" fontWeight={600} color="text.secondary">
                Humanised text
              </Typography>
              <Stack direction="row" spacing={0.5} alignItems="center">
                {result && (
                  <Typography variant="caption" color="text.disabled">
                    {wordCount(result)} words
                  </Typography>
                )}
                {result && (
                  <Tooltip title={copied ? "Copied!" : "Copy"}>
                    <IconButton size="small" onClick={handleCopy}>
                      {copied
                        ? <CheckCircleIcon fontSize="small" color="success" />
                        : <ContentCopyIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            </Box>
            <Box sx={{ flex: 1, p: 2, minHeight: 200, overflowY: "auto" }}>
              {loading ? (
                <Stack alignItems="center" justifyContent="center" sx={{ height: "100%", minHeight: 200 }}>
                  <CircularProgress size={32} />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                    Rewriting text...
                  </Typography>
                </Stack>
              ) : result ? (
                <Typography
                  variant="body2"
                  sx={{ whiteSpace: "pre-wrap", lineHeight: 1.8, fontSize: "0.9rem" }}
                >
                  {result}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.disabled" sx={{ fontStyle: "italic" }}>
                  Your humanised text will appear here...
                </Typography>
              )}
            </Box>
          </Paper>
        </Stack>
      </Stack>
    </PageContainer>
  );
}
