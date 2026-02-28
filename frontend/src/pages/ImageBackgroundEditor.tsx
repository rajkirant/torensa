import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { ActionButton } from "../components/buttons/ActionButton";
import { TransparentButton } from "../components/buttons/TransparentButton";
import FilePickerButton from "../components/inputs/FilePickerButton";
import DownloadIcon from "@mui/icons-material/Download";
import { apiFetch } from "../utils/api";
import downloadBlob from "../utils/downloadBlob";

const ACCEPT_TYPES = ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";

type BgMode = "remove" | "color" | "image";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function outputFileName(inputName: string, mode: BgMode) {
  const base = inputName.replace(/\.[^.]+$/, "");
  return mode === "remove" ? `${base}-no-bg.png` : `${base}-changed-bg.png`;
}

/** Draws a WebP blob onto an off-screen canvas and exports it as PNG. */
function webpToPngBlob(webpBlob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(webpBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas 2D context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((pngBlob) => {
        if (pngBlob) resolve(pngBlob);
        else reject(new Error("Canvas toBlob returned null"));
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load WebP image"));
    };
    img.src = url;
  });
}

export default function ImageBackgroundEditor() {
  const [file, setFile] = useState<File | null>(null);
  const [bgMode, setBgMode] = useState<BgMode>("remove");
  const [bgColor, setBgColor] = useState<string>("#ffffff");
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const originalUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : ""),
    [file],
  );
  const resultUrl = useMemo(
    () => (resultBlob ? URL.createObjectURL(resultBlob) : ""),
    [resultBlob],
  );

  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
    };
  }, [originalUrl]);

  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  const onFileSelected = (files: FileList | null) => {
    if (!files?.length) return;
    const selected = files[0];
    setFile(selected);
    setResultBlob(null);
    setError(null);
    setSuccess(null);
  };

  const onBgFileSelected = (files: FileList | null) => {
    if (!files?.length) return;
    setBgFile(files[0]);
    setResultBlob(null);
    setError(null);
    setSuccess(null);
  };

  const processBackground = async () => {
    if (!file) {
      setError("Please select an image first.");
      return;
    }
    if (bgMode === "image" && !bgFile) {
      setError("Please select a background image.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const body = new FormData();
      body.append("image", file);

      if (bgMode === "color") {
        body.append("bg_color", bgColor);
      } else if (bgMode === "image" && bgFile) {
        body.append("bg_image", bgFile);
      }

      const response = await apiFetch("/api/remove-background/", {
        method: "POST",
        body,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        console.error("Background processing failed:", {
          status: response.status,
          error: data?.error,
        });
        setError(
          bgMode === "remove"
            ? "Unable to remove the background for this image."
            : "Unable to change the background for this image.",
        );
        return;
      }

      const blob = await response.blob();
      setResultBlob(blob);
      setSuccess(
        bgMode === "remove"
          ? "Background removed successfully."
          : "Background changed successfully.",
      );
    } catch {
      setError(
        bgMode === "remove"
          ? "Unable to remove the background for this image."
          : "Unable to change the background for this image.",
      );
    } finally {
      setLoading(false);
    }
  };

  const downloadResult = async () => {
    if (!resultBlob || !file) return;
    try {
      const pngBlob = await webpToPngBlob(resultBlob);
      downloadBlob(pngBlob, outputFileName(file.name, bgMode));
    } catch {
      setError("Failed to convert to PNG for download.");
    }
  };

  const clearAll = () => {
    setFile(null);
    setBgFile(null);
    setResultBlob(null);
    setLoading(false);
    setError(null);
    setSuccess(null);
  };

  const actionLabel =
    bgMode === "remove" ? "Remove Background" : "Change Background";

  const resultLabel =
    bgMode === "remove" ? "Result (Transparent WebP)" : "Result";

  return (
    <PageContainer maxWidth={900}>
      <Stack spacing={2.5}>
        {/* Mode selector */}
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            What do you want to do?
          </Typography>
          <ToggleButtonGroup
            value={bgMode}
            exclusive
            onChange={(_e, val: BgMode | null) => {
              if (val) {
                setBgMode(val);
                setResultBlob(null);
                setError(null);
                setSuccess(null);
              }
            }}
            size="small"
          >
            <ToggleButton value="remove">Remove BG</ToggleButton>
            <ToggleButton value="color">Solid Color BG</ToggleButton>
            <ToggleButton value="image">Custom Image BG</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Color picker — shown only in "color" mode */}
        {bgMode === "color" && (
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              Background color:
            </Typography>
            <Box
              component="input"
              type="color"
              value={bgColor}
              onChange={(e) => {
                setBgColor(e.target.value);
                setResultBlob(null);
              }}
              sx={{
                width: 44,
                height: 36,
                border: "1px solid rgba(255,255,255,0.23)",
                borderRadius: 1,
                cursor: "pointer",
                background: "none",
                p: 0.25,
              }}
            />
            <Typography variant="body2" fontFamily="monospace">
              {bgColor}
            </Typography>
          </Stack>
        )}

        {/* Background image picker — shown only in "image" mode */}
        {bgMode === "image" && (
          <FilePickerButton
            variant="outlined"
            label={bgFile ? bgFile.name : "Choose Background Image"}
            accept={ACCEPT_TYPES}
            onFilesSelected={onBgFileSelected}
          />
        )}

        <FilePickerButton
          variant="outlined"
          label={file ? file.name : "Choose Subject Image"}
          accept={ACCEPT_TYPES}
          onFilesSelected={onFileSelected}
        />
        <Typography variant="body2" color="text.secondary">
          For best results, use smaller images.
        </Typography>

        {file && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip label={`Input: ${formatBytes(file.size)}`} />
            {resultBlob && (
              <Chip
                label={`Output: ${formatBytes(resultBlob.size)}`}
                color="success"
              />
            )}
          </Stack>
        )}

        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <ActionButton
            onClick={() => void processBackground()}
            loading={loading}
          >
            {actionLabel}
          </ActionButton>
          <TransparentButton label="Clear" onClick={clearAll} />
        </Box>

        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Box
            sx={{
              flex: 1,
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 2,
              p: 1.5,
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
              Original
            </Typography>
            {originalUrl ? (
              <Box
                component="img"
                src={originalUrl}
                alt="Original"
                sx={{ width: "100%", maxHeight: 420, objectFit: "contain" }}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                No image selected.
              </Typography>
            )}
          </Box>

          <Box
            sx={{
              flex: 1,
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 2,
              p: 1.5,
              // Show checkerboard only for transparent output
              ...(bgMode === "remove" && {
                backgroundImage:
                  "linear-gradient(45deg, rgba(255,255,255,0.06) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.06) 75%, rgba(255,255,255,0.06)), linear-gradient(45deg, rgba(255,255,255,0.06) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.06) 75%, rgba(255,255,255,0.06))",
                backgroundPosition: "0 0, 10px 10px",
                backgroundSize: "20px 20px",
              }),
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
              {resultLabel}
            </Typography>
            {resultUrl ? (
              <Box
                component="img"
                src={resultUrl}
                alt={resultLabel}
                sx={{ width: "100%", maxHeight: 420, objectFit: "contain" }}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                Run {actionLabel.toLowerCase()} to preview output.
              </Typography>
            )}
          </Box>
        </Stack>

        {resultBlob && (
          <Box>
            <ActionButton
              startIcon={<DownloadIcon />}
              onClick={() => void downloadResult()}
            >
              Download PNG
            </ActionButton>
          </Box>
        )}

        <ToolStatusAlerts error={error} success={success} />
      </Stack>
    </PageContainer>
  );
}
