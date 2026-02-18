import { useCallback, useRef, useState } from "react";
import { FFmpeg, type LogEvent, type ProgressEvent } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import classWorkerURL from "@ffmpeg/ffmpeg/worker?url";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { ActionButton } from "../components/buttons/ActionButton";
import FilePickerButton from "../components/inputs/FilePickerButton";
import PageContainer from "../components/PageContainer";

const MAX_INPUT_BYTES = 200 * 1024 * 1024;
const EXEC_TIMEOUT_MS = 12 * 60 * 1000;
const baseURL = import.meta.env.BASE_URL || "/";

function withBaseUrl(path: string) {
  const normalizedBase = baseURL.endsWith("/") ? baseURL : `${baseURL}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${normalizedBase}${normalizedPath}`;
}

const LOCAL_CORE_SOURCE = {
  label: "local",
  coreURL: withBaseUrl("vendor/ffmpeg/ffmpeg-core.esm.js"),
  wasmURL: withBaseUrl("vendor/ffmpeg/ffmpeg-core.wasm"),
  useBlobURL: true,
} as const;

const CDN_CORE_SOURCES = [
  "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm",
  "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm",
].map((baseURL) => ({
  label: baseURL,
  coreURL: `${baseURL}/ffmpeg-core.js`,
  wasmURL: `${baseURL}/ffmpeg-core.wasm`,
  useBlobURL: true,
}));

const CORE_SOURCES = [LOCAL_CORE_SOURCE, ...CDN_CORE_SOURCES] as const;

const FPS_OPTIONS = [8, 10, 12, 15, 20] as const;
const WIDTH_OPTIONS = [240, 320, 480, 640] as const;
const COLOR_OPTIONS = [32, 48, 64, 96, 128, 256] as const;

type GifFps = (typeof FPS_OPTIONS)[number];
type GifWidth = (typeof WIDTH_OPTIONS)[number];
type GifColors = (typeof COLOR_OPTIONS)[number];

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(fileName: string): string | null {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex < 0 || dotIndex === fileName.length - 1) return null;
  return fileName.slice(dotIndex + 1).toLowerCase();
}

function sanitizeExtension(ext: string | null): string {
  const safe = (ext ?? "").replace(/[^a-z0-9]/g, "");
  return safe || "mp4";
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function runGifConversion(
  ffmpeg: FFmpeg,
  inputName: string,
  outputName: string,
  paletteName: string,
  fps: GifFps,
  width: GifWidth,
  colors: GifColors,
  startSeconds: number,
  durationSeconds: number,
  timeoutMs: number,
): Promise<number> {
  const scaleFilter = `fps=${fps},scale=${width}:-1:flags=lanczos`;
  const trimArgs = [
    "-ss",
    startSeconds.toString(),
    "-t",
    durationSeconds.toString(),
  ];

  const paletteExitCode = await ffmpeg.exec(
    [
      ...trimArgs,
      "-i",
      inputName,
      "-vf",
      `${scaleFilter},palettegen=max_colors=${colors}:stats_mode=diff`,
      paletteName,
    ],
    timeoutMs,
  );
  if (paletteExitCode === 0) {
    const gifExitCode = await ffmpeg.exec(
      [
        ...trimArgs,
        "-i",
        inputName,
        "-i",
        paletteName,
        "-lavfi",
        `${scaleFilter}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5`,
        "-loop",
        "0",
        outputName,
      ],
      timeoutMs,
    );
    if (gifExitCode === 0) return 0;
  }

  return ffmpeg.exec(
    [...trimArgs, "-i", inputName, "-vf", scaleFilter, "-loop", "0", outputName],
    timeoutMs,
  );
}

export default function VideoToGifConverter() {
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const listenersAttachedRef = useRef(false);
  const lastLogRef = useRef("");

  const [file, setFile] = useState<File | null>(null);
  const [fps, setFps] = useState<GifFps>(10);
  const [width, setWidth] = useState<GifWidth>(320);
  const [colors, setColors] = useState<GifColors>(64);
  const [startSeconds, setStartSeconds] = useState("0");
  const [durationSeconds, setDurationSeconds] = useState("6");
  const [loadingCore, setLoadingCore] = useState(false);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleLog = useCallback((event: LogEvent) => {
    const message = (event.message || "").trim();
    if (message) {
      lastLogRef.current = message;
    }
  }, []);

  const handleProgress = useCallback((event: ProgressEvent) => {
    const normalized = Number.isFinite(event.progress)
      ? Math.max(0, Math.min(1, event.progress))
      : 0;
    setProgress(Math.round(normalized * 100));
  }, []);

  const ensureReady = useCallback(async () => {
    let ffmpeg = ffmpegRef.current;
    if (!ffmpeg) {
      ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;
    }

    if (!listenersAttachedRef.current) {
      ffmpeg.on("log", handleLog);
      ffmpeg.on("progress", handleProgress);
      listenersAttachedRef.current = true;
    }

    if (!ffmpeg.loaded) {
      setLoadingCore(true);
      try {
        const loadErrors: string[] = [];
        for (const source of CORE_SOURCES) {
          try {
            let coreURL = source.coreURL;
            let wasmURL = source.wasmURL;

            if (source.useBlobURL) {
              [coreURL, wasmURL] = await Promise.all([
                toBlobURL(source.coreURL, "text/javascript"),
                toBlobURL(source.wasmURL, "application/wasm"),
              ]);
            }

            await ffmpeg.load({
              classWorkerURL,
              coreURL,
              wasmURL,
            });
            return ffmpeg;
          } catch (err) {
            const details = err instanceof Error ? err.message : String(err);
            loadErrors.push(`${source.label}: ${details}`);
          }
        }

        throw new Error(
          `Failed to load FFmpeg core. ${loadErrors.join(" | ")}`,
        );
      } finally {
        setLoadingCore(false);
      }
    }

    return ffmpeg;
  }, [handleLog, handleProgress]);

  const handleFileChange = (files: FileList | null) => {
    if (!files?.length) return;
    setFile(files[0]);
    setError(null);
    setSuccess(null);
  };

  const handleConvert = async () => {
    if (!file) {
      setError("Please select a video file first.");
      return;
    }

    if (file.size > MAX_INPUT_BYTES) {
      setError(
        `Input file is too large (${formatBytes(file.size)}). Max supported size is ${formatBytes(MAX_INPUT_BYTES)}.`,
      );
      return;
    }

    const parsedStart = Number.parseFloat(startSeconds);
    const parsedDuration = Number.parseFloat(durationSeconds);
    if (
      !Number.isFinite(parsedStart) ||
      parsedStart < 0 ||
      !Number.isFinite(parsedDuration) ||
      parsedDuration <= 0
    ) {
      setError("Please provide valid Start time (>= 0) and Duration (> 0).");
      return;
    }

    setError(null);
    setSuccess(null);
    setConverting(true);
    setProgress(0);
    lastLogRef.current = "";

    const inputName = `input.${sanitizeExtension(getFileExtension(file.name))}`;
    const outputName = "output.gif";
    const paletteName = "palette.png";

    try {
      const ffmpeg = await ensureReady();
      const inputData = new Uint8Array(await file.arrayBuffer());
      await ffmpeg.writeFile(inputName, inputData);

      const exitCode = await runGifConversion(
        ffmpeg,
        inputName,
        outputName,
        paletteName,
        fps,
        width,
        colors,
        parsedStart,
        parsedDuration,
        EXEC_TIMEOUT_MS,
      );
      if (exitCode !== 0) {
        const detail = lastLogRef.current ? ` Last log: ${lastLogRef.current}` : "";
        throw new Error(`GIF conversion failed with code ${exitCode}.${detail}`);
      }

      const outputData = await ffmpeg.readFile(outputName);
      if (!(outputData instanceof Uint8Array) || outputData.byteLength === 0) {
        throw new Error("Converted GIF output could not be read.");
      }

      const baseName = file.name.replace(/\.[^/.]+$/, "");
      const outputFileName = `${baseName}.gif`;
      const outputBlob = new Blob([outputData], { type: "image/gif" });
      downloadBlob(outputBlob, outputFileName);

      setSuccess(
        `GIF ready: ${outputFileName} (${formatBytes(outputBlob.size)}). Clip: ${parsedDuration}s, ${fps} FPS, ${width}px, ${colors} colors.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || "Failed to convert this video.");
    } finally {
      const ffmpeg = ffmpegRef.current;
      if (ffmpeg) {
        await ffmpeg.deleteFile(inputName).catch(() => undefined);
        await ffmpeg.deleteFile(outputName).catch(() => undefined);
        await ffmpeg.deleteFile(paletteName).catch(() => undefined);
      }
      setConverting(false);
    }
  };

  return (
    <PageContainer maxWidth={640}>
      <Stack spacing={2}>
        <FilePickerButton
          variant="outlined"
          label={file ? file.name : "Choose Video File"}
          accept=".mp4,.webm,.mov,.m4v,.avi,.mkv,video/*"
          onFilesSelected={handleFileChange}
        />

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <FormControl size="small" fullWidth>
            <InputLabel id="gif-fps-label">GIF FPS</InputLabel>
            <Select
              labelId="gif-fps-label"
              label="GIF FPS"
              value={fps}
              onChange={(event) => setFps(Number(event.target.value) as GifFps)}
            >
              {FPS_OPTIONS.map((value) => (
                <MenuItem key={value} value={value}>
                  {value} FPS
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel id="gif-width-label">GIF Width</InputLabel>
            <Select
              labelId="gif-width-label"
              label="GIF Width"
              value={width}
              onChange={(event) =>
                setWidth(Number(event.target.value) as GifWidth)
              }
            >
              {WIDTH_OPTIONS.map((value) => (
                <MenuItem key={value} value={value}>
                  {value}px
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <FormControl size="small" fullWidth>
            <InputLabel id="gif-colors-label">Max Colors</InputLabel>
            <Select
              labelId="gif-colors-label"
              label="Max Colors"
              value={colors}
              onChange={(event) =>
                setColors(Number(event.target.value) as GifColors)
              }
            >
              {COLOR_OPTIONS.map((value) => (
                <MenuItem key={value} value={value}>
                  {value}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            fullWidth
            label="Start (sec)"
            value={startSeconds}
            onChange={(event) => setStartSeconds(event.target.value)}
            inputProps={{ inputMode: "decimal" }}
          />

          <TextField
            size="small"
            fullWidth
            label="Duration (sec)"
            value={durationSeconds}
            onChange={(event) => setDurationSeconds(event.target.value)}
            inputProps={{ inputMode: "decimal" }}
          />
        </Stack>

        <ActionButton onClick={handleConvert} loading={converting || loadingCore}>
          Convert To GIF
        </ActionButton>

        {(loadingCore || converting) && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.8 }}>
              {loadingCore
                ? "Preparing conversion engine..."
                : `Converting video... ${progress}%`}
            </Typography>
            {loadingCore ? (
              <LinearProgress />
            ) : (
              <LinearProgress variant="determinate" value={progress} />
            )}
          </Box>
        )}

        <ToolStatusAlerts
          error={error}
          success={success}
          info="GIFs get large quickly. For smaller output, use lower FPS, lower width, fewer colors, and shorter duration."
        />
      </Stack>
    </PageContainer>
  );
}
