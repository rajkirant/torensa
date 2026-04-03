import { useState, useRef, useCallback } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import IconButton from "@mui/material/IconButton";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import DownloadIcon from "@mui/icons-material/Download";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import Tooltip from "@mui/material/Tooltip";
import { useTheme } from "@mui/material/styles";
import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { ActionButton } from "../components/buttons/ActionButton";
import FileDropZone from "../components/inputs/FileDropZone";
import { apiFetch } from "../utils/api";
import downloadBlob from "../utils/downloadBlob";

const ACCEPT_TYPES =
  "audio/*,.mp3,.wav,.m4a,.mp4,.flac,.ogg,.webm,.amr,.aac";

type OutputFormat = "mp3" | "wav";
type PresetId = "chipmunk" | "deep" | "husky" | "old-lady";

const formatLabel: Record<OutputFormat, string> = {
  mp3: "MP3 (small, compatible)",
  wav: "WAV (lossless, larger)",
};

const presetLabel: Record<PresetId, string> = {
  deep: "Space Captain (deep)",
  chipmunk: "Tiny Alien (chipmunk)",
  husky: "Husky Man",
  "old-lady": "Old Lady",
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

type InputMode = "upload" | "mic";

export default function VoiceChanger() {
  const theme = useTheme();
  const [inputMode, setInputMode] = useState<InputMode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preset, setPreset] = useState<PresetId>("deep");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("mp3");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string>("");
  const [resultName, setResultName] = useState<string>("");
  const [resultSize, setResultSize] = useState<number | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);

  // Mic recording state
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const onFileSelected = (files: FileList | null) => {
    if (!files?.length) return;
    setFile(files[0]);
    setLastName(files[0].name);
    setError(null);
    setSuccess(null);
    setDownloadUrl("");
    setResultName("");
    setResultSize(null);
  };

  const clearSelection = () => {
    setFile(null);
    setLastName(null);
    setError(null);
    setSuccess(null);
    setDownloadUrl("");
    setResultName("");
    setResultSize(null);
    setResultBlob(null);
  };

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setRecording(false);
    setElapsed(0);
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setSuccess(null);
    setDownloadUrl("");
    setResultName("");
    setResultSize(null);
    setFile(null);
    setLastName(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Your browser does not support microphone access.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm; codecs=opus")
        ? "audio/webm; codecs=opus"
        : MediaRecorder.isTypeSupported("audio/ogg; codecs=opus")
          ? "audio/ogg; codecs=opus"
          : "";

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blobType = mediaRecorder.mimeType || "audio/webm";
        const ext = blobType.includes("ogg") ? "ogg" : "webm";
        const audioBlob = new Blob(chunksRef.current, { type: blobType });
        if (audioBlob.size > 0) {
          const recordedFile = new File([audioBlob], `recording.${ext}`, {
            type: blobType,
          });
          setFile(recordedFile);
          setLastName(recordedFile.name);
          setSuccess("Recording saved. Choose a preset and change your voice!");
        }
      };

      mediaRecorder.start(1000);
      setRecording(true);
      setElapsed(0);

      const start = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - start) / 1000));
      }, 500);
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setError(
          "Microphone access denied. Please allow microphone access in your browser settings.",
        );
      } else {
        setError("Could not access microphone. Please check your device.");
      }
    }
  }, []);

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

  const handleShareWhatsApp = async () => {
    if (!resultBlob) {
      setError("No converted audio available to share.");
      return;
    }

    const name = resultName || `voice-${preset}.${outputFormat}`;
    const mimeType = outputFormat === "wav" ? "audio/wav" : "audio/mpeg";

    try {
      // Upload to file share to get a public download link
      const formData = new FormData();
      formData.append("file", new File([resultBlob], name, { type: mimeType }));

      const res = await apiFetch("/api/text-share/file/", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to create share link.");
      }

      const { code } = await res.json();
      const downloadLink = `${window.location.origin}/api/text-share/file/${code}/download/`;
      const toolLink = `${window.location.origin}/voice-changer`;
      const text = `Listen to this! 🎙️\n${downloadLink}\n\nMade with ${toolLink}`;

      window.open(
        `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
        "_blank",
        "noopener,noreferrer",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to share audio.");
    }
  };

  const convertDirect = async () => {
    if (!file) return;
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
    setResultBlob(blob);
    setResultName(outputName);
    downloadBlob(blob, outputName);
    setSuccess("Voice conversion complete. Your download should start now.");
  };

  const handleConvert = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    setDownloadUrl("");
    setResultName("");
    setResultSize(null);
    setResultBlob(null);

    try {
      const initResponse = await apiFetch("/api/voice-change/upload/init/", {
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
        if (initResponse.status === 503 && msg.includes("R2")) {
          await convertDirect();
          return;
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

      const convertResponse = await apiFetch("/api/voice-change/from-r2/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectKey, preset, format: outputFormat }),
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

      const dlUrl = payload.downloadUrl as string;
      setDownloadUrl(dlUrl);
      setResultName((payload.filename as string) || "audio");
      setResultSize(
        typeof payload.size === "number" ? payload.size : null,
      );

      // Fetch the blob so it's available for file sharing
      try {
        const blobResp = await fetch(dlUrl);
        if (blobResp.ok) setResultBlob(await blobResp.blob());
      } catch {
        // Non-critical — share will fall back to link
      }

      const sizeLabel =
        typeof payload.size === "number" ? ` - ${formatBytes(payload.size)}` : "";
      setSuccess(`Converted successfully${sizeLabel}`);
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
        {/* Input mode toggle */}
        <ToggleButtonGroup
          value={inputMode}
          exclusive
          onChange={(_e, val) => {
            if (val) {
              setInputMode(val as InputMode);
              clearSelection();
              if (recording) stopRecording();
            }
          }}
          size="small"
        >
          <ToggleButton value="upload">
            <UploadFileIcon sx={{ mr: 0.5 }} /> Upload File
          </ToggleButton>
          <ToggleButton value="mic">
            <MicIcon sx={{ mr: 0.5 }} /> Record Mic
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Upload mode */}
        {inputMode === "upload" && (
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
        )}

        {/* Mic recording mode */}
        {inputMode === "mic" && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1.5,
              py: 2,
            }}
          >
            <IconButton
              onClick={recording ? stopRecording : startRecording}
              disabled={loading}
              sx={{
                width: 80,
                height: 80,
                bgcolor: recording
                  ? theme.palette.error.main
                  : theme.palette.primary.main,
                color: "#fff",
                "&:hover": {
                  bgcolor: recording
                    ? theme.palette.error.dark
                    : theme.palette.primary.dark,
                },
                "&:disabled": {
                  bgcolor: theme.palette.action.disabledBackground,
                  color: theme.palette.action.disabled,
                },
                transition: "all 0.3s ease",
                ...(recording
                  ? {
                      animation: "mic-pulse 1.5s ease-in-out infinite",
                      "@keyframes mic-pulse": {
                        "0%": { boxShadow: `0 0 0 0 ${theme.palette.error.main}88` },
                        "70%": { boxShadow: `0 0 0 16px ${theme.palette.error.main}00` },
                        "100%": { boxShadow: `0 0 0 0 ${theme.palette.error.main}00` },
                      },
                    }
                  : {}),
              }}
            >
              {recording ? (
                <StopIcon sx={{ fontSize: 36 }} />
              ) : (
                <MicIcon sx={{ fontSize: 36 }} />
              )}
            </IconButton>

            <Typography variant="body2" color="text.secondary">
              {recording
                ? `Recording... ${elapsed}s — tap to stop`
                : file
                  ? `Recording saved (${formatBytes(file.size)})`
                  : "Tap to start recording"}
            </Typography>

            {file && !recording && (
              <ActionButton
                onClick={() => {
                  clearSelection();
                }}
                variant="text"
                size="small"
              >
                Discard & re-record
              </ActionButton>
            )}
          </Box>
        )}

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

        {(downloadUrl || resultBlob) && (
          <Stack direction="row" spacing={1.5} alignItems="center">
            {downloadUrl && (
              <ActionButton
                onClick={handleDownload}
                startIcon={<DownloadIcon />}
                variant="outlined"
              >
                Download {resultName || "audio"}
              </ActionButton>
            )}
            <Tooltip title="Share on WhatsApp">
              <IconButton
                onClick={handleShareWhatsApp}
                size="small"
                sx={{ color: "#25D366" }}
              >
                <WhatsAppIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
      </Stack>
    </PageContainer>
  );
}
