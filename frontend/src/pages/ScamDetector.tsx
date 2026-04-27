import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTheme, alpha } from "@mui/material/styles";
import GppMaybeIcon from "@mui/icons-material/GppMaybe";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { apiFetch } from "../utils/api";

type Verdict = "legitimate" | "neutral" | "suspicious" | "likely_scam" | "scam";

interface ScamFeature {
  name: string;
  intensity: number;
  evidence: string;
}

interface ScamResult {
  scam_score: number;
  verdict: Verdict;
  confidence: "low" | "medium" | "high";
  features: ScamFeature[];
  reasoning: string;
  recommended_response: string;
}

const VERDICT_COLOR: Record<Verdict, string> = {
  legitimate: "#16a34a",
  neutral: "#64748b",
  suspicious: "#f59e0b",
  likely_scam: "#ea580c",
  scam: "#dc2626",
};

const VERDICT_LABEL: Record<Verdict, string> = {
  legitimate: "Legitimate",
  neutral: "Neutral",
  suspicious: "Suspicious",
  likely_scam: "Likely Scam",
  scam: "Scam",
};

const EXAMPLES = [
  "This is Officer Davis. Your grandson has been arrested and we need immediate bail payment to release him.",
  "Hi, I'm calling to confirm my appointment for next Monday at 10 AM. Could you check if it's still on the calendar?",
  "Congratulations! You've won a luxury vacation. We just need a small processing fee to release your prize today.",
];

function scoreColor(score: number) {
  if (score >= 81) return VERDICT_COLOR.scam;
  if (score >= 61) return VERDICT_COLOR.likely_scam;
  if (score >= 41) return VERDICT_COLOR.suspicious;
  if (score >= 21) return VERDICT_COLOR.neutral;
  return VERDICT_COLOR.legitimate;
}

function prettyFeature(name: string) {
  return name
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function ScamDetector() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [inputText, setInputText] = useState("");
  const [result, setResult] = useState<ScamResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ success?: string; error?: string }>({});

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const transcribeBlob = async (blob: Blob, filename: string) => {
    setTranscribing(true);
    setStatusMessage({});
    try {
      const form = new FormData();
      form.append("file", blob, filename);
      const response = await apiFetch("/ai/transcribe/", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) {
        setStatusMessage({ error: data.error || "Failed to transcribe audio." });
        return;
      }
      const text = (data.text || "").trim();
      if (!text) {
        setStatusMessage({ error: "No speech detected in the audio." });
        return;
      }
      setInputText((prev) => (prev ? `${prev}\n${text}` : text));
      setStatusMessage({ success: "Audio transcribed. Click Analyze to score it." });
    } catch {
      setStatusMessage({ error: "Network error during transcription." });
    } finally {
      setTranscribing(false);
    }
  };

  const startRecording = async () => {
    if (recording || transcribing || loading) return;
    if (!navigator.mediaDevices || typeof MediaRecorder === "undefined") {
      setStatusMessage({ error: "Audio recording is not supported in this browser." });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        if (blob.size === 0) {
          setStatusMessage({ error: "No audio captured." });
          return;
        }
        const ext = type.includes("webm") ? "webm" : type.includes("mp4") ? "m4a" : "wav";
        await transcribeBlob(blob, `recording.${ext}`);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setStatusMessage({});
    } catch {
      setStatusMessage({ error: "Microphone permission denied or unavailable." });
    }
  };

  const stopRecording = () => {
    if (!recording) return;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    setRecording(false);
  };

  const handleAudioFile = async (file: File | undefined) => {
    if (!file) return;
    await transcribeBlob(file, file.name);
  };

  const handleAnalyze = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setResult(null);
    setStatusMessage({});

    try {
      const response = await apiFetch("/ai/scam-detector/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = await response.json();

      if (!response.ok) {
        setStatusMessage({ error: data.error || "Failed to analyze message. Please try again." });
        return;
      }

      setResult(data as ScamResult);
      setStatusMessage({ success: "Analysis complete." });
    } catch {
      setStatusMessage({ error: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setInputText("");
    setResult(null);
    setStatusMessage({});
  };

  const charCount = inputText.length;

  const verdictColor = result ? VERDICT_COLOR[result.verdict] : "#64748b";

  return (
    <PageContainer>
      <Stack spacing={3}>
        <ToolStatusAlerts success={statusMessage.success} error={statusMessage.error} />

        <Box>
          <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
            <GppMaybeIcon sx={{ color: theme.palette.primary.main }} />
            <Typography variant="h5" fontWeight={800}>
              Scam Message Detector
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Paste text — or click <strong>Record</strong> to speak the message and have it
            transcribed automatically. The tool returns a scam-likelihood score, the
            manipulation tactics it detected (urgency, authority, evasion, etc.), and a
            suggested response.
          </Typography>
        </Box>

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems="stretch"
        >
          {/* ── input panel ──────────────────────────────────────────────── */}
          <Paper
            elevation={2}
            sx={{
              flex: 1,
              p: 2.5,
              borderRadius: "14px",
              border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
            }}
          >
            <Stack spacing={1.5}>
              <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
                Message to analyze
              </Typography>
              <TextField
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                fullWidth
                multiline
                minRows={8}
                maxRows={18}
                placeholder={'e.g. "This is Agent Thompson from the Federal Tax Agency. We\'ve identified a discrepancy that requires immediate payment to avoid legal action."'}
                inputProps={{ maxLength: 4000 }}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
              />
              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                <Typography variant="caption" color="text.secondary">
                  {charCount} / 4000 characters
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      void handleAudioFile(f);
                      e.target.value = "";
                    }}
                  />
                  <Tooltip title="Upload an audio file (mp3, wav, m4a, webm…)">
                    <span>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<UploadFileIcon />}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={recording || transcribing || loading}
                        sx={{ borderRadius: "10px" }}
                      >
                        Audio
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip title={recording ? "Stop recording" : "Record audio from your mic"}>
                    <span>
                      <Button
                        size="small"
                        variant={recording ? "contained" : "outlined"}
                        color={recording ? "error" : "primary"}
                        startIcon={
                          transcribing ? (
                            <CircularProgress size={14} />
                          ) : recording ? (
                            <StopIcon />
                          ) : (
                            <MicIcon />
                          )
                        }
                        onClick={recording ? stopRecording : startRecording}
                        disabled={transcribing || loading}
                        sx={{ borderRadius: "10px", fontWeight: 700 }}
                      >
                        {transcribing ? "Transcribing…" : recording ? "Stop" : "Record"}
                      </Button>
                    </span>
                  </Tooltip>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<DeleteOutlineIcon />}
                    onClick={handleClear}
                    disabled={loading || recording || transcribing || (!inputText && !result)}
                    sx={{ borderRadius: "10px" }}
                  >
                    Clear
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleAnalyze}
                    disabled={loading || recording || transcribing || !inputText.trim()}
                    sx={{ borderRadius: "10px", fontWeight: 700 }}
                  >
                    {loading ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Analyze"}
                  </Button>
                </Stack>
              </Stack>

              <Divider sx={{ my: 1 }} />

              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                Try an example:
              </Typography>
              <Stack spacing={0.75}>
                {EXAMPLES.map((ex, i) => (
                  <Box
                    key={i}
                    onClick={() => !loading && setInputText(ex)}
                    sx={{
                      cursor: loading ? "default" : "pointer",
                      p: 1,
                      borderRadius: "8px",
                      fontSize: 12,
                      color: "text.secondary",
                      border: `1px dashed ${alpha(theme.palette.divider, 0.7)}`,
                      "&:hover": loading
                        ? {}
                        : {
                            borderColor: theme.palette.primary.main,
                            color: "text.primary",
                            background: alpha(theme.palette.primary.main, 0.04),
                          },
                    }}
                  >
                    {ex}
                  </Box>
                ))}
              </Stack>
            </Stack>
          </Paper>

          {/* ── result panel ─────────────────────────────────────────────── */}
          <Paper
            elevation={2}
            sx={{
              flex: 1,
              p: 2.5,
              borderRadius: "14px",
              border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
              minHeight: 300,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {!result && !loading && (
              <Stack flex={1} alignItems="center" justifyContent="center" spacing={1} sx={{ opacity: 0.5 }}>
                <GppMaybeIcon sx={{ fontSize: 48, color: "text.secondary" }} />
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  Submit a message to see the scam analysis here.
                </Typography>
              </Stack>
            )}

            {loading && (
              <Stack flex={1} alignItems="center" justifyContent="center" spacing={1.5}>
                <CircularProgress size={32} />
                <Typography variant="body2" color="text.secondary">
                  Analyzing for scam patterns…
                </Typography>
              </Stack>
            )}

            {result && !loading && (
              <Stack spacing={2}>
                {/* Score */}
                <Box>
                  <Stack direction="row" alignItems="baseline" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      SCAM LIKELIHOOD
                    </Typography>
                    <Chip
                      label={VERDICT_LABEL[result.verdict]}
                      size="small"
                      sx={{
                        fontWeight: 800,
                        bgcolor: alpha(verdictColor, 0.15),
                        color: verdictColor,
                        border: `1px solid ${alpha(verdictColor, 0.4)}`,
                      }}
                    />
                  </Stack>
                  <Stack direction="row" alignItems="baseline" spacing={1} mt={0.5}>
                    <Typography
                      variant="h3"
                      fontWeight={800}
                      sx={{ color: scoreColor(result.scam_score), lineHeight: 1 }}
                    >
                      {result.scam_score}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      / 100 · confidence: {result.confidence}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={result.scam_score}
                    sx={{
                      mt: 1,
                      height: 8,
                      borderRadius: 4,
                      bgcolor: alpha(theme.palette.text.secondary, 0.12),
                      "& .MuiLinearProgress-bar": {
                        borderRadius: 4,
                        backgroundColor: scoreColor(result.scam_score),
                      },
                    }}
                  />
                </Box>

                {/* Features */}
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    DETECTED FEATURES
                  </Typography>
                  {result.features.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      No notable scam features detected.
                    </Typography>
                  ) : (
                    <Stack spacing={1} mt={0.5}>
                      {result.features.map((feat, i) => (
                        <Box
                          key={i}
                          sx={{
                            p: 1,
                            borderRadius: "8px",
                            background: isDark
                              ? alpha(theme.palette.background.paper, 0.6)
                              : alpha(theme.palette.grey[50], 0.95),
                            border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                          }}
                        >
                          <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Typography variant="body2" fontWeight={700}>
                              {prettyFeature(feat.name)}
                            </Typography>
                            <Typography
                              variant="caption"
                              fontWeight={700}
                              sx={{ color: scoreColor(feat.intensity) }}
                            >
                              {feat.intensity}%
                            </Typography>
                          </Stack>
                          <LinearProgress
                            variant="determinate"
                            value={feat.intensity}
                            sx={{
                              mt: 0.5,
                              height: 4,
                              borderRadius: 2,
                              bgcolor: alpha(theme.palette.text.secondary, 0.1),
                              "& .MuiLinearProgress-bar": {
                                borderRadius: 2,
                                backgroundColor: scoreColor(feat.intensity),
                              },
                            }}
                          />
                          {feat.evidence && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: "block", mt: 0.5, fontStyle: "italic" }}
                            >
                              “{feat.evidence}”
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Box>

                {/* Reasoning */}
                {result.reasoning && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      REASONING
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {result.reasoning}
                    </Typography>
                  </Box>
                )}

                {/* Recommended response */}
                {result.recommended_response && (
                  <Box
                    sx={{
                      p: 1.25,
                      borderRadius: "8px",
                      background: alpha(theme.palette.primary.main, 0.08),
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                    }}
                  >
                    <Typography variant="caption" color="primary.main" fontWeight={700}>
                      RECOMMENDED RESPONSE
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {result.recommended_response}
                    </Typography>
                  </Box>
                )}
              </Stack>
            )}
          </Paper>
        </Stack>
      </Stack>
    </PageContainer>
  );
}
