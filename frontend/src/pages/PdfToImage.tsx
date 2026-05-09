import { useMemo, useState } from "react";
import JSZip from "jszip";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadIcon from "@mui/icons-material/Download";
import FolderZipIcon from "@mui/icons-material/FolderZip";

import PageContainer from "../components/PageContainer";
import FileDropZone from "../components/inputs/FileDropZone";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { ActionButton } from "../components/buttons/ActionButton";
import { TransparentButton } from "../components/buttons/TransparentButton";
import ProgressStatusBlock from "../components/tools/ProgressStatusBlock";
import downloadBlob from "../utils/downloadBlob";
import supportsCanvasMime from "../utils/supportsCanvasMime";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type ImageFormat = "png" | "jpeg" | "webp";

type ProgressState = {
  done: number;
  total: number;
  label: string;
};

const FORMAT_MIME: Record<ImageFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

const FORMAT_EXT: Record<ImageFormat, string> = {
  png: "png",
  jpeg: "jpg",
  webp: "webp",
};

function isPdfFile(file: File) {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

function toBaseName(fileName: string) {
  const trimmed = fileName.trim();
  const withoutExt = trimmed.replace(/\.pdf$/i, "");
  return withoutExt.length > 0 ? withoutExt : "document";
}

function plural(count: number, singular: string, pluralForm?: string) {
  return count === 1 ? singular : (pluralForm ?? `${singular}s`);
}

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

function parsePageRanges(input: string, pageCount: number): number[] {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error(
      "Enter page ranges like 1-3,5,8-10 before converting.",
    );
  }

  const seen = new Set<number>();
  const ordered: number[] = [];
  const tokens = trimmed
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  if (tokens.length === 0) {
    throw new Error("Enter page ranges like 1-3,5,8-10 before converting.");
  }

  for (const token of tokens) {
    const rangeMatch = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const a = Number(rangeMatch[1]);
      const b = Number(rangeMatch[2]);
      const start = Math.min(a, b);
      const end = Math.max(a, b);
      if (start < 1 || end > pageCount) {
        throw new Error(
          `Range "${token}" is outside the valid page range (1-${pageCount}).`,
        );
      }
      for (let p = start; p <= end; p += 1) {
        if (!seen.has(p)) {
          seen.add(p);
          ordered.push(p);
        }
      }
      continue;
    }

    if (!/^\d+$/.test(token)) {
      throw new Error(
        `Invalid token "${token}". Use numbers and ranges like 1-3,5,8-10.`,
      );
    }
    const p = Number(token);
    if (p < 1 || p > pageCount) {
      throw new Error(
        `Page "${token}" is outside the valid page range (1-${pageCount}).`,
      );
    }
    if (!seen.has(p)) {
      seen.add(p);
      ordered.push(p);
    }
  }

  if (ordered.length === 0) {
    throw new Error("No valid pages were selected.");
  }
  return ordered;
}

async function renderPageToBlob(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  scale: number,
  format: ImageFormat,
  quality: number,
): Promise<Blob> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to acquire a 2D canvas context for rendering.");
  }

  // JPEG can't represent transparency — paint a white background.
  if (format === "jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  page.cleanup();

  const mime = FORMAT_MIME[format];
  const blob: Blob | null = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), mime, quality);
  });

  if (!blob) {
    throw new Error(`Failed to encode page ${pageNumber} as ${format}.`);
  }
  return blob;
}

export default function PdfToImage() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState(0);

  const [rangeInput, setRangeInput] = useState("1");
  const [format, setFormat] = useState<ImageFormat>("png");
  const [scale, setScale] = useState<number>(2);
  const [quality, setQuality] = useState<number>(0.92);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const baseName = useMemo(
    () => (file ? toBaseName(file.name) : "document"),
    [file],
  );

  function clearAll() {
    setFile(null);
    setPdfBytes(null);
    setPageCount(0);
    setRangeInput("1");
    setProgress(null);
    setError(null);
    setSuccess(null);
  }

  async function onPickPdf(files: FileList | null) {
    if (!files || files.length === 0) return;
    const picked = files[0];
    setError(null);
    setSuccess(null);
    setProgress(null);

    if (!isPdfFile(picked)) {
      setError("Please choose a valid PDF file.");
      return;
    }

    try {
      const arrayBuffer = await picked.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const loadingTask = pdfjsLib.getDocument({ data: bytes.slice() });
      const pdf = await loadingTask.promise;
      const count = pdf.numPages;
      pdf.destroy();

      if (count < 1) {
        throw new Error("The selected PDF has no pages.");
      }

      setFile(picked);
      setPdfBytes(bytes);
      setPageCount(count);
      setRangeInput(`1-${count}`);
      setSuccess(
        `Loaded "${picked.name}" (${count} ${plural(count, "page")}).`,
      );
    } catch (err) {
      setFile(null);
      setPdfBytes(null);
      setPageCount(0);
      setRangeInput("1");
      setError(
        toErrorMessage(
          err,
          "Unable to read this PDF. The file may be encrypted or unsupported.",
        ),
      );
    }
  }

  function requirePdfState() {
    if (!file || !pdfBytes || pageCount < 1) {
      throw new Error("Upload a PDF file first.");
    }
    return { file, pdfBytes, pageCount };
  }

  async function convert() {
    setError(null);
    setSuccess(null);

    let pdf: pdfjsLib.PDFDocumentProxy | null = null;

    try {
      const state = requirePdfState();

      if (format !== "png" && !supportsCanvasMime(FORMAT_MIME[format])) {
        throw new Error(
          `Your browser does not support exporting ${format.toUpperCase()}. Try PNG instead.`,
        );
      }

      const selected = parsePageRanges(rangeInput, state.pageCount);

      setBusy(true);
      setProgress({
        done: 0,
        total: selected.length,
        label: "Loading PDF...",
      });

      pdf = await pdfjsLib.getDocument({ data: state.pdfBytes.slice() })
        .promise;

      const ext = FORMAT_EXT[format];
      const pad = String(state.pageCount).length;

      if (selected.length === 1) {
        const pageNumber = selected[0];
        setProgress({
          done: 0,
          total: 1,
          label: `Rendering page ${pageNumber}...`,
        });
        const blob = await renderPageToBlob(
          pdf,
          pageNumber,
          scale,
          format,
          quality,
        );
        downloadBlob(
          blob,
          `${baseName}-page-${String(pageNumber).padStart(pad, "0")}.${ext}`,
        );
        setProgress({ done: 1, total: 1, label: "Done" });
        setSuccess(`Converted page ${pageNumber} to ${format.toUpperCase()}.`);
        return;
      }

      const zip = new JSZip();
      for (let i = 0; i < selected.length; i += 1) {
        const pageNumber = selected[i];
        setProgress({
          done: i,
          total: selected.length,
          label: `Rendering page ${pageNumber} (${i + 1} of ${selected.length})...`,
        });
        const blob = await renderPageToBlob(
          pdf,
          pageNumber,
          scale,
          format,
          quality,
        );
        const name = `${baseName}-page-${String(pageNumber).padStart(pad, "0")}.${ext}`;
        zip.file(name, blob);
      }

      setProgress({
        done: selected.length,
        total: selected.length,
        label: "Packaging ZIP...",
      });
      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipBlob, `${baseName}-images.zip`);
      setSuccess(
        `Converted ${selected.length} ${plural(
          selected.length,
          "page",
        )} to ${format.toUpperCase()} (ZIP).`,
      );
    } catch (err) {
      setError(toErrorMessage(err, "Failed to convert this PDF to images."));
    } finally {
      if (pdf) {
        try {
          await pdf.destroy();
        } catch {
          /* noop */
        }
      }
      setBusy(false);
      setProgress(null);
    }
  }

  const canRun = !busy && Boolean(file) && pageCount > 0;

  return (
    <PageContainer maxWidth={920}>
      <Divider />

      <Stack spacing={1.5}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={1.5}
        >
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            1) Upload PDF
          </Typography>

          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <TransparentButton
              label="Clear"
              startIcon={<DeleteOutlineIcon />}
              onClick={clearAll}
              disabled={busy || (!file && !error && !success)}
            />
          </Box>
        </Stack>

        <FileDropZone
          accept=".pdf,application/pdf"
          disabled={busy}
          onFilesSelected={onPickPdf}
          onClear={clearAll}
          clearDisabled={busy || (!file && !error && !success)}
          fileType="pdf"
          label={file ? file.name : "Drag & drop a PDF here, or tap to browse"}
        />

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ sm: "center" }}
        >
          <Chip
            label={file ? file.name : "No PDF selected"}
            variant={file ? "filled" : "outlined"}
          />
          <Chip
            label={
              file
                ? `${pageCount} ${plural(pageCount, "page")}`
                : "Upload a PDF to continue"
            }
            variant="outlined"
          />
        </Stack>
      </Stack>

      <Divider />

      <Stack spacing={2}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          2) Conversion options
        </Typography>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField
            size="small"
            label="Page ranges"
            placeholder="1-3,5,8-10"
            value={rangeInput}
            onChange={(e) => setRangeInput(e.target.value)}
            disabled={busy}
            helperText={`Use 1-${Math.max(1, pageCount)}. Example: 1-3,5,8-10`}
            fullWidth
          />

          <TextField
            size="small"
            select
            label="Format"
            value={format}
            onChange={(e) => setFormat(e.target.value as ImageFormat)}
            disabled={busy}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="png">PNG</MenuItem>
            <MenuItem value="jpeg">JPEG</MenuItem>
            <MenuItem value="webp">WebP</MenuItem>
          </TextField>

          <TextField
            size="small"
            select
            label="Resolution"
            value={String(scale)}
            onChange={(e) => setScale(Number(e.target.value))}
            disabled={busy}
            helperText="Higher = sharper & larger files"
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="1">1x (72 DPI)</MenuItem>
            <MenuItem value="2">2x (144 DPI)</MenuItem>
            <MenuItem value="3">3x (216 DPI)</MenuItem>
            <MenuItem value="4">4x (288 DPI)</MenuItem>
          </TextField>

          {format !== "png" && (
            <TextField
              size="small"
              select
              label="Quality"
              value={String(quality)}
              onChange={(e) => setQuality(Number(e.target.value))}
              disabled={busy}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="0.6">60%</MenuItem>
              <MenuItem value="0.75">75%</MenuItem>
              <MenuItem value="0.92">92%</MenuItem>
              <MenuItem value="1">100%</MenuItem>
            </TextField>
          )}
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <ActionButton
            startIcon={
              pageCount > 1 ? <FolderZipIcon /> : <DownloadIcon />
            }
            onClick={() => void convert()}
            disabled={!canRun}
            loading={busy}
            sx={{ alignSelf: "flex-start" }}
          >
            {pageCount > 1 ? "Convert Pages (ZIP)" : "Convert to Image"}
          </ActionButton>
        </Stack>
      </Stack>

      {busy && (
        <ProgressStatusBlock
          done={progress?.done}
          total={progress?.total}
          label={progress?.label}
        />
      )}

      <ToolStatusAlerts error={error} success={success} />
    </PageContainer>
  );
}
