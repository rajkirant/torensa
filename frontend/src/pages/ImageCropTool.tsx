import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Slider,
  Stack,
  Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

import PageContainer from "../components/PageContainer";
import { ActionButton } from "../components/buttons/ActionButton";
import FilePickerButton from "../components/inputs/FilePickerButton";

type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

type Size = {
  width: number;
  height: number;
};

type Point = {
  x: number;
  y: number;
};

type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ResizeHandle = "nw" | "ne" | "sw" | "se";

type DragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  cropAtStart: CropRect;
  mode: "move" | "resize";
  handle?: ResizeHandle;
};

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

const MIN_CROP_SIZE = 20;
const DEFAULT_EXPORT_QUALITY = 0.9;

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
};

function getOutputExtension(format: OutputFormat) {
  if (format === "image/jpeg") return "jpg";
  if (format === "image/webp") return "webp";
  return "png";
}

function normalizeInputFormat(mime: string): OutputFormat | null {
  if (mime === "image/jpeg" || mime === "image/jpg") return "image/jpeg";
  if (mime === "image/png") return "image/png";
  if (mime === "image/webp") return "image/webp";
  return null;
}

function supportsMime(mime: OutputFormat) {
  const canvas = document.createElement("canvas");
  try {
    return canvas.toDataURL(mime).startsWith(`data:${mime}`);
  } catch {
    return false;
  }
}

function createInitialCrop(size: Size): CropRect {
  const width = Math.max(1, Math.round(size.width * 0.8));
  const height = Math.max(1, Math.round(size.height * 0.8));
  return {
    x: Math.max(0, Math.round((size.width - width) / 2)),
    y: Math.max(0, Math.round((size.height - height) / 2)),
    width,
    height,
  };
}

function normalizeCrop(crop: CropRect, size: Size): CropRect {
  const x = clamp(Math.round(crop.x), 0, Math.max(0, size.width - 1));
  const y = clamp(Math.round(crop.y), 0, Math.max(0, size.height - 1));
  const width = clamp(Math.round(crop.width), 1, Math.max(1, size.width - x));
  const height = clamp(
    Math.round(crop.height),
    1,
    Math.max(1, size.height - y),
  );

  return { x, y, width, height };
}

function resizeCropFromHandle(
  start: CropRect,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  size: Size,
): CropRect {
  const rightStart = start.x + start.width;
  const bottomStart = start.y + start.height;

  let left = start.x;
  let top = start.y;
  let right = rightStart;
  let bottom = bottomStart;

  if (handle === "nw") {
    left = clamp(start.x + dx, 0, rightStart - MIN_CROP_SIZE);
    top = clamp(start.y + dy, 0, bottomStart - MIN_CROP_SIZE);
  } else if (handle === "ne") {
    right = clamp(rightStart + dx, start.x + MIN_CROP_SIZE, size.width);
    top = clamp(start.y + dy, 0, bottomStart - MIN_CROP_SIZE);
  } else if (handle === "sw") {
    left = clamp(start.x + dx, 0, rightStart - MIN_CROP_SIZE);
    bottom = clamp(bottomStart + dy, start.y + MIN_CROP_SIZE, size.height);
  } else {
    right = clamp(rightStart + dx, start.x + MIN_CROP_SIZE, size.width);
    bottom = clamp(bottomStart + dy, start.y + MIN_CROP_SIZE, size.height);
  }

  return normalizeCrop(
    {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    },
    size,
  );
}

async function loadImageSize(url: string): Promise<Size> {
  return await new Promise<Size>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

async function cropToBlob(
  sourceUrl: string,
  crop: CropRect,
  format: OutputFormat,
): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Unable to decode image"));
    el.src = sourceUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D canvas context available");

  if (format === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(
    img,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height,
  );

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Crop export failed")),
      format,
      format === "image/png" ? undefined : DEFAULT_EXPORT_QUALITY,
    );
  });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImageCropTool() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceSize, setSourceSize] = useState<Size | null>(null);
  const [renderedSize, setRenderedSize] = useState<Size | null>(null);
  const [renderedOffset, setRenderedOffset] = useState<Point>({ x: 0, y: 0 });
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("image/png");
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [busy, setBusy] = useState(false);
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const previewRef = useRef<HTMLImageElement | null>(null);
  const previewJobRef = useRef(0);

  const formatSupport = useMemo(
    () => ({
      png: supportsMime("image/png"),
      jpeg: supportsMime("image/jpeg"),
      webp: supportsMime("image/webp"),
    }),
    [],
  );

  const clearResult = () => {
    setResultBlob(null);
    setResultUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const clearAll = () => {
    setFile(null);
    setSourceSize(null);
    setRenderedSize(null);
    setCrop(null);
    setDragState(null);
    setError(null);
    clearResult();
    setSourceUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (inputRef.current) inputRef.current.value = "";
  };

  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    };
  }, [sourceUrl]);

  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  useEffect(() => {
    const node = previewRef.current;
    if (!node || !sourceUrl) return;

    const syncSize = () => {
      setRenderedSize({
        width: Math.max(1, Math.round(node.clientWidth)),
        height: Math.max(1, Math.round(node.clientHeight)),
      });
      setRenderedOffset({
        x: Math.max(0, Math.round(node.offsetLeft)),
        y: Math.max(0, Math.round(node.offsetTop)),
      });
    };

    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(node);

    return () => observer.disconnect();
  }, [sourceUrl]);

  useEffect(() => {
    if (!sourceUrl || !sourceSize || !crop || !file) {
      setIsRenderingPreview(false);
      return;
    }

    const jobId = ++previewJobRef.current;
    const normalizedCrop = normalizeCrop(crop, sourceSize);

    setIsRenderingPreview(true);

    const timer = window.setTimeout(() => {
      void cropToBlob(sourceUrl, normalizedCrop, outputFormat)
        .then((blob) => {
          if (previewJobRef.current !== jobId) return;
          setResultBlob(blob);
          setResultUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(blob);
          });
        })
        .catch((e: any) => {
          if (previewJobRef.current !== jobId) return;
          setError(e?.message ?? "Unable to crop image.");
        })
        .finally(() => {
          if (previewJobRef.current !== jobId) return;
          setIsRenderingPreview(false);
        });
    }, 90);

    return () => {
      window.clearTimeout(timer);
    };
  }, [sourceUrl, sourceSize, crop, outputFormat, file]);

  const updateCrop = (partial: Partial<CropRect>) => {
    if (!crop || !sourceSize) return;
    setCrop(normalizeCrop({ ...crop, ...partial }, sourceSize));
  };

  const beginMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (busy || !crop) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      cropAtStart: crop,
      mode: "move",
    });
  };

  const beginResize =
    (handle: ResizeHandle) => (event: React.PointerEvent<HTMLDivElement>) => {
      if (busy || !crop) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragState({
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        cropAtStart: crop,
        mode: "resize",
        handle,
      });
    };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState || !sourceSize || !renderedSize) return;
    if (event.pointerId !== dragState.pointerId) return;

    const scaleX = sourceSize.width / renderedSize.width;
    const scaleY = sourceSize.height / renderedSize.height;
    const dx = Math.round((event.clientX - dragState.startClientX) * scaleX);
    const dy = Math.round((event.clientY - dragState.startClientY) * scaleY);

    if (dragState.mode === "move") {
      const maxX = Math.max(0, sourceSize.width - dragState.cropAtStart.width);
      const maxY = Math.max(
        0,
        sourceSize.height - dragState.cropAtStart.height,
      );

      const nextX = clamp(dragState.cropAtStart.x + dx, 0, maxX);
      const nextY = clamp(dragState.cropAtStart.y + dy, 0, maxY);

      setCrop((prev) => {
        if (!prev) return prev;
        return normalizeCrop({ ...prev, x: nextX, y: nextY }, sourceSize);
      });
      return;
    }

    if (!dragState.handle) return;
    setCrop(
      resizeCropFromHandle(
        dragState.cropAtStart,
        dragState.handle,
        dx,
        dy,
        sourceSize,
      ),
    );
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragState(null);
  };

  const onFilesSelected = async (files: FileList | null) => {
    const picked = files?.[0];
    if (!picked) return;

    if (!picked.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }

    const sourceFormat = normalizeInputFormat(picked.type);
    if (!sourceFormat) {
      setError(
        "Only PNG, JPEG, and WebP are supported for same-format export.",
      );
      return;
    }

    const isSupported =
      (sourceFormat === "image/png" && formatSupport.png) ||
      (sourceFormat === "image/jpeg" && formatSupport.jpeg) ||
      (sourceFormat === "image/webp" && formatSupport.webp);

    if (!isSupported) {
      setError("This browser cannot export that image format.");
      return;
    }

    setBusy(false);
    setError(null);
    clearResult();
    setOutputFormat(sourceFormat);

    const url = URL.createObjectURL(picked);
    setFile(picked);
    setSourceUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });

    try {
      const size = await loadImageSize(url);
      setSourceSize(size);
      setCrop(createInitialCrop(size));
    } catch (e: any) {
      setError(e?.message ?? "Unable to load selected image.");
      setSourceSize(null);
      setCrop(null);
    }

    if (inputRef.current) inputRef.current.value = "";
  };

  const downloadResult = () => {
    if (!resultBlob || !file) return;
    const baseName = file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[^\w.-]+/g, "_");
    const ext = getOutputExtension(outputFormat);
    triggerDownload(resultBlob, `${baseName}-cropped.${ext}`);
  };

  const overlayStyle = useMemo(() => {
    if (!sourceSize || !renderedSize || !crop) return null;
    const scaleX = renderedSize.width / sourceSize.width;
    const scaleY = renderedSize.height / sourceSize.height;
    return {
      left: renderedOffset.x + crop.x * scaleX,
      top: renderedOffset.y + crop.y * scaleY,
      width: crop.width * scaleX,
      height: crop.height * scaleY,
    };
  }, [sourceSize, renderedSize, renderedOffset, crop]);

  const maxX =
    sourceSize && crop ? Math.max(0, sourceSize.width - crop.width) : 0;
  const maxY =
    sourceSize && crop ? Math.max(0, sourceSize.height - crop.height) : 0;

  return (
    <PageContainer maxWidth={1000}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ sm: "center" }}
        >
          <FilePickerButton
            label="Choose image"
            variant="contained"
            startIcon={<UploadFileIcon />}
            accept="image/*"
            onFilesSelected={onFilesSelected}
            inputRef={inputRef}
            disabled={busy}
          />

          <Button
            variant="text"
            color="inherit"
            startIcon={<RestartAltIcon />}
            onClick={clearAll}
            disabled={busy && !sourceUrl}
          >
            Clear
          </Button>

          {sourceSize && (
            <Chip
              size="small"
              variant="outlined"
              label={`${sourceSize.width} x ${sourceSize.height}px`}
              sx={{ ml: { sm: "auto" } }}
            />
          )}
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}
      </Stack>

      <Divider />

      {!sourceUrl || !sourceSize || !crop ? (
        <Box sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
          <Typography sx={{ fontWeight: 650 }}>No image selected.</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Upload an image to start cropping.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={2.5}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            1) Select crop area
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Drag inside the rectangle to move it. Drag corner handles to resize.
          </Typography>

          <Box
            sx={{
              position: "relative",
              mx: "auto",
              width: "100%",
              maxWidth: 840,
              borderRadius: 0,
              border: "1px solid",
              borderColor: "divider",
              overflow: "hidden",
              bgcolor: "background.default",
            }}
          >
            <Box
              component="img"
              ref={previewRef}
              src={sourceUrl}
              alt={file?.name ?? "Source"}
              draggable={false}
              onLoad={(event: React.SyntheticEvent<HTMLImageElement>) => {
                const node = event.currentTarget;
                setRenderedSize({
                  width: Math.max(1, Math.round(node.clientWidth)),
                  height: Math.max(1, Math.round(node.clientHeight)),
                });
                setRenderedOffset({
                  x: Math.max(0, Math.round(node.offsetLeft)),
                  y: Math.max(0, Math.round(node.offsetTop)),
                });
              }}
              sx={{
                display: "block",
                width: "auto",
                maxWidth: "100%",
                height: "auto",
                maxHeight: 460,
                mx: "auto",
              }}
            />

            {overlayStyle && (
              <Box
                sx={{
                  position: "absolute",
                  border: "2px solid #36cfc9",
                  left: overlayStyle.left,
                  top: overlayStyle.top,
                  width: overlayStyle.width,
                  height: overlayStyle.height,
                  boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.38)",
                  cursor: dragState ? "grabbing" : "grab",
                  touchAction: "none",
                }}
                onPointerDown={beginMove}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onLostPointerCapture={() => setDragState(null)}
              >
                <Box
                  sx={{
                    position: "absolute",
                    left: -7,
                    top: -7,
                    width: 14,
                    height: 14,
                    borderRadius: 0,
                    bgcolor: "#36cfc9",
                    border: "2px solid #ffffff",
                    cursor: "nwse-resize",
                    touchAction: "none",
                  }}
                  onPointerDown={beginResize("nw")}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onLostPointerCapture={() => setDragState(null)}
                />
                <Box
                  sx={{
                    position: "absolute",
                    right: -7,
                    top: -7,
                    width: 14,
                    height: 14,
                    borderRadius: 0,
                    bgcolor: "#36cfc9",
                    border: "2px solid #ffffff",
                    cursor: "nesw-resize",
                    touchAction: "none",
                  }}
                  onPointerDown={beginResize("ne")}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onLostPointerCapture={() => setDragState(null)}
                />
                <Box
                  sx={{
                    position: "absolute",
                    left: -7,
                    bottom: -7,
                    width: 14,
                    height: 14,
                    borderRadius: 0,
                    bgcolor: "#36cfc9",
                    border: "2px solid #ffffff",
                    cursor: "nesw-resize",
                    touchAction: "none",
                  }}
                  onPointerDown={beginResize("sw")}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onLostPointerCapture={() => setDragState(null)}
                />
                <Box
                  sx={{
                    position: "absolute",
                    right: -7,
                    bottom: -7,
                    width: 14,
                    height: 14,
                    borderRadius: 0,
                    bgcolor: "#36cfc9",
                    border: "2px solid #ffffff",
                    cursor: "nwse-resize",
                    touchAction: "none",
                  }}
                  onPointerDown={beginResize("se")}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onLostPointerCapture={() => setDragState(null)}
                />
              </Box>
            )}
          </Box>

          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 0.5 }}>
            <Chip
              size="small"
              variant="outlined"
              label={`Selected: ${crop.width} x ${crop.height}px`}
            />
          </Box>

          <Stack spacing={1.25}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Left (X): {crop.x}px
            </Typography>
            <Slider
              value={crop.x}
              min={0}
              max={maxX}
              onChange={(_, value) => updateCrop({ x: value as number })}
              disabled={busy}
            />

            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Top (Y): {crop.y}px
            </Typography>
            <Slider
              value={crop.y}
              min={0}
              max={maxY}
              onChange={(_, value) => updateCrop({ y: value as number })}
              disabled={busy}
            />

            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Width: {crop.width}px
            </Typography>
            <Slider
              value={crop.width}
              min={1}
              max={sourceSize.width - crop.x}
              onChange={(_, value) => updateCrop({ width: value as number })}
              disabled={busy}
            />

            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Height: {crop.height}px
            </Typography>
            <Slider
              value={crop.height}
              min={1}
              max={sourceSize.height - crop.y}
              onChange={(_, value) => updateCrop({ height: value as number })}
              disabled={busy}
            />
          </Stack>
        </Stack>
      )}

      <Divider />

      <Stack spacing={2}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          2) Export
        </Typography>

        {resultUrl ? (
          <Stack spacing={1}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Cropped result
            </Typography>
            <Box
              component="img"
              src={resultUrl}
              alt="Cropped preview"
              sx={{
                display: "block",
                width: "auto !important",
                height: "auto !important",
                maxWidth: "100%",
                maxHeight: 360,
                objectFit: "contain",
                mx: "auto",
                borderRadius: 0,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "background.default",
              }}
            />
            <Chip
              size="small"
              variant="outlined"
              label={
                resultBlob ? `Output size: ${formatBytes(resultBlob.size)}` : ""
              }
              sx={{ alignSelf: "flex-start" }}
            />
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {isRenderingPreview
              ? "Updating preview..."
              : "Preview appears automatically after you select an image."}
          </Typography>
        )}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems={{ sm: "center" }}
        >
          <ActionButton
            startIcon={<DownloadIcon />}
            onClick={downloadResult}
            disabled={!resultBlob || busy || isRenderingPreview}
            loading={busy || isRenderingPreview}
          >
            Download
          </ActionButton>
        </Stack>
      </Stack>
    </PageContainer>
  );
}
