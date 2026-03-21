import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import DownloadIcon from "@mui/icons-material/Download";
import AudiotrackIcon from "@mui/icons-material/Audiotrack";
import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { ActionButton } from "../components/buttons/ActionButton";
import FileDropZone from "../components/inputs/FileDropZone";
import { apiFetch } from "../utils/api";

const ACCEPT_TYPES =
  "video/*,.mp4,.mov,.mkv,.webm,.avi,.m4v,.mpg,.mpeg,.3gp,.wmv,.flv,.ogv";

type OutputFormat = "mp3" | "wav";

const formatLabel: Record<OutputFormat, string> = {
  mp3: "MP3 (small, compatible)",
  wav: "WAV (lossless, larger)",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function VideoToAudio() {
  const [file, setFile] = useState<File | null>(null);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("mp3");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string>("");
  const [resultName, setResultName] = useState<string>("");
  const [resultSize, setResultSize] = useState<number | null>(null);

  const onFileSelected = (files: FileList | null) => {
    if (!files?.length) return;
    setFile(files[0]);
    setDownloadUrl("");
    setResultSize(null);
    setError(null);
    setSuccess(null);
  };

  const clearSelection = () => {
    setFile(null);
    setDownloadUrl("");
    setResultName("");
    setResultSize(null);
    setError(null);
    setSuccess(null);
  };

  const handleConvert = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    setDownloadUrl("");
    setResultSize(null);

    try {
      const initResponse = await apiFetch("/api/video-convert/upload/init/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });

      if (!initResponse.ok) {
        let msg = `Server error (${initResponse.status})`;
        try {
          const data = await initResponse.json();
          msg = data?.error || msg;
        } catch {
          // ignore JSON parse error
        }
        throw new Error(msg);
      }

      const initPayload = await initResponse.json();
      const uploadUrl = initPayload?.uploadUrl as string;
      const objectKey = initPayload?.objectKey as string;
      if (!uploadUrl || !objectKey) {
        throw new Error("Upload initialization failed. Please try again.");
      }

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed (${uploadResponse.status}).`);
      }

      const convertResponse = await apiFetch("/api/video-convert/from-r2/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectKey, format: outputFormat }),
      });

      if (!convertResponse.ok) {
        let msg = `Server error (${convertResponse.status})`;
        try {
          const data = await convertResponse.json();
          msg = data?.error || msg;
        } catch {
          // ignore JSON parse error
        }
        throw new Error(msg);
      }

      const payload = await convertResponse.json();
      if (!payload?.downloadUrl) {
        throw new Error("Conversion succeeded but no download URL was returned.");
      }

      setDownloadUrl(payload.downloadUrl as string);
      setResultName((payload.filename as string) || "audio");
      setResultSize(
        typeof payload.size === "number" ? payload.size : null,
      );
      const sizeLabel =
        typeof payload.size === "number" ? ` - ${formatBytes(payload.size)}` : "";
      setSuccess(`Converted successfully${sizeLabel}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Conversion failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!downloadUrl) return;
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    if (resultName) anchor.download = resultName;
    anchor.rel = "noopener";
    anchor.target = "_blank";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  return (
    <PageContainer>
      <ToolStatusAlerts error={error} success={success} />

      <Stack spacing={3} sx={{ maxWidth: 560 }}>
        <Box>
          <FileDropZone
            accept={ACCEPT_TYPES}
            disabled={loading}
            onFilesSelected={onFileSelected}
            onClear={clearSelection}
            clearDisabled={loading || !file}
            fileType="video"
            label={file ? file.name : "Drag & drop a video here, or tap to browse"}
          />
          {file && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 0.5, display: "block" }}
            >
              {file.name} • {formatBytes(file.size)}
            </Typography>
          )}
        </Box>

        <FormControl size="small" sx={{ maxWidth: 260 }}>
          <InputLabel id="video-output-format">Output Format</InputLabel>
          <Select
            labelId="video-output-format"
            label="Output Format"
            value={outputFormat}
            onChange={(event) =>
              setOutputFormat(event.target.value as OutputFormat)
            }
          >
            <MenuItem value="mp3">{formatLabel.mp3}</MenuItem>
            <MenuItem value="wav">{formatLabel.wav}</MenuItem>
          </Select>
        </FormControl>

        <ActionButton
          onClick={handleConvert}
          disabled={!file || loading}
          startIcon={<AudiotrackIcon />}
        >
          {loading ? "Extracting…" : "Extract Audio"}
        </ActionButton>

        {loading && (
          <Box>
            <LinearProgress />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              Converting with FFmpeg - this may take a few seconds.
            </Typography>
          </Box>
        )}

        {downloadUrl && (
          <ActionButton
            onClick={handleDownload}
            startIcon={<DownloadIcon />}
            variant="outlined"
          >
            Download {resultName || "audio"}
          </ActionButton>
        )}
      </Stack>
    </PageContainer>
  );
}
