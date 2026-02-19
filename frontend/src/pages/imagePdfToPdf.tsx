import React, { useEffect, useMemo, useRef, useState } from "react";
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  Typography,
} from "@mui/material";

import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RotateRightIcon from "@mui/icons-material/RotateRight";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import ImageIcon from "@mui/icons-material/Image";
import DownloadIcon from "@mui/icons-material/Download";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

import BusyChip from "../components/chips/BusyChips";
import PageContainer from "../components/PageContainer";
import { ActionButton } from "../components/buttons/ActionButton";
import FilePickerButton from "../components/inputs/FilePickerButton";
import downloadBlob from "../utils/downloadBlob";

type ItemKind = "image" | "pdf";

type QueueItem = {
  id: string;
  file: File;
  kind: ItemKind;
  name: string;
  previewUrl: string;
  pdfPageNumber?: number;
  pdfPageCount?: number;
  imageRotation: 0 | 90 | 180 | 270;
};

const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isPdf(file: File) {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

function isImage(file: File) {
  return file.type.startsWith("image/");
}

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

/**
 * Compute placement for an image of (iw, ih) into a box (bw, bh) with fit mode.
 */
function fitRect(
  iw: number,
  ih: number,
  bw: number,
  bh: number,
  fit: "contain" | "cover",
) {
  const iRatio = iw / ih;
  const bRatio = bw / bh;

  let w = bw;
  let h = bh;

  if (fit === "contain") {
    if (iRatio > bRatio) {
      w = bw;
      h = bw / iRatio;
    } else {
      h = bh;
      w = bh * iRatio;
    }
  } else {
    if (iRatio > bRatio) {
      h = bh;
      w = bh * iRatio;
    } else {
      w = bw;
      h = bw / iRatio;
    }
  }

  const x = (bw - w) / 2;
  const y = (bh - h) / 2;

  return { x, y, w, h };
}

async function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return await file.arrayBuffer();
}

/**
 * Tries to embed image as PNG first, then JPEG.
 */
async function embedImage(doc: PDFDocument, bytes: Uint8Array, mime: string) {
  if (mime.includes("png")) return await doc.embedPng(bytes);
  if (mime.includes("jpeg") || mime.includes("jpg")) {
    return await doc.embedJpg(bytes);
  }

  try {
    return await doc.embedPng(bytes);
  } catch {
    return await doc.embedJpg(bytes);
  }
}

const toArrayBuffer = (u8: Uint8Array): ArrayBuffer => {
  return u8.slice().buffer as ArrayBuffer;
};

const ImagePdfToPdf: React.FC = () => {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [pageNumbers, setPageNumbers] = useState(true);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const itemsRef = useRef<QueueItem[]>([]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    return () => {
      const urls = new Set(itemsRef.current.map((it) => it.previewUrl));
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const totalCount = items.length;

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setError(null);

    const next: QueueItem[] = [];
    const failed: string[] = [];

    for (const file of Array.from(files)) {
      if (!isPdf(file) && !isImage(file)) continue;

      if (isImage(file)) {
        next.push({
          id: uid(),
          file,
          kind: "image",
          name: file.name,
          previewUrl: URL.createObjectURL(file),
          imageRotation: 0,
        });
        continue;
      }

      try {
        const ab = await readAsArrayBuffer(file);
        const pdf = await PDFDocument.load(ab);
        const pageCount = pdf.getPageCount();
        const previewUrl = URL.createObjectURL(file);

        for (let page = 1; page <= pageCount; page += 1) {
          next.push({
            id: uid(),
            file,
            kind: "pdf",
            name: file.name,
            previewUrl,
            pdfPageNumber: page,
            pdfPageCount: pageCount,
            imageRotation: 0,
          });
        }
      } catch {
        failed.push(file.name);
      }
    }

    if (next.length === 0) {
      setError("No supported files selected. Please choose images or PDFs.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setItems((prev) => [...prev, ...next]);

    if (failed.length > 0) {
      setError(`Skipped ${failed.length} PDF(s) that could not be read.`);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((p) => p.id === id);
      if (!target) return prev;

      const next = prev.filter((p) => p.id !== id);
      const stillUsed = next.some((p) => p.previewUrl === target.previewUrl);
      if (!stillUsed) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return next;
    });
  };

  const reorderItems = (fromId: string, toId: string) => {
    if (fromId === toId) return;

    setItems((prev) => {
      const fromIdx = prev.findIndex((p) => p.id === fromId);
      const toIdx = prev.findIndex((p) => p.id === toId);
      if (fromIdx < 0 || toIdx < 0) return prev;

      const copy = [...prev];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      return copy;
    });
  };

  const rotateImage = (id: string) => {
    setItems((prev) =>
      prev.map((p) =>
        p.id === id && p.kind === "image"
          ? {
              ...p,
              imageRotation: ((p.imageRotation + 90) % 360) as
                | 0
                | 90
                | 180
                | 270,
            }
          : p,
      ),
    );
  };

  const onDragStart =
    (id: string) => (e: React.DragEvent<HTMLDivElement>) => {
      if (busy) return;
      setDraggingId(id);
      setDragOverId(id);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
    };

  const onDragOver = (id: string) => (e: React.DragEvent<HTMLDivElement>) => {
    if (!draggingId || draggingId === id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(id);
  };

  const onDrop = (id: string) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const fromId = draggingId ?? e.dataTransfer.getData("text/plain");
    if (fromId) {
      reorderItems(fromId, id);
    }
    setDraggingId(null);
    setDragOverId(null);
  };

  const onDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const canBuild = useMemo(
    () => items.length > 0 && !busy,
    [items.length, busy],
  );

  const buildPdf = async () => {
    setError(null);

    if (items.length === 0) {
      setError("Please add at least one image or PDF.");
      return;
    }

    setBusy(true);
    try {
      const out = await PDFDocument.create();
      const marginPts = 0; // fixed: no margins

      const font = pageNumbers
        ? await out.embedFont(StandardFonts.Helvetica)
        : null;

      const pdfCache = new Map<string, PDFDocument>();

      for (const item of items) {
        if (item.kind === "pdf") {
          const key = fileKey(item.file);
          let src = pdfCache.get(key);
          if (!src) {
            const ab = await readAsArrayBuffer(item.file);
            src = await PDFDocument.load(ab);
            pdfCache.set(key, src);
          }

          const pageIndex = Math.max(0, (item.pdfPageNumber ?? 1) - 1);
          const [copied] = await out.copyPages(src, [pageIndex]);
          out.addPage(copied);
          continue;
        }

        const ab = await readAsArrayBuffer(item.file);
        const bytes = new Uint8Array(ab);
        const img = await embedImage(out, bytes, item.file.type);

        const iw = img.width;
        const ih = img.height;
        const base = 595.28; // approx A4 width
        const scale = base / iw;
        const pageW = base;
        const pageH = clamp(ih * scale, 200, 2000);

        const page = out.addPage([pageW, pageH]);

        const rot = item.imageRotation;
        const drawableW = pageW - marginPts * 2;
        const drawableH = pageH - marginPts * 2;

        const imgW = rot === 90 || rot === 270 ? img.height : img.width;
        const imgH = rot === 90 || rot === 270 ? img.width : img.height;

        const fit = fitRect(imgW, imgH, drawableW, drawableH, "contain");

        const x = marginPts + fit.x;
        const y = marginPts + fit.y;

        page.drawImage(img, {
          x,
          y,
          width: fit.w,
          height: fit.h,
          rotate: degrees(rot),
        });
      }

      if (pageNumbers && font) {
        const pages = out.getPages();
        const start = 1;
        const size = 10;

        pages.forEach((p, i) => {
          const label = String(start + i);
          const { width } = p.getSize();
          const pad = 18;
          const textWidth = font.widthOfTextAtSize(label, size);

          p.drawText(label, {
            x: width - pad - textWidth,
            y: pad - 6,
            size,
            font,
            opacity: 0.85,
          });
        });
      }

      const pdfBytes = await out.save();

      const blob = new Blob([toArrayBuffer(pdfBytes)], {
        type: "application/pdf",
      });
      downloadBlob(blob, "merged.pdf");
    } catch (e: any) {
      setError(
        e?.message ||
          "Failed to build PDF. Please try again with different files.",
      );
    } finally {
      setBusy(false);
    }
  };

  const clearAll = () => {
    setItems((prev) => {
      const urls = new Set(prev.map((it) => it.previewUrl));
      urls.forEach((url) => URL.revokeObjectURL(url));
      return [];
    });
    setError(null);
  };

  return (
    <PageContainer maxWidth={920}>
      <Divider />

      {/* Upload */}
      <Box
        sx={{
          display: "flex",
          gap: 1.5,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <FilePickerButton
          variant="outlined"
          startIcon={<UploadFileIcon />}
          sx={{ textTransform: "none" }}
          label="Add images / PDFs"
          accept="application/pdf,image/*"
          multiple
          inputRef={fileInputRef}
          onFilesSelected={onPickFiles}
        />

        <Button
          variant="text"
          color="inherit"
          onClick={clearAll}
          disabled={items.length === 0 || busy}
          sx={{ textTransform: "none" }}
        >
          Clear
        </Button>

        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ ml: { xs: 0, sm: "auto" } }}
        >
          <Chip
            size="small"
            label={`${totalCount} page${totalCount === 1 ? "" : "s"}`}
            variant="outlined"
          />
          {busy && <BusyChip />}
        </Stack>
      </Box>

      {/* Queue */}
      {items.length > 0 && (
        <Stack spacing={1.25}>
          <Typography variant="subtitle1" fontWeight={700}>
            Pages (drag and drop to reorder)
          </Typography>

          <Stack spacing={1}>
            {items.map((it, idx) => (
              <Card
                key={it.id}
                variant="outlined"
                draggable={!busy}
                onDragStart={onDragStart(it.id)}
                onDragOver={onDragOver(it.id)}
                onDrop={onDrop(it.id)}
                onDragEnd={onDragEnd}
                sx={{
                  borderRadius: 2,
                  overflow: "hidden",
                  opacity: draggingId === it.id ? 0.65 : 1,
                  borderColor: dragOverId === it.id ? "primary.main" : undefined,
                }}
              >
                <CardContent sx={{ py: 1.5 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    {/* Thumb */}
                    <div
                      style={{
                        width: 74,
                        height: 74,
                        borderRadius: 12,
                        border: "1px solid rgba(0,0,0,0.08)",
                        display: "grid",
                        placeItems: "center",
                        overflow: "hidden",
                        background: "#fff",
                        flex: "0 0 auto",
                      }}
                    >
                      {it.kind === "image" ? (
                        <img
                          src={it.previewUrl}
                          alt={it.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <iframe
                          title={`${it.name}-page-${it.pdfPageNumber ?? 1}`}
                          src={`${it.previewUrl}#page=${it.pdfPageNumber ?? 1}&view=Fit`}
                          style={{
                            width: "100%",
                            height: "100%",
                            border: 0,
                            pointerEvents: "none",
                          }}
                        />
                      )}
                    </div>

                    {/* Info */}
                    <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography
                          variant="subtitle2"
                          fontWeight={700}
                          noWrap
                          title={it.name}
                          sx={{ maxWidth: "100%" }}
                        >
                          {idx + 1}. {it.name}
                          {it.kind === "pdf" ? ` (page ${it.pdfPageNumber})` : ""}
                        </Typography>

                        <Chip
                          size="small"
                          label={it.kind === "pdf" ? "PDF PAGE" : "IMAGE"}
                          variant="outlined"
                          icon={
                            it.kind === "pdf" ? (
                              <PictureAsPdfIcon />
                            ) : (
                              <ImageIcon />
                            )
                          }
                        />
                      </Stack>

                      <Typography variant="caption" color="text.secondary">
                        {it.kind === "pdf"
                          ? `Page ${it.pdfPageNumber} of ${it.pdfPageCount}`
                          : `Rotation: ${it.imageRotation} deg`}
                      </Typography>
                    </Stack>

                    {/* Actions */}
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <DragIndicatorIcon
                        fontSize="small"
                        color="action"
                        sx={{ cursor: busy ? "default" : "grab" }}
                      />

                      {it.kind === "image" && (
                        <IconButton
                          aria-label="rotate"
                          onClick={() => rotateImage(it.id)}
                          disabled={busy}
                          size="small"
                        >
                          <RotateRightIcon fontSize="small" />
                        </IconButton>
                      )}

                      <IconButton
                        aria-label="remove"
                        onClick={() => removeItem(it.id)}
                        disabled={busy}
                        size="small"
                        color="error"
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Stack>
      )}

      <Divider />

      {/* Options */}
      <Stack spacing={2}>
        <Typography variant="subtitle1" fontWeight={800}>
          Export options
        </Typography>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems={{ sm: "center" }}
        >
          <FormControlLabel
            control={
              <Switch
                checked={pageNumbers}
                onChange={(e) => setPageNumbers(e.target.checked)}
                disabled={busy}
              />
            }
            label="Add page numbers"
          />
        </Stack>
      </Stack>

      {/* Build */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems="center"
      >
        <ActionButton
          startIcon={<DownloadIcon />}
          onClick={buildPdf}
          disabled={!canBuild}
          loading={busy}
          sx={{ fontWeight: 700 }}
        >
          Build & Download PDF
        </ActionButton>

        {busy && (
          <Typography variant="body2" color="text.secondary">
            Building PDF... (large PDFs can take a moment)
          </Typography>
        )}
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}
    </PageContainer>
  );
};

export default ImagePdfToPdf;
