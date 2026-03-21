import { useState, useRef, useCallback } from "react";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Button from "@mui/material/Button";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import AlbumIcon from "@mui/icons-material/Album";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import DownloadIcon from "@mui/icons-material/Download";
import { useTheme } from "@mui/material/styles";
import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { TransparentButton } from "../components/buttons/TransparentButton";
import useToolStatus from "../hooks/useToolStatus";
import { apiFetch } from "../utils/api";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface SongResult {
  match: boolean;
  title?: string;
  artists?: string;
  album?: string;
  genre?: string;
  release_date?: string;
  label?: string;
  cover_art?: string;
  preview_url?: string;
  links?: Record<string, string>;
  message?: string;
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

async function blobToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext({ sampleRate: 44100 });
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  await audioCtx.close();

  // Downmix to mono
  const numSamples = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;
  const mono = new Float32Array(numSamples);
  const channels = audioBuffer.numberOfChannels;
  for (let ch = 0; ch < channels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < numSamples; i++) {
      mono[i] += channelData[i] / channels;
    }
  }

  // Convert to 16-bit PCM
  const pcm = new Int16Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, mono[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  // Build WAV file
  const wavBuffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(wavBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, pcm.length * 2, true);

  const pcmBytes = new Uint8Array(wavBuffer, 44);
  const pcmView = new Uint8Array(pcm.buffer);
  pcmBytes.set(pcmView);

  return new Blob([wavBuffer], { type: "audio/wav" });
}

// ═══════════════════════════════════════════════════════════════
// Platform config
// ═══════════════════════════════════════════════════════════════

const PLATFORM_CONFIG: Record<string, { label: string; color: string }> = {
  spotify: { label: "Spotify", color: "#1DB954" },
  youtube_music: { label: "YouTube Music", color: "#FF0000" },
  apple_music: { label: "Apple Music", color: "#FA243C" },
  youtube: { label: "YouTube", color: "#FF0000" },
  amazon_music: { label: "Amazon Music", color: "#25D1DA" },
  deezer: { label: "Deezer", color: "#A238FF" },
  shazam: { label: "Shazam", color: "#0088FF" },
};

// ═══════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════

export default function SongIdentifier() {
  const theme = useTheme();
  const [listening, setListening] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [result, setResult] = useState<SongResult | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { error, success, info, setError, setSuccess, setInfo } =
    useToolStatus();

  const clearAlerts = () => {
    setError();
    setSuccess();
    setInfo();
  };

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    setListening(false);
    setElapsed(0);
  }, []);

  const identifySong = useCallback(
    async (audioBlob: Blob) => {
      setIdentifying(true);
      clearAlerts();
      try {
        // Convert to WAV format (Shazam only accepts wav/ogg/mp3)
        const wavBlob = await blobToWav(audioBlob);
        const formData = new FormData();
        formData.append("audio", wavBlob, "recording.wav");

        const response = await apiFetch("/api/song-identify/", {
          method: "POST",
          body: formData,
        });

        const data: SongResult = await response.json();

        if (!response.ok) {
          setError((data as any).error || "Identification failed.");
          setResult(null);
          return;
        }

        setResult(data);
        if (data.match) {
          setSuccess(`Found: ${data.title} by ${data.artists}`);
        } else {
          setInfo(data.message || "No match found. Try again with a clearer audio source.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Identification failed.");
        setResult(null);
      } finally {
        setIdentifying(false);
      }
    },
    [setError, setSuccess, setInfo],
  );

  const startListening = useCallback(async () => {
    clearAlerts();
    setResult(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Your browser does not support microphone access.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      // Pick a supported MIME type (Shazam accepts wav, ogg, mp3)
      const mimeType = MediaRecorder.isTypeSupported("audio/ogg; codecs=opus")
        ? "audio/ogg; codecs=opus"
        : MediaRecorder.isTypeSupported("audio/ogg")
          ? "audio/ogg"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "";

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blobType = mediaRecorder.mimeType || "audio/ogg";
        const audioBlob = new Blob(chunksRef.current, { type: blobType });
        if (audioBlob.size > 0) {
          identifySong(audioBlob);
        }
      };

      mediaRecorder.start(1000); // collect data every second
      setListening(true);
      setElapsed(0);

      // Elapsed timer
      const start = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - start) / 1000));
      }, 500);

      // Auto-stop after 10 seconds for optimal recognition
      autoStopRef.current = setTimeout(() => {
        stopListening();
      }, 10000);
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setError("Microphone access denied. Please allow microphone access in your browser settings.");
      } else {
        setError("Could not access microphone. Please check your device.");
      }
    }
  }, [identifySong]);

  const stopListening = useCallback(() => {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
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
    setListening(false);
    setElapsed(0);
  }, []);

  const handleReset = () => {
    cleanup();
    clearAlerts();
    setResult(null);
    setIdentifying(false);
  };

  const pulseAnimation = listening
    ? {
        animation: "pulse 1.5s ease-in-out infinite",
        "@keyframes pulse": {
          "0%": { boxShadow: `0 0 0 0 ${theme.palette.error.main}88` },
          "70%": { boxShadow: `0 0 0 20px ${theme.palette.error.main}00` },
          "100%": { boxShadow: `0 0 0 0 ${theme.palette.error.main}00` },
        },
      }
    : {};

  return (
    <PageContainer maxWidth={800}>
      <Stack spacing={3} alignItems="center">
        <ToolStatusAlerts error={error} success={success} info={info} />

        {/* Mic Button */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            py: 3,
          }}
        >
          <IconButton
            onClick={listening ? stopListening : startListening}
            disabled={identifying}
            sx={{
              width: 120,
              height: 120,
              bgcolor: listening
                ? theme.palette.error.main
                : theme.palette.primary.main,
              color: "#fff",
              "&:hover": {
                bgcolor: listening
                  ? theme.palette.error.dark
                  : theme.palette.primary.dark,
              },
              "&:disabled": {
                bgcolor: theme.palette.action.disabledBackground,
                color: theme.palette.action.disabled,
              },
              transition: "all 0.3s ease",
              ...pulseAnimation,
            }}
          >
            {identifying ? (
              <CircularProgress size={48} sx={{ color: "#fff" }} />
            ) : listening ? (
              <StopIcon sx={{ fontSize: 48 }} />
            ) : (
              <MicIcon sx={{ fontSize: 48 }} />
            )}
          </IconButton>

          <Typography
            variant="h6"
            color="text.secondary"
            sx={{ textAlign: "center" }}
          >
            {identifying
              ? "Identifying song..."
              : listening
                ? `Listening... ${elapsed}s`
                : "Tap to start listening"}
          </Typography>

          {listening && (
            <Typography variant="body2" color="text.secondary">
              Auto-stops after 10 seconds. Tap to stop earlier.
            </Typography>
          )}

          {!listening && !identifying && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textAlign: "center", maxWidth: 400 }}
            >
              Play a song near your microphone and tap the button to identify it.
            </Typography>
          )}
        </Box>

        {/* Result Card */}
        {result?.match && (
          <Card
            variant="outlined"
            sx={{
              width: "100%",
              borderColor: theme.palette.primary.main,
              borderWidth: 2,
            }}
          >
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={2} alignItems="center">
                  {result.cover_art ? (
                    <Box
                      component="img"
                      src={result.cover_art}
                      alt={result.title}
                      sx={{
                        width: 80,
                        height: 80,
                        borderRadius: 2,
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <AlbumIcon
                      sx={{
                        fontSize: 56,
                        color: theme.palette.primary.main,
                      }}
                    />
                  )}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="h5" noWrap>
                      {result.title}
                    </Typography>
                    <Typography variant="subtitle1" color="text.secondary" noWrap>
                      {result.artists}
                    </Typography>
                  </Box>
                </Stack>

                <Stack
                  direction="row"
                  spacing={1}
                  flexWrap="wrap"
                  useFlexGap
                >
                  {result.album && (
                    <Chip
                      icon={<MusicNoteIcon />}
                      label={result.album}
                      variant="outlined"
                      size="small"
                    />
                  )}
                  {result.genre && (
                    <Chip label={result.genre} variant="outlined" size="small" />
                  )}
                  {result.release_date && (
                    <Chip
                      label={result.release_date}
                      variant="outlined"
                      size="small"
                    />
                  )}
                  {result.label && (
                    <Chip
                      label={result.label}
                      variant="outlined"
                      size="small"
                    />
                  )}
                </Stack>

                {/* Preview Player & Download */}
                {result.preview_url && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Preview (~1:30)
                    </Typography>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box
                        component="audio"
                        controls
                        src={result.preview_url}
                        sx={{ flex: 1, height: 40 }}
                      />
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<DownloadIcon />}
                        onClick={async () => {
                          try {
                            const filename = `${result.title} - ${result.artists} (preview).m4a`;
                            const params = new URLSearchParams({
                              url: result.preview_url!,
                              filename,
                            });
                            const resp = await apiFetch(
                              `/api/song-identify/download/?${params.toString()}`,
                              { method: "GET", csrf: false },
                            );
                            if (!resp.ok) throw new Error("Download failed");
                            const blob = await resp.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = filename;
                            a.click();
                            URL.revokeObjectURL(url);
                          } catch {
                            setError("Failed to download preview.");
                          }
                        }}
                        sx={{ textTransform: "none", fontWeight: 600, whiteSpace: "nowrap" }}
                      >
                        Download Preview
                      </Button>
                    </Stack>
                  </Box>
                )}

                {/* Streaming Links */}
                {result.links &&
                  Object.keys(result.links).length > 0 && (
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Listen on
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {Object.entries(result.links).map(([name, url]) => {
                          const platform = PLATFORM_CONFIG[name];
                          if (!platform) return null;
                          return (
                            <Button
                              key={name}
                              variant="contained"
                              size="small"
                              endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                              onClick={() => window.open(url, "_blank")}
                              sx={{
                                bgcolor: platform.color,
                                color: "#fff",
                                textTransform: "none",
                                fontWeight: 600,
                                fontSize: 13,
                                px: 2,
                                "&:hover": {
                                  bgcolor: platform.color,
                                  filter: "brightness(0.85)",
                                },
                              }}
                            >
                              {platform.label}
                            </Button>
                          );
                        })}
                      </Stack>
                    </Box>
                  )}
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Reset */}
        {(result || identifying) && !listening && (
          <TransparentButton label="Reset" onClick={handleReset} />
        )}
      </Stack>
    </PageContainer>
  );
}
