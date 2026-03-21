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
import downloadBlob from "../utils/downloadBlob";

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
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultName, setResultName] = useState<string>("");

  const onFileSelected = (files: FileList | null) => {
    if (!files?.length) return;
    setFile(files[0]);
    setResultBlob(null);
    setError(null);
    setSuccess(null);
  };

  const clearSelection = () => {
    setFile(null);
    setResultBlob(null);
    setResultName("");
    setError(null);
    setSuccess(null);
  };

  const handleConvert = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    setResultBlob(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("format", outputFormat);

      const response = await apiFetch("/api/video-convert/to-audio/", {
        method: "POST",
        body: formData,
        csrf: true,
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
      const baseName = file.name.replace(/\.[^/.]+$/, "") || "audio";
      const outputName = `${baseName}.${outputFormat}`;
      setResultBlob(blob);
      setResultName(outputName);
      setSuccess(`Converted successfully - ${formatBytes(blob.size)}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Conversion failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (resultBlob) downloadBlob(resultBlob, resultName);
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

        {resultBlob && (
          <ActionButton
            onClick={handleDownload}
            startIcon={<DownloadIcon />}
            variant="outlined"
          >
            Download {resultName}
          </ActionButton>
        )}
      </Stack>
    </PageContainer>
  );
}
