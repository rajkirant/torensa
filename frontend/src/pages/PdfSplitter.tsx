import React, { useMemo, useState } from "react";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadIcon from "@mui/icons-material/Download";
import FolderZipIcon from "@mui/icons-material/FolderZip";

import PageContainer from "../components/PageContainer";
import FilePickerButton from "../components/inputs/FilePickerButton";
import ToolStatusAlerts from "../components/alerts/ToolStatusAlerts";
import { ActionButton } from "../components/buttons/ActionButton";
import { TransparentButton } from "../components/buttons/TransparentButton";
import ProgressStatusBlock from "../components/tools/ProgressStatusBlock";
import downloadBlob from "../utils/downloadBlob";

type ProgressState = {
  done: number;
  total: number;
  label: string;
};

type ActiveAction = "extract" | "split" | null;

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
      "Enter page ranges like 1-3,5,8-10 before extracting pages.",
    );
  }

  const seen = new Set<number>();
  const orderedPages: number[] = [];
  const tokens = trimmed
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    throw new Error(
      "Enter page ranges like 1-3,5,8-10 before extracting pages.",
    );
  }

  for (const token of tokens) {
    const rangeMatch = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const rawStart = Number(rangeMatch[1]);
      const rawEnd = Number(rangeMatch[2]);
      const start = Math.min(rawStart, rawEnd);
      const end = Math.max(rawStart, rawEnd);

      if (start < 1 || end > pageCount) {
        throw new Error(
          `Range "${token}" is outside the valid page range (1-${pageCount}).`,
        );
      }

      for (let page = start; page <= end; page += 1) {
        if (seen.has(page)) continue;
        seen.add(page);
        orderedPages.push(page);
      }
      continue;
    }

    if (!/^\d+$/.test(token)) {
      throw new Error(
        `Invalid token "${token}". Use numbers and ranges like 1-3,5,8-10.`,
      );
    }

    const page = Number(token);
    if (page < 1 || page > pageCount) {
      throw new Error(
        `Page "${token}" is outside the valid page range (1-${pageCount}).`,
      );
    }

    if (!seen.has(page)) {
      seen.add(page);
      orderedPages.push(page);
    }
  }

  if (orderedPages.length === 0) {
    throw new Error("No valid pages were selected.");
  }

  return orderedPages;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer;
}

export default function PdfSplitter() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState(0);

  const [rangeInput, setRangeInput] = useState("1");

  const [busy, setBusy] = useState(false);
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
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
    setActiveAction(null);
    setProgress(null);
    setError(null);
    setSuccess(null);
  }

  async function onPickPdf(files: FileList | null) {
    if (!files || files.length === 0) return;

    const pickedFile = files[0];
    setError(null);
    setSuccess(null);
    setProgress(null);

    if (!isPdfFile(pickedFile)) {
      setError("Please choose a valid PDF file.");
      return;
    }

    try {
      const arrayBuffer = await pickedFile.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const count = pdf.getPageCount();

      if (count < 1) {
        throw new Error("The selected PDF has no pages.");
      }

      setFile(pickedFile);
      setPdfBytes(new Uint8Array(arrayBuffer));
      setPageCount(count);
      setRangeInput(`1-${count}`);
      setSuccess(
        `Loaded "${pickedFile.name}" (${count} ${plural(count, "page")}).`,
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

  async function extractSelectedPages() {
    setError(null);
    setSuccess(null);

    try {
      const state = requirePdfState();
      const selectedPages = parsePageRanges(rangeInput, state.pageCount);

      setBusy(true);
      setActiveAction("extract");
      setProgress(null);

      const sourcePdf = await PDFDocument.load(state.pdfBytes);
      const outputPdf = await PDFDocument.create();
      const copiedPages = await outputPdf.copyPages(
        sourcePdf,
        selectedPages.map((page) => page - 1),
      );

      copiedPages.forEach((page) => outputPdf.addPage(page));
      const outputBytes = await outputPdf.save();

      downloadBlob(
        new Blob([toArrayBuffer(outputBytes)], { type: "application/pdf" }),
        `${baseName}-extracted.pdf`,
      );

      setSuccess(
        `Extracted ${selectedPages.length} ${plural(
          selectedPages.length,
          "page",
        )} into one PDF.`,
      );
    } catch (err) {
      setError(toErrorMessage(err, "Failed to extract pages from this PDF."));
    } finally {
      setBusy(false);
      setActiveAction(null);
      setProgress(null);
    }
  }

  async function splitIntoZipPerPage() {
    setError(null);
    setSuccess(null);

    try {
      const state = requirePdfState();

      setBusy(true);
      setActiveAction("split");

      const sourcePdf = await PDFDocument.load(state.pdfBytes);
      const zip = new JSZip();
      const totalParts = state.pageCount;

      setProgress({ done: 0, total: totalParts, label: "Preparing files..." });

      for (let partIndex = 0; partIndex < totalParts; partIndex += 1) {
        const pageNumber = partIndex + 1;
        const indices = [pageNumber - 1];

        const partPdf = await PDFDocument.create();
        const copiedPages = await partPdf.copyPages(sourcePdf, indices);
        copiedPages.forEach((page) => partPdf.addPage(page));

        const partBytes = await partPdf.save();
        const partName = `${baseName}-part-${String(partIndex + 1).padStart(
          2,
          "0",
        )}-page-${pageNumber}.pdf`;
        zip.file(partName, partBytes);

        setProgress({
          done: partIndex + 1,
          total: totalParts,
          label: `Built ${partIndex + 1} of ${totalParts} files...`,
        });
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipBlob, `${baseName}-split.zip`);

      setSuccess(
        `Created ${totalParts} ${plural(totalParts, "file")} (one page per PDF) in a ZIP download.`,
      );
    } catch (err) {
      setError(toErrorMessage(err, "Failed to split this PDF."));
    } finally {
      setBusy(false);
      setActiveAction(null);
      setProgress(null);
    }
  }

  const canRunActions = !busy && Boolean(file) && pageCount > 0;

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
            <FilePickerButton
              variant="contained"
              startIcon={<UploadFileIcon />}
              label={file ? "Change PDF" : "Choose PDF"}
              accept=".pdf,application/pdf"
              onFilesSelected={onPickPdf}
              resetAfterSelect
              disabled={busy}
            />

            <TransparentButton
              label="Clear"
              startIcon={<DeleteOutlineIcon />}
              onClick={clearAll}
              disabled={busy || (!file && !error && !success)}
            />
          </Box>
        </Stack>

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
          2) Split options
        </Typography>

        <Stack spacing={1}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Extract specific pages into one PDF
          </Typography>
          <TextField
            size="small"
            label="Page ranges"
            placeholder="1-3,5,8-10"
            value={rangeInput}
            onChange={(event) => setRangeInput(event.target.value)}
            disabled={busy}
            helperText={`Use 1-${Math.max(1, pageCount)}. Example: 1-3,5,8-10`}
            fullWidth
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <ActionButton
              startIcon={<DownloadIcon />}
              onClick={extractSelectedPages}
              disabled={!canRunActions}
              loading={busy && activeAction === "extract"}
              sx={{ alignSelf: "flex-start" }}
            >
              Extract Selected Pages
            </ActionButton>

            <ActionButton
              startIcon={<FolderZipIcon />}
              onClick={() => void splitIntoZipPerPage()}
              disabled={!canRunActions}
              loading={busy && activeAction === "split"}
              sx={{ alignSelf: "flex-start" }}
            >
              One PDF Per Page (ZIP)
            </ActionButton>
          </Stack>
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
