import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import DownloadIcon from "@mui/icons-material/Download";
import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { ActionButton } from "../components/buttons/ActionButton";
import FileDropZone from "../components/inputs/FileDropZone";
import { apiFetch } from "../utils/api";
import downloadBlob from "../utils/downloadBlob";

const ACCEPT_TYPES =
  "audio/*,.mp3,.wav,.m4a,.mp4,.flac,.ogg,.webm,.amr,.aac";

type OutputFormat = "mp3" | "wav";
type PresetId = "chipmunk" | "deep" | "robot" | "radio" | "echo";

const formatLabel: Record<OutputFormat, string> = {
  mp3: "MP3 (small, compatible)",
  wav: "WAV (lossless, larger)",
};

const presetLabel: Record<PresetId, string> = {
  deep: "Space Captain (deep)",
  chipmunk: "Tiny Alien (chipmunk)",
  robot: "Robot",
  radio: "Vintage Radio",
  echo: "Echo Chamber",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function buildOutputName(
  originalName: string | null,
  preset: PresetId,
  format: OutputFormat,
) {
  const fallback = `voice-${preset}.${format}`;
  if (!originalName) return fallback;
  const base = originalName.replace(/\.[^.]+$/, "");
  return `${base}-${preset}.${format}`;
}

export default function VoiceChanger() {
  const [file, setFile] = useState<File | null>(null);
  const [preset, setPreset] = useState<PresetId>("deep");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("mp3");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);

  const onFileSelected = (files: FileList | null) => {
    if (!files?.length) return;
    setFile(files[0]);
    setLastName(files[0].name);
    setError(null);
    setSuccess(null);
  };

  const clearSelection = () => {
    setFile(null);
    setLastName(null);
    setError(null);
    setSuccess(null);
  };

  const handleConvert = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("preset", preset);
      formData.append("format", outputFormat);

      const response = await apiFetch("/api/voice-change/", {
        method: "POST",
        body: formData,
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
      const outputName = buildOutputName(file.name, preset, outputFormat);
      downloadBlob(blob, outputName);
      setSuccess("Voice conversion complete. Your download should start now.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Conversion failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <ToolStatusAlerts error={error ?? ""} success={success ?? ""} />

      <Stack spacing={3} sx={{ maxWidth: 620 }}>
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

        <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="voice-preset">Character Preset</InputLabel>
            <Select
              labelId="voice-preset"
              label="Character Preset"
              value={preset}
              onChange={(event) =>
                setPreset(event.target.value as PresetId)
              }
            >
              {Object.keys(presetLabel).map((key) => (
                <MenuItem key={key} value={key}>
                  {presetLabel[key as PresetId]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="voice-output-format">Output Format</InputLabel>
            <Select
              labelId="voice-output-format"
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
        </Stack>

        <ActionButton
          onClick={handleConvert}
          disabled={!file || loading}
          startIcon={<RecordVoiceOverIcon />}
        >
          {loading ? "Changing Voice..." : "Change Voice"}
        </ActionButton>

        {loading && (
          <Box>
            <LinearProgress />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              Converting with FFmpeg. Larger files may take longer.
            </Typography>
          </Box>
        )}

        {lastName && (
          <Typography variant="caption" color="text.secondary">
            Output name: {buildOutputName(lastName, preset, outputFormat)}
          </Typography>
        )}
      </Stack>
    </PageContainer>
  );
}
