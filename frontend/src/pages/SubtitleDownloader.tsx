import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import LinearProgress from "@mui/material/LinearProgress";
import DownloadIcon from "@mui/icons-material/Download";
import SubtitlesIcon from "@mui/icons-material/Subtitles";
import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { ActionButton } from "../components/buttons/ActionButton";
import { apiFetch } from "../utils/api";
import downloadBlob from "../utils/downloadBlob";

function parseFilename(disposition: string | null) {
  if (!disposition) return "";
  const match = /filename="([^"]+)"/i.exec(disposition);
  return match?.[1] || "";
}

export default function SubtitleDownloader() {
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState("en");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultName, setResultName] = useState<string>("");

  const clearResult = () => {
    setResultBlob(null);
    setResultName("");
  };

  const handleDownload = () => {
    if (resultBlob) downloadBlob(resultBlob, resultName || "subtitles.srt");
  };

  const handleFetch = async () => {
    if (!url.trim()) {
      setError("Please enter a video URL.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    clearResult();

    try {
      const response = await apiFetch("/api/subtitle-download/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), language: language.trim() }),
      });

      if (!response.ok) {
        let msg = `Server error (${response.status})`;
        try {
          const data = await response.json();
          msg = data?.error || msg;
        } catch {
          // ignore JSON parse error
        }
        throw new Error(msg);
      }

      const blob = await response.blob();
      const name =
        parseFilename(response.headers.get("Content-Disposition")) ||
        "subtitles.srt";
      setResultBlob(blob);
      setResultName(name);
      setSuccess("Subtitles ready. Download the SRT file below.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <ToolStatusAlerts error={error} success={success} />

      <Stack spacing={3} sx={{ maxWidth: 640 }}>
        <TextField
          label="Video URL"
          placeholder="https://..."
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          fullWidth
        />

        <TextField
          label="Subtitle Language"
          helperText="Use a language code like en, es, fr. We try existing captions first, then auto-generated."
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          sx={{ maxWidth: 280 }}
        />

        <ActionButton
          onClick={handleFetch}
          disabled={!url.trim() || loading}
          loading={loading}
          startIcon={<SubtitlesIcon />}
        >
          Download Subtitles
        </ActionButton>

        {loading && (
          <Box>
            <LinearProgress />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              Fetching subtitles. This may take a few seconds.
            </Typography>
          </Box>
        )}

        {resultBlob && (
          <ActionButton
            onClick={handleDownload}
            startIcon={<DownloadIcon />}
            variant="outlined"
          >
            Download {resultName || "subtitles.srt"}
          </ActionButton>
        )}
      </Stack>
    </PageContainer>
  );
}
