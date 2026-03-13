import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import LinearProgress from "@mui/material/LinearProgress";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { ActionButton } from "../components/buttons/ActionButton";
import FileDropZone from "../components/inputs/FileDropZone";
import { apiFetch } from "../utils/api";
import downloadBlob from "../utils/downloadBlob";

const ACCEPT_TYPES =
  "audio/*,.mp3,.wav,.m4a,.mp4,.flac,.ogg,.webm,.amr,.aac";

const LANGUAGES = [
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "es-US", label: "Spanish (US)" },
  { code: "es-ES", label: "Spanish (Spain)" },
  { code: "fr-FR", label: "French" },
  { code: "de-DE", label: "German" },
  { code: "it-IT", label: "Italian" },
  { code: "pt-BR", label: "Portuguese (Brazil)" },
  { code: "hi-IN", label: "Hindi" },
  { code: "ja-JP", label: "Japanese" },
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function AwsTranscribe() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [language, setLanguage] = useState("en-US");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [copied, setCopied] = useState(false);

  const onFileSelected = (files: FileList | null) => {
    if (!files?.length) return;
    setFile(files[0]);
    setSourceName(files[0].name);
    setTranscript("");
    setError(null);
    setSuccess(null);
  };

  const clearSelection = () => {
    setFile(null);
    setSourceName(null);
    setTranscript("");
    setError(null);
    setSuccess(null);
  };

  const handleTranscribe = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    setTranscript("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("language", language);

      const response = await apiFetch("/ai/transcribe/", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error || "Transcription failed.");
        return;
      }

      const text = data?.text ?? "";
      setTranscript(text);
      setSuccess(
        text
          ? `Transcription complete (${text.length.toLocaleString()} characters).`
          : "Transcription complete, but no text was detected.",
      );
      setFile(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy text to clipboard.");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([transcript], {
      type: "text/plain;charset=utf-8",
    });
    const name = sourceName
      ? sourceName.replace(/\.[^.]+$/, ".txt")
      : "transcript.txt";
    downloadBlob(blob, name);
  };

  return (
    <PageContainer>
      <ToolStatusAlerts error={error ?? ""} success={success ?? ""} />

      <Stack spacing={3} sx={{ maxWidth: 720 }}>
        <Box>
          <FileDropZone
            accept={ACCEPT_TYPES}
            disabled={loading}
            onFilesSelected={onFileSelected}
            onClear={clearSelection}
            clearDisabled={loading || !file}
            fileType="audio"
            label={
              file ? file.name : "Drag & drop an audio file, or tap to browse"
            }
          />
          {file && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 0.5, display: "block" }}
            >
              {file.name} &bull; {formatBytes(file.size)}
            </Typography>
          )}
        </Box>

        <TextField
          select
          label="Language"
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          sx={{ maxWidth: 280 }}
          SelectProps={{ native: true }}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </TextField>

        <ActionButton
          onClick={handleTranscribe}
          disabled={!file || loading}
          loading={loading}
          startIcon={<RecordVoiceOverIcon />}
        >
          Transcribe Audio
        </ActionButton>

        {loading && (
          <Box>
            <LinearProgress />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              Transcribing audio. Longer files may take a few minutes.
            </Typography>
          </Box>
        )}

        {transcript && (
          <>
            <TextField
              multiline
              minRows={8}
              maxRows={24}
              fullWidth
              value={transcript}
              slotProps={{ input: { readOnly: true } }}
              label="Transcript"
            />

            <Stack direction="row" spacing={2}>
              <ActionButton
                onClick={handleCopy}
                startIcon={<ContentCopyIcon />}
                variant="outlined"
              >
                {copied ? "Copied!" : "Copy Text"}
              </ActionButton>
              <ActionButton
                onClick={handleDownload}
                startIcon={<DownloadIcon />}
                variant="outlined"
              >
                Download .txt
              </ActionButton>
            </Stack>
          </>
        )}
      </Stack>
    </PageContainer>
  );
}
