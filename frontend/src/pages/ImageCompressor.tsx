import React, { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  IconButton,
  Slider,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";

import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CompressIcon from "@mui/icons-material/Compress";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import FolderZipIcon from "@mui/icons-material/FolderZip";
import PageContainer from "../components/PageContainer";
import { ActionButton } from "../components/buttons/ActionButton";
import FlexWrapRow from "../components/layout/FlexWrapRow";
import ProgressStatusBlock from "../components/tools/ProgressStatusBlock";
import downloadBlob from "../utils/downloadBlob";
import supportsCanvasMime from "../utils/supportsCanvasMime";

type OutputFormat = "image/jpeg" | "image/webp" | "image/png";

type ResizeOptions = {
  enabled: boolean;
  maxWidth: number;
  maxHeight: number;
};

type TargetSizeOptions = {
  enabled: boolean;
  targetKB: number;
  iterations: number;
};

type CompressSpec = {
  chooseFormat: {
    enabled: boolean;
    format: OutputFormat;
  };
  quality: number; // 0..1 (jpeg/webp only)
  background: string; // fixed to white
  resize: ResizeOptions;
  target: TargetSizeOptions;
};

type ResultItem = {
  id: string;
  file: File;
  outputBlob: Blob;
  outputName: string;
  outputUrl: string;
  usedQuality?: number;
  width: number;
  height: number;
  outputMime: OutputFormat;
};

// Fixed bounds for target-size search
const TARGET_MIN_QUALITY = 0.2;
const TARGET_MAX_QUALITY = 0.95;

function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeBaseName(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[^\w\-]+/g, "_");
}

function fileId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function normalizeOutputFormat(mime: string): OutputFormat {
  if (mime === "image/jpeg" || mime === "image/jpg") return "image/jpeg";
  if (mime === "image/webp") return "image/webp";
  return "image/png";
}

function outputExtFor(mime: OutputFormat) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  return await createImageBitmap(file);
}

function fitInside(
  srcW: number,
  srcH: number,
  maxW: number,
  maxH: number,
  withoutEnlargement: boolean,
) {
  const scale = Math.min(maxW / srcW, maxH / srcH);
  const s = withoutEnlargement ? Math.min(1, scale) : scale;
  return {
    width: Math.max(1, Math.round(srcW * s)),
    height: Math.max(1, Math.round(srcH * s)),
  };
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
) {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas.toBlob failed"))),
      type,
      quality,
    );
  });
}

async function encodeWithSpec(
  file: File,
  spec: CompressSpec,
  outputMime: OutputFormat,
): Promise<{
  blob: Blob;
  width: number;
  height: number;
  usedQuality?: number;
}> {
  const bitmap = await loadBitmap(file);

  const srcW = bitmap.width;
  const srcH = bitmap.height;

  const targetSize = spec.resize.enabled
    ? fitInside(
        srcW,
        srcH,
        spec.resize.maxWidth,
        spec.resize.maxHeight,
        true, // ALWAYS do not enlarge smaller images
      )
    : { width: srcW, height: srcH };

  const canvas = document.createElement("canvas");
  canvas.width = targetSize.width;
  canvas.height = targetSize.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D context");

  if (outputMime === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  if (outputMime === "image/png") {
    const blob = await canvasToBlob(canvas, "image/png");
    return { blob, width: canvas.width, height: canvas.height };
  }

  if (!spec.target.enabled) {
    const q = clamp(spec.quality, 0.01, 1);
    const blob = await canvasToBlob(canvas, outputMime, q);
    return { blob, width: canvas.width, height: canvas.height, usedQuality: q };
  }

  const targetBytes = Math.max(1, Math.round(spec.target.targetKB * 1024));
  let lo = clamp(TARGET_MIN_QUALITY, 0.01, 1);
  let hi = clamp(TARGET_MAX_QUALITY, 0.01, 1);
  if (lo > hi) [lo, hi] = [hi, lo];

  let bestBlob: Blob | null = null;
  let bestQ = lo;

  for (let i = 0; i < spec.target.iterations; i++) {
    const q = (lo + hi) / 2;
    const blob = await canvasToBlob(canvas, outputMime, q);

    if (blob.size <= targetBytes) {
      bestBlob = blob;
      bestQ = q;
      lo = q;
    } else {
      hi = q;
    }
  }

  if (bestBlob)
    return {
      blob: bestBlob,
      width: canvas.width,
      height: canvas.height,
      usedQuality: bestQ,
    };

  const blob = await canvasToBlob(canvas, outputMime, lo);
  return { blob, width: canvas.width, height: canvas.height, usedQuality: lo };
}

export default function ImageCompressor() {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [selectedPreviewUrls, setSelectedPreviewUrls] = useState<
    Record<string, string>
  >({});

  const inputRef = useRef<HTMLInputElement | null>(null);

  const [spec, setSpec] = useState<CompressSpec>(() => ({
    chooseFormat: {
      enabled: false,
      format: "image/webp",
    },
    quality: 0.78,
    background: "#ffffff",
    resize: {
      enabled: true,
      maxWidth: 1920,
      maxHeight: 1920,
    },
    target: {
      enabled: false,
      targetKB: 250,
      iterations: 12,
    },
  }));

  const totalBefore = useMemo(
    () => files.reduce((s, f) => s + f.size, 0),
    [files],
  );

  const totalAfter = useMemo(
    () => results.reduce((s, r) => s + r.outputBlob.size, 0),
    [results],
  );

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const file of files) {
      next[fileId(file)] = URL.createObjectURL(file);
    }
    setSelectedPreviewUrls(next);

    return () => {
      for (const url of Object.values(next)) {
        URL.revokeObjectURL(url);
      }
    };
  }, [files]);

  function clearOldUrls() {
    for (const r of results) URL.revokeObjectURL(r.outputUrl);
  }

  function onPickFiles(list: FileList | null) {
    if (!list) return;
    const arr = Array.from(list).filter((f) => f.type.startsWith("image/"));
    clearOldUrls();
    setResults([]);
    setError(null);
    setFiles((prev) => {
      const combined = [...prev, ...arr];
      const map = new Map<string, File>();
      for (const f of combined) map.set(fileId(f), f);
      return Array.from(map.values());
    });
  }

  async function compressAll() {
    setError(null);
    setBusy(true);
    setProgress({ done: 0, total: files.length });

    clearOldUrls();
    setResults([]);

    try {
      if (files.length === 0)
        throw new Error("Please select at least one image.");
      if (files.length > 50)
        throw new Error(
          "Please compress 50 images or fewer at a time (browser memory safety).",
        );

      const out: ResultItem[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        const outputMime: OutputFormat = spec.chooseFormat.enabled
          ? spec.chooseFormat.format
          : normalizeOutputFormat(file.type);
        if (!supportsCanvasMime(outputMime)) {
          throw new Error(`${outputMime} export is not supported by this browser.`);
        }

        const effectiveSpec: CompressSpec =
          outputMime === "image/png"
            ? { ...spec, target: { ...spec.target, enabled: false } }
            : spec;

        const { blob, width, height, usedQuality } = await encodeWithSpec(
          file,
          effectiveSpec,
          outputMime,
        );

        const ext = outputExtFor(outputMime);
        const outputName = `${safeBaseName(file.name)}.${ext}`;
        const outputUrl = URL.createObjectURL(blob);

        out.push({
          id: fileId(file),
          file,
          outputBlob: blob,
          outputName,
          outputUrl,
          usedQuality,
          width,
          height,
          outputMime,
        });

        setProgress({ done: i + 1, total: files.length });
      }

      setResults(out);
    } catch (e: any) {
      setError(e?.message ?? "Compression failed");
    } finally {
      setBusy(false);
    }
  }

  function clearAll() {
    clearOldUrls();
    setFiles([]);
    setResults([]);
    setError(null);
    setProgress({ done: 0, total: 0 });
    if (inputRef.current) inputRef.current.value = "";
  }

  async function downloadAllZip() {
    const zip = new JSZip();
    for (const r of results) {
      const buf = await r.outputBlob.arrayBuffer();
      zip.file(r.outputName, buf);
    }
    const zipBlob = await zip.generateAsync({ type: "blob" });
    downloadBlob(zipBlob, "compressed-images.zip");
  }

  const savingsPct =
    totalBefore > 0 ? ((totalBefore - totalAfter) / totalBefore) * 100 : 0;

  return (
    <PageContainer>
      {/* Header */}
      <Stack spacing={0.75}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ sm: "center" }}
        >
          <Box
            sx={{
              display: { xs: "grid", sm: "flex" },
              gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))" },
              gap: 1,
              flexWrap: { sm: "wrap" },
              alignItems: "center",
            }}
          >
            <Chip
              sx={{ width: { xs: "100%", sm: "auto" } }}
              label={`${files.length} selected`}
            />
            <Chip
              sx={{ width: { xs: "100%", sm: "auto" } }}
              label={`Total: ${formatBytes(totalBefore)}`}
            />
            <Chip
              sx={{ width: { xs: "100%", sm: "auto" } }}
              label={`After: ${formatBytes(totalAfter)}`}
            />
            <Chip
              sx={{ width: { xs: "100%", sm: "auto" } }}
              color={savingsPct > 0 ? "success" : "default"}
              label={
                totalBefore > 0
                  ? `Saved: ${formatBytes(
                      Math.max(0, totalBefore - totalAfter),
                    )} (${savingsPct.toFixed(1)}%)`
                  : "Saved: —"
              }
            />
          </Box>
        </Stack>
      </Stack>

      <Divider />

      {/* 1) Upload */}
      <Stack spacing={1.5}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={{ xs: 1, sm: 2 }}
        >
          <Typography
            variant="h6"
            sx={{ fontWeight: 700, whiteSpace: "nowrap" }}
          >
            1) Upload
          </Typography>

          <FlexWrapRow
            sx={{
              width: { xs: "100%", sm: "auto" },
              justifyContent: { xs: "flex-start", sm: "flex-end" },
            }}
          >
            <Button
              variant="contained"
              startIcon={<CloudUploadIcon />}
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              Choose images
            </Button>

            <Button
              variant="outlined"
              startIcon={<DeleteIcon />}
              onClick={clearAll}
              disabled={busy || (files.length === 0 && results.length === 0)}
            >
              Clear
            </Button>

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                onPickFiles(e.target.files);
                e.currentTarget.value = "";
              }}
            />
          </FlexWrapRow>
        </Stack>

        <Box
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPickFiles(e.dataTransfer.files);
          }}
          sx={{
            p: 2,
            borderRadius: 2,
            border: "2px dashed",
            borderColor: "divider",
            bgcolor: "background.default",
            textAlign: "center",
            color: "text.secondary",
          }}
        >
          Drag & drop images here
        </Box>
      </Stack>

      <Divider />

      {/* Selected previews */}
      {files.length > 0 && (
        <>
          <Stack spacing={1.5}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Selected images
            </Typography>

            <Grid container spacing={2}>
              {files.map((file) => {
                const id = fileId(file);
                const previewUrl = selectedPreviewUrls[id];
                if (!previewUrl) return null;

                return (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={id}>
                    <Card variant="outlined" sx={{ borderRadius: 3 }}>
                      <Box
                        component="img"
                        src={previewUrl}
                        alt={file.name}
                        loading="lazy"
                        sx={{
                          width: "100%",
                          height: 160,
                          objectFit: "cover",
                          borderTopLeftRadius: 12,
                          borderTopRightRadius: 12,
                          bgcolor: "background.default",
                        }}
                      />
                      <CardContent>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={file.name}
                        >
                          {file.name}
                        </Typography>
                        <Chip
                          size="small"
                          label={formatBytes(file.size)}
                          sx={{ mt: 1 }}
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Stack>

          <Divider />
        </>
      )}

      {/* 2) Choose output */}
      <Stack spacing={1.75}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          2) Choose output
        </Typography>

        {/* Quality */}
        <Stack spacing={1}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Quality
            </Typography>
            <Chip
              size="small"
              label={
                spec.target.enabled
                  ? "Disabled (Target size)"
                  : `${Math.round(spec.quality * 100)}`
              }
            />
          </Stack>

          <Slider
            value={Math.round(spec.quality * 100)}
            min={1}
            max={100}
            disabled={busy}
            onChange={(_, v) =>
              setSpec((s) => ({
                ...s,
                quality: clamp((v as number) / 100, 0.01, 1),
              }))
            }
          />

          {!spec.chooseFormat.enabled && (
            <Typography variant="caption" color="text.secondary">
              Output format defaults to the original file type (e.g., JPG stays
              JPG). Note: PNG ignores quality.
            </Typography>
          )}
        </Stack>

        <Divider />
      </Stack>

      <Divider />

      {/* 3) Compress & download */}
      <Stack spacing={1.5}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          3) Compress & download
        </Typography>

        <Box
          sx={{
            display: { xs: "grid", sm: "flex" },
            gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))" },
            gap: 1,
            flexWrap: { sm: "wrap" },
            alignItems: "center",
          }}
        >
          <Button
            sx={{ width: { xs: "100%", sm: "auto" } }}
            variant="contained"
            startIcon={<CompressIcon />}
            onClick={compressAll}
            disabled={busy || files.length === 0}
          >
            {busy ? "Compressing..." : "Compress"}
          </Button>

          <ActionButton
            sx={{ width: { xs: "100%", sm: "auto" } }}
            startIcon={<FolderZipIcon />}
            onClick={downloadAllZip}
            disabled={busy || results.length === 0}
          >
            ZIP
          </ActionButton>
        </Box>

        {busy && (
          <ProgressStatusBlock done={progress.done} total={progress.total} />
        )}

        {error && <Alert severity="error">{error}</Alert>}
      </Stack>

      <Divider />

      {/* Results */}
      <Stack spacing={1.5}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Results
        </Typography>

        {results.length === 0 ? (
          <Box sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
            <Typography sx={{ fontWeight: 650 }}>
              No compressed images yet.
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Upload images above, then press <b>Compress</b>.
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {results.map((r) => {
              const saved = Math.max(0, r.file.size - r.outputBlob.size);
              const pct = r.file.size > 0 ? (saved / r.file.size) * 100 : 0;

              return (
                <Grid size={{ xs: 12, sm: 6 }} key={r.id}>
                  <Card variant="outlined" sx={{ borderRadius: 3 }}>
                    <Box
                      component="img"
                      src={r.outputUrl}
                      alt={r.outputName}
                      loading="lazy"
                      sx={{
                        width: "100%",
                        height: 160,
                        objectFit: "cover",
                        borderTopLeftRadius: 12,
                        borderTopRightRadius: 12,
                        bgcolor: "background.default",
                      }}
                    />

                    <CardContent>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={r.file.name}
                      >
                        {r.file.name}
                      </Typography>

                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ mt: 1, flexWrap: "wrap" }}
                      >
                        <Chip
                          size="small"
                          label={`Before ${formatBytes(r.file.size)}`}
                        />
                        <Chip
                          size="small"
                          label={`After ${formatBytes(r.outputBlob.size)}`}
                        />
                        <Chip size="small" label={`${r.width}×${r.height}`} />
                        <Chip
                          size="small"
                          color={pct > 0 ? "success" : "default"}
                          label={`Saved ${pct.toFixed(1)}%`}
                        />
                        <Chip
                          size="small"
                          label={
                            r.outputMime === "image/jpeg"
                              ? "JPG"
                              : r.outputMime === "image/webp"
                                ? "WEBP"
                                : "PNG"
                          }
                        />
                      </Stack>

                      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                        <ActionButton
                          fullWidth
                          startIcon={<DownloadIcon />}
                          onClick={() =>
                            downloadBlob(r.outputBlob, r.outputName)
                          }
                        >
                          Download
                        </ActionButton>

                        <Tooltip title="Open file in a new tab">
                          <IconButton
                            component="a"
                            href={r.outputUrl}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Open"
                          >
                            ↗
                          </IconButton>
                        </Tooltip>
                      </Stack>

                      {typeof r.usedQuality === "number" && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block", mt: 1 }}
                        >
                          Used quality: {Math.round(r.usedQuality * 100)}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}

        <Typography variant="caption" color="text.secondary">
          Note: This client-only version uses Canvas encoding. PNG “true
          compression” (palette/quantization) and universal AVIF export can be
          added later using WASM codecs (still no backend).
        </Typography>
      </Stack>
    </PageContainer>
  );
}
