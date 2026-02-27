import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PageContainer from "../components/PageContainer";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { ActionButton } from "../components/buttons/ActionButton";
import { TransparentButton } from "../components/buttons/TransparentButton";
import FilePickerButton from "../components/inputs/FilePickerButton";
import { apiFetch } from "../utils/api";
import downloadBlob from "../utils/downloadBlob";

const ACCEPT_TYPES = ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function outputFileName(inputName: string) {
  const base = inputName.replace(/\.[^.]+$/, "");
  return `${base}-no-bg.png`;
}

/** Draws a WebP blob onto an off-screen canvas and exports it as PNG.
 *  No additional quality loss — PNG is lossless. */
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

export default function ImageBackgroundRemover() {
  const [file, setFile] = useState<File | null>(null);
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

  const removeBackground = async () => {
    if (!file) {
      setError("Please select an image first.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const body = new FormData();
      body.append("image", file);

      const response = await apiFetch("/api/remove-background/", {
        method: "POST",
        body,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        console.error("Background remover failed:", {
          status: response.status,
          error: data?.error,
        });
        setError("Unable to remove the background for this image.");
        return;
      }

      const blob = await response.blob();
      setResultBlob(blob);
      setSuccess("Background removed successfully.");
    } catch {
      setError("Unable to remove the background for this image.");
    } finally {
      setLoading(false);
    }
  };

  const downloadResult = async () => {
    if (!resultBlob || !file) return;
    try {
      const pngBlob = await webpToPngBlob(resultBlob);
      downloadBlob(pngBlob, outputFileName(file.name));
    } catch {
      setError("Failed to convert to PNG for download.");
    }
  };

  const clearAll = () => {
    setFile(null);
    setResultBlob(null);
    setLoading(false);
    setError(null);
    setSuccess(null);
  };

  return (
    <PageContainer maxWidth={900}>
      <Stack spacing={2.5}>
        <FilePickerButton
          variant="outlined"
          label={file ? file.name : "Choose Image"}
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
            onClick={() => void removeBackground()}
            loading={loading}
          >
            Remove Background
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
              backgroundImage:
                "linear-gradient(45deg, rgba(255,255,255,0.06) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.06) 75%, rgba(255,255,255,0.06)), linear-gradient(45deg, rgba(255,255,255,0.06) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.06) 75%, rgba(255,255,255,0.06))",
              backgroundPosition: "0 0, 10px 10px",
              backgroundSize: "20px 20px",
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
              Result (Transparent WebP)
            </Typography>
            {resultUrl ? (
              <Box
                component="img"
                src={resultUrl}
                alt="Background removed"
                sx={{ width: "100%", maxHeight: 420, objectFit: "contain" }}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                Run background removal to preview output.
              </Typography>
            )}
          </Box>
        </Stack>

        {resultBlob && (
          <Box>
            <TransparentButton
              label="Download PNG"
              onClick={() => void downloadResult()}
            />
          </Box>
        )}

        <ToolStatusAlerts error={error} success={success} />
      </Stack>
    </PageContainer>
  );
}
