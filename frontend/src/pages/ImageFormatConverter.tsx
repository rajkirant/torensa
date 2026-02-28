import { useMemo, useState } from "react";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";

import DownloadIcon from "@mui/icons-material/Download";
import PageContainer from "../components/PageContainer";
import FilePickerButton from "../components/inputs/FilePickerButton";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { ActionButton } from "../components/buttons/ActionButton";
import downloadBlob from "../utils/downloadBlob";
import supportsCanvasMime from "../utils/supportsCanvasMime";

type Format = "png" | "jpg" | "webp" | "bmp";

const FORMAT_LIST: Format[] = ["png", "jpg", "webp", "bmp"];

const formatLabel: Record<Format, string> = {
  png: "PNG (.png)",
  jpg: "JPG (.jpg/.jpeg)",
  webp: "WEBP (.webp)",
  bmp: "BMP (.bmp)",
};

const formatMime: Record<Exclude<Format, "bmp">, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

function detectFormatFromFileName(fileName: string): Format | null {
  if (/\.png$/i.test(fileName)) return "png";
  if (/\.jpe?g$/i.test(fileName)) return "jpg";
  if (/\.webp$/i.test(fileName)) return "webp";
  if (/\.bmp$/i.test(fileName)) return "bmp";
  return null;
}

function detectFormatFromMime(mime: string): Format | null {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/bmp" || mime === "image/x-ms-bmp") return "bmp";
  return null;
}

function ensureFormatMatchesSource(file: File, sourceFormat: Format) {
  const byName = detectFormatFromFileName(file.name);
  const byMime = detectFormatFromMime(file.type);

  if (byName && byName !== sourceFormat) {
    throw new Error(
      `Selected source format is ${formatLabel[sourceFormat]}, but file name looks like ${formatLabel[byName]}.`,
    );
  }

  if (!byName && byMime && byMime !== sourceFormat) {
    throw new Error(
      `Selected source format is ${formatLabel[sourceFormat]}, but file type looks like ${formatLabel[byMime]}.`,
    );
  }
}

async function loadCanvasFromFile(file: File): Promise<HTMLCanvasElement> {
  let bitmap: ImageBitmap;

  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Failed to decode this image file in your browser.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    if ("close" in bitmap) bitmap.close();
    throw new Error("Unable to access 2D canvas context.");
  }

  ctx.drawImage(bitmap, 0, 0);
  if ("close" in bitmap) bitmap.close();
  return canvas;
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
): Promise<Blob> {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Image export failed.")),
      mime,
      0.92,
    );
  });
}

function canvasToBmpBlob(canvas: HTMLCanvasElement): Blob {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to access 2D canvas context.");
  }

  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  bytes[0] = 0x42;
  bytes[1] = 0x4d;
  view.setUint32(2, fileSize, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(34, pixelArraySize, true);

  let writeOffset = 54;
  for (let y = height - 1; y >= 0; y -= 1) {
    const rowStart = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      const i = rowStart + x * 4;
      bytes[writeOffset] = data[i + 2];
      bytes[writeOffset + 1] = data[i + 1];
      bytes[writeOffset + 2] = data[i];
      writeOffset += 3;
    }
    while ((writeOffset - 54) % rowSize !== 0) {
      bytes[writeOffset] = 0;
      writeOffset += 1;
    }
  }

  return new Blob([buffer], { type: "image/bmp" });
}

async function convertImage(
  file: File,
  sourceFormat: Format,
  targetFormat: Format,
): Promise<Blob> {
  ensureFormatMatchesSource(file, sourceFormat);

  if (sourceFormat === targetFormat) {
    throw new Error("Input and output formats must be different.");
  }

  const canvas = await loadCanvasFromFile(file);

  if (targetFormat === "bmp") {
    return canvasToBmpBlob(canvas);
  }

  const targetMime = formatMime[targetFormat];
  if (!supportsCanvasMime(targetMime)) {
    throw new Error(
      `${formatLabel[targetFormat]} export is not supported by this browser.`,
    );
  }

  return canvasToBlob(canvas, targetMime);
}

export default function ImageFormatConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceFormat, setSourceFormat] = useState<Format>("png");
  const [targetFormat, setTargetFormat] = useState<Format>("jpg");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const targetOptions = useMemo(
    () => FORMAT_LIST.filter((fmt) => fmt !== sourceFormat),
    [sourceFormat],
  );

  const handleFileChange = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const selectedFile = files[0];
    setFile(selectedFile);
    setError(null);
    setSuccess(null);

    const detectedFormat =
      detectFormatFromFileName(selectedFile.name) ??
      detectFormatFromMime(selectedFile.type);

    if (detectedFormat) {
      setSourceFormat(detectedFormat);
      setTargetFormat(detectedFormat === "png" ? "jpg" : "png");
    }
  };

  const handleSourceFormatChange = (nextFormat: Format) => {
    setSourceFormat(nextFormat);
    if (nextFormat === targetFormat) {
      setTargetFormat(nextFormat === "png" ? "jpg" : "png");
    }
  };

  const handleConvert = async () => {
    if (!file) {
      setError("Please select an image file.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const outputBlob = await convertImage(file, sourceFormat, targetFormat);
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      const outputName = `${baseName}.${targetFormat}`;
      downloadBlob(outputBlob, outputName);

      setSuccess(
        `Converted from ${formatLabel[sourceFormat]} to ${formatLabel[targetFormat]}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to convert image.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer maxWidth={560}>
      <FilePickerButton
        variant="outlined"
        label={file ? file.name : "Choose Image File"}
        accept=".png,.jpg,.jpeg,.webp,.bmp,image/png,image/jpeg,image/webp,image/bmp,image/x-ms-bmp"
        onFilesSelected={handleFileChange}
      />

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <FormControl fullWidth size="small">
          <InputLabel id="source-image-format-label">From</InputLabel>
          <Select
            labelId="source-image-format-label"
            label="From"
            value={sourceFormat}
            onChange={(event) =>
              handleSourceFormatChange(event.target.value as Format)
            }
          >
            {FORMAT_LIST.map((format) => (
              <MenuItem key={format} value={format}>
                {formatLabel[format]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth size="small">
          <InputLabel id="target-image-format-label">To</InputLabel>
          <Select
            labelId="target-image-format-label"
            label="To"
            value={targetFormat}
            onChange={(event) => setTargetFormat(event.target.value as Format)}
          >
            {targetOptions.map((format) => (
              <MenuItem key={format} value={format}>
                {formatLabel[format]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <ActionButton
        startIcon={<DownloadIcon />}
        onClick={handleConvert}
        loading={loading}
      >
        Convert & Download
      </ActionButton>

      <ToolStatusAlerts error={error} success={success} />
    </PageContainer>
  );
}
